/**
 * ArchiveManagement — 直播管理 归档管理列表页
 *
 * 需求规范（3.5.3.2）：
 *  - 展示 MOVIE / EPISODE / SEASON / SERIES 类型的已归档内容
 *  - 搜索：Content Name / Content Type / Ingest Status(数据字典) / Genre / Custom Tags /
 *          Category / Package / Provider / License Start/End Date(范围) /
 *          Channel Name(文本) / Program Name(文本) /
 *          Begin/End Time(日期+时间范围) / Publish Date/Takedown Date(占位)
 *  - 列表列：Channel Name / Program Name / Content Type / Begin Time / End Time /
 *            Ingest Status / Genre / Custom Tags / Type / Category / Package /
 *            License Start / License End / Provider / Action
 *  - Action：Poster(图片)（详情/编辑/导入/导出暂不开发）
 *  - 海报 entityType：MOVIE/EPISODE → "program"；SERIES/SEASON → "series"
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd'
import {
  EditOutlined,
  InfoCircleOutlined,
  PictureOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getArchives } from '../../api/live'
import { getGenres } from '../../api/genres'
import { getProvidersSimple } from '../../api/providers'
import { getCategoryTree } from '../../api/categories'
import { getPackages } from '../../api/packages'
import { getCustomTags } from '../../api/customTags'
import { getDictTree } from '../../api/dicts'
import PostersModal from '../../components/PostersModal'
import SearchForm from '../../components/SearchForm'
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
  { label: 'SERIES', value: 'SERIES' },
]

const STATUS_COLOR: Record<string, string> = {
  Published: 'success',
  Processing: 'processing',
  WaitingForMaterials: 'warning',
  Failed: 'error',
  None: 'default',
}

/** 根据 content_type 确定海报 entityType */
function resolveEntityType(contentType: string): string {
  return contentType === 'MOVIE' || contentType === 'EPISODE' ? 'program' : 'series'
}

/** 根据 content_type 确定详情页路由前缀 */
function resolveDetailPath(contentType: string): string {
  if (contentType === 'CHANNEL') return '/live/channels'
  if (contentType === 'SCHEDULE') return '/live/schedules'
  // MOVIE / EPISODE / SEASON / SERIES → 点播管理
  return '/contents'
}

interface SearchValues {
  title?: string
  content_types?: string[]
  statuses?: string[]
  genre_id?: number
  provider_id?: number
  package_id?: number
  category_id?: number
  custom_tag_ids?: number[]
  channel_name?: string
  program_name?: string
  begin_time_range?: [dayjs.Dayjs, dayjs.Dayjs]
  end_time_range?: [dayjs.Dayjs, dayjs.Dayjs]
  license_start_range?: [dayjs.Dayjs, dayjs.Dayjs]
  license_end_range?: [dayjs.Dayjs, dayjs.Dayjs]
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
  const [ingestStatusOptions, setIngestStatusOptions] = useState<{ label: string; value: string }[]>([])

  // 海报弹框
  const [postersOpen, setPostersOpen] = useState(false)
  const [postersTarget, setPostersTarget] = useState<{
    id: number
    title: string
    entityType: string
  } | null>(null)

  // ─── 搜索字段配置 ───────────────────────────────────────────────────────────

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'title',
      labelKey: 'common.col.contentName',
      type: 'input',
      placeholderKey: 'common.placeholder.programKeyword',
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
      name: 'genre_id',
      labelKey: 'common.col.genre',
      type: 'select',
      render: () => (
        <Select
          placeholder={t('common.placeholder.select')}
          options={genreOptions}
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
      name: 'custom_tag_ids',
      labelKey: 'common.col.customTags',
      type: 'multiSelect',
      options: customTagOptions,
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
      name: 'package_id',
      labelKey: 'common.col.package',
      type: 'select',
      render: () => (
        <Select
          placeholder={t('common.placeholder.select')}
          options={packageOptions}
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
      name: 'provider_id',
      labelKey: 'common.col.provider',
      type: 'select',
      render: () => (
        <Select
          placeholder={t('common.placeholder.select')}
          options={providerOptions}
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
      placeholderKey: 'common.placeholder.programKeyword',
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
    },
    {
      name: 'end_time_range',
      labelKey: 'common.col.endTime',
      type: 'dateRange',
      showTime: true,
    },
    // TODO（需求 3.5.3.2）：Publish/Takedown Date 需发布管理落库 publish_date/takedown_date 后再启用
    {
      name: '_publish_range',
      labelKey: 'common.col.publishDate',
      type: 'dateRange',
      disabled: true,
    },
    {
      name: '_takedown_range',
      labelKey: 'common.col.takedownDate',
      type: 'dateRange',
      disabled: true,
    },
  ], [genreOptions, providerOptions, categoryOptions, packageOptions, customTagOptions, ingestStatusOptions, t])

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
    onSearch: (values) => {
      const params: ArchiveQueryParams = {}
      if (values.title) params.title = values.title
      if (values.content_types?.length) params.content_types = values.content_types
      if (values.statuses?.length) params.statuses = values.statuses
      if (values.genre_id) params.genre_id = values.genre_id
      if (values.provider_id) params.provider_id = values.provider_id
      if (values.package_id) params.package_id = values.package_id
      if (values.category_id) params.category_id = values.category_id
      if (values.custom_tag_ids?.length) params.custom_tag_ids = values.custom_tag_ids
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
    void loadList(1, pagination.pageSize, {})
  }, [])

  const loadOptions = async () => {
    try {
      const [genres, providers, categories, packages, customTags, dicts] = await Promise.all([
        getGenres({ page: 1, page_size: 500 }),
        getProvidersSimple(),
        getCategoryTree(),
        getPackages({ page: 1, page_size: 500 }),
        getCustomTags({ page: 1, page_size: 500 }),
        getDictTree(),
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
      render: (v?: string) => <Tooltip title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
    },
    {
      title: t('common.col.programName'),
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'title' ? sortOrder : null,
      render: (v: string) => (
        <Tooltip title={v}>
          <span>{v}</span>
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
        const text = v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—'
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
        const text = v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—'
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
        return <Tooltip title={text}><span>{text}</span></Tooltip>
      },
    },
    {
      title: t('common.col.type'),
      dataIndex: 'type_name',
      key: 'type_name',
      width: 120,
      ellipsis: { showTitle: false },
      render: (v?: string) => <Tooltip title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
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
      width: 120,
      ellipsis: { showTitle: false },
      render: (v?: string) => <Tooltip title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
    },
    {
      title: t('common.col.licenseEnd'),
      dataIndex: 'license_end',
      key: 'license_end',
      width: 120,
      ellipsis: { showTitle: false },
      render: (v?: string) => <Tooltip title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
    },
    {
      title: t('common.col.provider'),
      dataIndex: 'provider_names',
      key: 'provider_names',
      width: 160,
      ellipsis: { showTitle: false },
      render: (names: string[]) => {
        const text = names.length ? names.join(', ') : '—'
        return <Tooltip title={text}><span>{text}</span></Tooltip>
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
              onClick={() => navigate(`${resolveDetailPath(record.content_type)}/${record.id}`)}
            />
          </Tooltip>
          {canOperate && (
            <Tooltip title={t('common.edit')}>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`${resolveDetailPath(record.content_type)}/${record.id}?mode=edit`)}
              />
            </Tooltip>
          )}
          <Tooltip title={t('common.tooltip.posterManagement')}>
            <Button type="link" size="small" icon={<PictureOutlined />}
              onClick={() => {
                setPostersTarget({
                  id: record.id,
                  title: record.title,
                  entityType: resolveEntityType(record.content_type),
                })
                setPostersOpen(true)
              }} />
          </Tooltip>
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

      {/* 列表区 */}
      <Table<ArchiveListItem>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={archives}
        loading={loading}
        scroll={{ x: 2200 }}
        pagination={tablePaginationProps}
        onChange={handleTableChange}
      />

      {/* 海报管理弹框 */}
      {postersTarget && (
        <PostersModal
          open={postersOpen}
          entityType={postersTarget.entityType}
          entityId={postersTarget.id}
          entityName={postersTarget.title}
          readOnly={!canOperate}
          onClose={() => { setPostersOpen(false); setPostersTarget(null) }}
        />
      )}
    </div>
  )
}
