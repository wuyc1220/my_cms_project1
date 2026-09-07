/**
 * ArchiveManagement — 直播管理 归档管理列表页
 *
 * 需求规范（3.5.3.2）：
 *  - 展示 MOVIE / EPISODE / SEASON / SEASON_SERIES / SERIES 类型的已归档内容
 *  - 搜索：Content Name / Content Type / Ingest Status(数据字典) / Genre / Custom Tags /
 *          Category / Package / Provider / License Start/End Date(范围) /
 *          Channel Name(文本) / Program Name(文本) /
 *          Begin/End Time(日期+时间范围) / Publish Date/Takedown Date(占位)
 *  - 列表列：Channel Name / Program Name / Content Type / Begin Time / End Time /
 *            Ingest Status / Genre / Custom Tags / Type / Category / Package /
 *            License Start / License End / Provider / Action
 *  - Action：详情/编辑/导入/导出
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Row,
  Col,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import {
  DownloadOutlined,
  EditOutlined,
  InfoCircleOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getArchives, exportArchivesExcel } from '../../api/live'
import { getGenres } from '../../api/genres'
import { getMultiLanguageOptions } from '../../api/i18n'
import { getProvidersSimple } from '../../api/providers'
import { getCategoryTree } from '../../api/categories'
import { getPackages } from '../../api/packages'
import { getCustomTags } from '../../api/customTags'
import { getContentTypes } from '../../api/contentTypes'
import { getDictTree } from '../../api/dicts'
import ArchiveImportModal from '../../components/ArchiveImportModal'
import { EditContentModal } from '../../components/ContentModals'
import SearchForm from '../../components/SearchForm'
import { isHandledError } from '../../api'
import type { ArchiveListItem, ArchiveQueryParams } from '../../types/live'
import type { CategoryListItem, CustomTagListItem, GenreListItem } from '../../types/basic'
import type { DictNodeListItem } from '../../types/dict'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'

// ─── 常量 ────────────────────────────────────────────────────────────────────

const ARCHIVE_CONTENT_TYPES = [
  { label: 'MOVIE', value: 'MOVIE' },
  { label: 'EPISODE', value: 'EPISODE' },
  { label: 'SEASON', value: 'SEASON' },
  { label: 'SEASON_SERIES', value: 'SEASON_SERIES' },
  { label: 'SERIES', value: 'SERIES' },
]

const STATUS_COLOR: Record<string, string> = {
  Published: 'success',
  Processing: 'processing',
  WaitingForMaterials: 'warning',
  Failed: 'error',
  None: 'default',
}

/** 根据 content_type 确定详情页路由前缀 */
function resolveDetailPath(contentType: string): string {
  if (contentType === 'CHANNEL') return '/live/channels'
  if (contentType === 'SCHEDULE') return '/live/schedules'
  return '/contents'
}

/** 获取完整的详情页 URL（带 source 参数） */
function getDetailUrl(record: ArchiveListItem, options?: { mode?: string }): string {
  const basePath = resolveDetailPath(record.content_type)
  const params = new URLSearchParams({ source: 'archive_management' })
  if (options?.mode) params.set('mode', options.mode)
  return `${basePath}/${record.id}?${params.toString()}`
}

interface SearchValues {
  title?: string
  content_types?: string[]
  statuses?: string[]
  genre_ids?: number[]
  provider_ids?: number[]
  package_ids?: number[]
  category_id?: number
  custom_tag_ids?: number[]
  deleted?: string
  type_ids?: number[]
  channel_name?: string
  program_name?: string
  begin_time_range?: [dayjs.Dayjs, dayjs.Dayjs]
  end_time_range?: [dayjs.Dayjs, dayjs.Dayjs]
  license_start_range?: [dayjs.Dayjs, dayjs.Dayjs]
  license_end_range?: [dayjs.Dayjs, dayjs.Dayjs]
  publish_date_range?: [dayjs.Dayjs, dayjs.Dayjs]
  unpublish_date_range?: [dayjs.Dayjs, dayjs.Dayjs]
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function ArchiveManagement() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.live.archives.operate')

  const [archives, setArchives] = useState<ArchiveListItem[]>([])
  const [loading, setLoading] = useState(false)
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filters, sortField, sortOrder)
    },
  })

  const [genreOptions, setGenreOptions] = useState<{ label: string; value: number }[]>([])
  const [providerOptions, setProviderOptions] = useState<{ label: string; value: number }[]>([])
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: number }[]>([])
  const [packageOptions, setPackageOptions] = useState<{ label: string; value: number }[]>([])
  const [customTagOptions, setCustomTagOptions] = useState<{ label: string; value: number }[]>([])
  const [typeOptions, setTypeOptions] = useState<{ label: string; value: number }[]>([])
  const [ingestStatusOptions, setIngestStatusOptions] = useState<{ label: string; value: string }[]>([])

  // 行选择
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])

  // 导入弹框
  const [importModalOpen, setImportModalOpen] = useState(false)

  // 编辑弹框
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editContentId, setEditContentId] = useState<number | null>(null)

  // ─── 搜索字段配置 ───────────────────────────────────────────────────────────

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'title',
      labelKey: 'common.col.contentName',
      type: 'input',
      placeholderKey: 'common.placeholder.keyword',
    },
    {
      name: 'content_types',
      labelKey: 'common.col.contentType',
      type: 'multiSelect',
      options: ARCHIVE_CONTENT_TYPES,
    },
    {
      name: 'statuses',
      labelKey: 'common.col.ingestStatus',
      type: 'multiSelect',
      options: ingestStatusOptions,
    },
    {
      name: 'genre_ids',
      labelKey: 'common.col.genre',
      type: 'multiSelect',
      options: genreOptions,
    },
    {
      name: 'custom_tag_ids',
      labelKey: 'common.col.customTags',
      type: 'multiSelect',
      options: customTagOptions,
    },
    {
      name: 'deleted',
      labelKey: 'common.col.deleted',
      type: 'select',
      options: [
        { label: t('common.no'), value: 'NO' },
        { label: t('common.yes'), value: 'YES' },
      ],
    },
    {
      name: 'type_ids',
      labelKey: 'common.col.type',
      type: 'multiSelect',
      options: typeOptions,
    },
    {
      name: 'category_id',
      labelKey: 'common.col.category',
      type: 'select',
      render: () => (
        <Select
          placeholder={t('common.placeholder.select')}
          options={categoryOptions}
          allowClear
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          style={{ width: '100%' }}
        />
      ),
    },
    {
      name: 'package_ids',
      labelKey: 'common.col.package',
      type: 'multiSelect',
      options: packageOptions,
    },
    {
      name: 'provider_ids',
      labelKey: 'common.col.provider',
      type: 'multiSelect',
      options: providerOptions,
    },
    {
      name: 'license_start_range',
      labelKey: 'common.col.licenseStart',
      type: 'dateRange',
    },
    {
      name: 'license_end_range',
      labelKey: 'common.col.licenseEnd',
      type: 'dateRange',
    },
    {
      name: 'channel_name',
      labelKey: 'common.col.channelName',
      type: 'input',
      placeholderKey: 'common.placeholder.channelKeyword',
    },
    {
      name: 'program_name',
      labelKey: 'common.col.programName',
      type: 'input',
      placeholderKey: 'common.placeholder.programKeyword',
    },
    {
      name: 'begin_time_range',
      labelKey: 'common.col.beginTime',
      type: 'dateRange',
      showTime: true,
      colSpan: 12,
    },
    {
      name: 'end_time_range',
      labelKey: 'common.col.endTime',
      type: 'dateRange',
      showTime: true,
      colSpan: 12,
    },
    {
      name: 'publish_date_range',
      labelKey: 'common.col.publishDate',
      type: 'dateRange',
    },
    {
      name: 'unpublish_date_range',
      labelKey: 'common.col.unpublishDate',
      type: 'dateRange',
    },
  ], [genreOptions, providerOptions, categoryOptions, packageOptions, customTagOptions, typeOptions, ingestStatusOptions, t])

  // ─── 使用 useSearchForm Hook ─────────────────────────────────────────────────

  const {
    form: searchForm,
    filters,
    setFilters,
    expanded,
    setExpanded,
    showExpand,
    handleSearch,
    handleReset,
  } = useSearchForm<SearchValues>({
    defaultValues: {
      deleted: 'NO',
    },
    onSearch: (values) => {
      const params: ArchiveQueryParams = {}
      if (values.title) params.title = values.title
      if (values.content_types?.length) params.content_types = values.content_types
      if (values.statuses?.length) params.statuses = values.statuses
      if (values.genre_ids?.length) params.genre_ids = values.genre_ids
      if (values.provider_ids?.length) params.provider_ids = values.provider_ids
      if (values.package_ids?.length) params.package_ids = values.package_ids
      if (values.category_id) params.category_id = values.category_id
      if (values.custom_tag_ids?.length) params.custom_tag_ids = values.custom_tag_ids
      if (values.deleted) params.deleted = values.deleted
      if (values.type_ids?.length) params.type_ids = values.type_ids
      if (values.channel_name) params.channel_name = values.channel_name
      if (values.program_name) params.program_name = values.program_name
      if (values.begin_time_range?.[0]) {
        params.begin_time_from = values.begin_time_range[0].format('YYYY-MM-DD HH:mm')
        params.begin_time_to = values.begin_time_range[1].format('YYYY-MM-DD HH:mm')
      }
      if (values.end_time_range?.[0]) {
        params.end_time_from = values.end_time_range[0].format('YYYY-MM-DD HH:mm')
        params.end_time_to = values.end_time_range[1].format('YYYY-MM-DD HH:mm')
      }
      if (values.license_start_range?.[0]) {
        params.license_start_from = values.license_start_range[0].format('YYYY-MM-DD')
        params.license_start_to = values.license_start_range[1].format('YYYY-MM-DD')
      }
      if (values.license_end_range?.[0]) {
        params.license_end_from = values.license_end_range[0].format('YYYY-MM-DD')
        params.license_end_to = values.license_end_range[1].format('YYYY-MM-DD')
      }
      if (values.publish_date_range?.[0]) {
        params.publish_date_from = values.publish_date_range[0].format('YYYY-MM-DD')
        params.publish_date_to = values.publish_date_range[1].format('YYYY-MM-DD')
      }
      if (values.unpublish_date_range?.[0]) {
        params.unpublish_date_from = values.unpublish_date_range[0].format('YYYY-MM-DD')
        params.unpublish_date_to = values.unpublish_date_range[1].format('YYYY-MM-DD')
      }
      setFilters(params)
      resetSort()
      void loadList(1, pagination.pageSize, params, null, null)
    },
    onReset: () => {
      setFilters({})
      resetSort()
      void loadList(1, pagination.pageSize, {}, null, null)
    },
    fieldsCount: searchFields.length,
  })

  // ─── 初始化 ────────────────────────────────────────────────────────────────

  useEffect(() => {
    void loadOptions()
    searchForm.setFieldsValue({ deleted: 'NO' })
    const params: ArchiveQueryParams = { deleted: 'NO' }
    void loadList(1, pagination.pageSize, params)
  }, [])

  const loadOptions = async () => {
    try {
      const langOptions = await getMultiLanguageOptions()
      const defaultLang = langOptions.length > 0 ? langOptions[0].code : undefined
      const langFilter = defaultLang ? [defaultLang] : undefined
      const [genres, providers, categories, packages, customTags, dicts, types] = await Promise.all([
        getGenres({ page: 1, page_size: 500, languages: langFilter }),
        getProvidersSimple(),
        getCategoryTree(),
        getPackages({ page: 1, page_size: 500 }),
        getCustomTags({ page: 1, page_size: 500 }),
        getDictTree(),
        getContentTypes({ page: 1, page_size: 500 }),
      ])
      setGenreOptions(genres.items.map((g: GenreListItem) => ({ label: g.name, value: g.id })))
      setProviderOptions(providers.map((p) => ({ label: p.name, value: p.id })))
      // 栏目是树形，此处拍平成一级选项
      const flatCategories: { label: string; value: number }[] = []
      const flatten = (nodes: CategoryListItem[], prefix = ''): void => {
        nodes.forEach((n) => {
          flatCategories.push({ label: prefix + n.name, value: n.id })
          if (n.children?.length) flatten(n.children, prefix + n.name + ' / ')
        })
      }
      flatten(categories)
      setCategoryOptions(flatCategories)
      setPackageOptions(packages.items.map((p) => ({ label: p.name, value: p.id })))
      setCustomTagOptions(customTags.items.map((ct: CustomTagListItem) => ({ label: ct.name, value: ct.id })))
      setTypeOptions(types.items.map((t: { name: string; id: number }) => ({ label: t.name, value: t.id })))
      // Ingest 状态选项来源于数据字典 Ingest_Status
      const ingestRoot = dicts.find((d: DictNodeListItem) => d.code === 'Ingest_Status')
      setIngestStatusOptions((ingestRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })))
    } catch (err) { /* 不阻塞 */ }
  }

  const loadList = async (p: number, ps: number, params: ArchiveQueryParams, sortBy?: string | null, sortOrd?: 'ascend' | 'descend' | null) => {
    setLoading(true)
    try {
      const res = await getArchives({
        ...params,
        page: p,
        page_size: ps,
        sort_by: sortBy ?? undefined,
        sort_order: sortOrd ? (sortOrd === 'ascend' ? 'asc' : 'desc') : undefined,
      })
      setArchives(res.items)
      updatePagination(res)
    } catch (err) {
    } finally {
      setLoading(false)
    }
  }


  // ─── 列定义 ───────────────────────────────────────────────────────────────

  const columns: ColumnsType<ArchiveListItem> = [
    {
      title: t('common.col.channelName'),
      dataIndex: 'channel_name',
      key: 'channel_name',
      width: 140,
      fixed: 'left',
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'channel_name' ? sortOrder : null,
      render: (v?: string) => <Tooltip autoAdjustOverflow={false} placement="topLeft" title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
    },
    {
      title: t('common.col.contentName'),
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'title' ? sortOrder : null,
      render: (v: string, record) => (
        <Tooltip title={v}>
          <a
            onClick={() => {
              sessionStorage.removeItem('archive_list_context')
              sessionStorage.setItem(
                'archive_list_context',
                JSON.stringify({ ids: archives.map((a) => a.id) }),
              )
              navigate(getDetailUrl(record, { mode: record.is_discarded ? undefined : 'edit' }))
            }}
          >
            {v}
          </a>
        </Tooltip>
      ),
    },
    {
      title: t('common.col.contentType'),
      dataIndex: 'content_type',
      key: 'content_type',
      width: 120,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'content_type' ? sortOrder : null,
      render: (v: string) => <Tooltip title={v}><span>{v}</span></Tooltip>,
    },
    {
      title: t('common.col.beginTime'),
      dataIndex: 'begin_time',
      key: 'begin_time',
      width: 150,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'begin_time' ? sortOrder : null,
      render: (v?: string) => {
        const text = v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—'
        return <Tooltip title={text}><span>{text}</span></Tooltip>
      },
    },
    {
      title: t('common.col.endTime'),
      dataIndex: 'end_time',
      key: 'end_time',
      width: 150,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'end_time' ? sortOrder : null,
      render: (v?: string) => {
        const text = v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—'
        return <Tooltip title={text}><span>{text}</span></Tooltip>
      },
    },
    {
      title: t('common.col.ingestStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 150,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'status' ? sortOrder : null,
      render: (v: string) => (
        <Tooltip title={v}>
          <Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag>
        </Tooltip>
      ),
    },
    {
      title: t('common.col.genre'),
      dataIndex: 'genre_name',
      key: 'genre_name',
      width: 120,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'genre_name' ? sortOrder : null,
      render: (v?: string) => <Tooltip title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
    },
    {
      title: t('common.col.customTags'),
      dataIndex: 'custom_tag_names',
      key: 'custom_tag_names',
      width: 160,
      ellipsis: { showTitle: false },
      render: (names: string[]) => {
        const text = names.length ? names.join(', ') : '—'
        return <Tooltip autoAdjustOverflow={false} placement="topLeft" title={text}><span>{text}</span></Tooltip>
      },
    },
    {
      title: t('common.col.type'),
      dataIndex: 'type_name',
      key: 'type_name',
      width: 120,
      ellipsis: { showTitle: false },
      render: (v?: string) => <Tooltip autoAdjustOverflow={false} placement="topLeft" title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
    },
    {
      title: t('common.col.category'),
      dataIndex: 'category_names',
      key: 'category_names',
      width: 140,
      ellipsis: { showTitle: false },
      render: (names: string[]) => {
        const text = names.length ? names.join(', ') : '—'
        return <Tooltip title={text}><span>{text}</span></Tooltip>
      },
    },
    {
      title: t('common.col.package'),
      dataIndex: 'package_names',
      key: 'package_names',
      width: 160,
      ellipsis: { showTitle: false },
      render: (names: string[]) => {
        const text = names.length ? names.join(', ') : '—'
        return <Tooltip title={text}><span>{text}</span></Tooltip>
      },
    },
    {
      title: t('common.col.licenseStart'),
      dataIndex: 'license_start',
      key: 'license_start',
      width: 130,
      ellipsis: { showTitle: false },
      render: (v?: string) => <Tooltip autoAdjustOverflow={false} placement="topLeft" title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
    },
    {
      title: t('common.col.licenseEnd'),
      dataIndex: 'license_end',
      key: 'license_end',
      width: 130,
      ellipsis: { showTitle: false },
      render: (v?: string) => <Tooltip autoAdjustOverflow={false} placement="topLeft" title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
    },
    {
      title: t('common.col.provider'),
      dataIndex: 'provider_names',
      key: 'provider_names',
      width: 160,
      ellipsis: { showTitle: false },
      render: (names: string[]) => {
        const text = names.length ? names.join(', ') : '—'
        return <Tooltip autoAdjustOverflow={false} placement="topLeft" title={text}><span>{text}</span></Tooltip>
      },
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title={t('common.detail')}>
            <Button
              type="link"
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() => navigate(`/trade/contents/${record.id}`)}
            />
          </Tooltip>
          {canOperate && (
            <Tooltip title={t('common.edit')}>
              <Button type="link" size="small" icon={<EditOutlined />}
                onClick={() => { setEditContentId(record.id); setEditModalOpen(true) }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  // ─── 渲染 ─────────────────────────────────────────────────────────────────

  return (
    <div className="main-container">
      {/* 搜索区 */}
      <SearchForm
        fields={searchFields}
        form={searchForm}
        expanded={expanded}
        onExpandChange={setExpanded}
        showExpand={showExpand}
        onSearch={handleSearch}
        onReset={handleReset}
        loading={loading}
      />

      {/* 操作按钮区 */}
      <Row justify="end" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <Button
              icon={<DownloadOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={async () => {
                try {
                  const blob = await exportArchivesExcel(selectedRowKeys)
                  const url = window.URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  const timestamp = dayjs().format('YYYYMMDDHHmmss')
                  a.download = `archives_${timestamp}.xlsx`
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  window.URL.revokeObjectURL(url)
                  void message.success(t('live.archive.msg.exportSuccess'))
                } catch (err) {
                  if (isHandledError(err)) return
                  void message.error(t('live.archive.msg.exportFailed'))
                }
              }}
            >
              {t('common.btn.excelExport')}
            </Button>
            {canOperate && (
              <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>
                {t('common.btn.excelImport')}
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* 列表区 */}
      <Table<ArchiveListItem>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={archives}
        loading={loading}
        scroll={{ x: 2200 }}
        rowSelection={{
          type: 'checkbox',
          fixed: true,
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as number[]),
        }}
        pagination={tablePaginationProps}
        onChange={handleTableChange}
      />

      {/* 导入弹框 */}
      <ArchiveImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => {
          setSelectedRowKeys([])
          void loadList(1, pagination.pageSize, filters)
        }}
      />

      {/* 编辑内容弹窗 */}
      <EditContentModal
        open={editModalOpen}
        contentId={editContentId}
        onClose={() => { setEditModalOpen(false); setEditContentId(null) }}
        onSuccess={() => { setEditModalOpen(false); setEditContentId(null); void loadList(pagination.current, pagination.pageSize, filters) }}
      />
    </div>
  )
}
