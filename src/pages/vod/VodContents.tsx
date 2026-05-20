/**
 * VodContents — 点播管理 VOD 内容列表页
 *
 * 需求规范（4.5.1）：
 *  - 搜索条件：Content Name / Ingest Status / Content Type / Genre /
 *              Type（占位）/ Category（占位）/ Package / Provider /
 *              License Start Date（范围）/ License End Date（范围）/
 *              Takedown Date（占位）/ Publish Date（占位）
 *  - 列表列：Checkbox / Poster / Content Name / Content Type / Ingest Status /
 *            Genre / Type / Category / Package / Provider /
 *            License Start / License End / Takedown Date / Publish Date / Action
 *  - Action：详情（i）/ 编辑（笔图标）/ 海报管理（图片图标）— 点击海报管理打开 PostersModal
 *  - 操作按钮：Excel Export（占位）/ Excel Import（占位）
 *  - 搜索区超过 2 行时默认折叠
 *
 * 海报规格 Belonging 映射：
 *  - MOVIE / EPISODE → entityType = "program"（匹配 PosterSize.belongings 含 "Program"）
 *  - SERIES / SEASON → entityType = "series"（匹配 PosterSize.belongings 含 "Series"）
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Button,
  Col,
  Image,
  Row,
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
  PictureOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getVodContents } from '../../api/vod'
import { getGenres } from '../../api/genres'
import { getProvidersSimple } from '../../api/providers'
import PostersModal from '../../components/PostersModal'
import SearchForm from '../../components/SearchForm'
import type { VodContentListItem, VodContentQueryParams } from '../../types/content'
import type { GenreListItem } from '../../types/basic'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'

// ─── 常量 ────────────────────────────────────────────────────────────────────

const VOD_CONTENT_TYPES = [
  { label: 'MOVIE', value: 'MOVIE' },
  { label: 'SEASON', value: 'SEASON' },
  { label: 'SERIES', value: 'SERIES' },
  { label: 'EPISODE', value: 'EPISODE' },
]

const INGEST_STATUS_OPTIONS = [
  { label: 'None', value: 'None' },
  { label: 'WaitingForMaterials', value: 'WaitingForMaterials' },
  { label: 'InProgress', value: 'InProgress' },
  { label: 'ReadyForPublish', value: 'ReadyForPublish' },
  { label: 'Publishing', value: 'Publishing' },
  { label: 'Published', value: 'Published' },
  { label: 'PublishFailed', value: 'PublishFailed' },
  { label: 'NoActiveLicense', value: 'NoActiveLicense' },
  { label: 'Expired', value: 'Expired' },
  { label: 'Closed', value: 'Closed' },
]

const STATUS_COLOR: Record<string, string> = {
  Published: 'success',
  InProgress: 'processing',
  WaitingForMaterials: 'warning',
  ReadyForPublish: 'warning',
  Publishing: 'processing',
  PublishFailed: 'error',
  NoActiveLicense: 'error',
  Expired: 'error',
  Closed: 'error',
  None: 'default',
}

/**
 * 根据 content_type 计算海报规格的 Belonging 类型。
 *  - MOVIE / EPISODE → "program"（PosterSize belongings 中的 "Program"）
 *  - SERIES / SEASON → "series"（PosterSize belongings 中的 "Series"）
 */
function resolveEntityType(contentType: string): string {
  if (contentType === 'MOVIE' || contentType === 'EPISODE') return 'program'
  return 'series'
}

// ─── 搜索表单值类型 ────────────────────────────────────────────────────────────

interface SearchValues {
  title?: string
  statuses?: string[]
  content_types?: string[]
  genre_id?: number
  provider_id?: number
  package_name?: string
  license_start_range?: [dayjs.Dayjs, dayjs.Dayjs]
  license_end_range?: [dayjs.Dayjs, dayjs.Dayjs]
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function VodContents() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.vod.contents.operate')
  const locationState = location.state as { filters?: { contentType?: string[]; ingestStatus?: string; license_end_from?: string; license_end_to?: string } } | undefined

  // 列表数据
  const [contents, setContents] = useState<VodContentListItem[]>([])
  const [loading, setLoading] = useState(false)
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filters, sortField, sortOrder)
    },
  })

  // 批量选择
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])

  // 下拉候选项
  const [genreOptions, setGenreOptions] = useState<{ label: string; value: number }[]>([])
  const [providerOptions, setProviderOptions] = useState<{ label: string; value: number }[]>([])

  // 海报管理弹框
  const [postersOpen, setPostersOpen] = useState(false)
  const [postersTarget, setPostersTarget] = useState<{
    id: number
    title: string
    entityType: string
  } | null>(null)

  // 海报 blob URL 映射（content_id -> blob_url）
  const [posterBlobUrls, setPosterBlobUrls] = useState<Record<number, string>>({})

  // ─── 搜索字段配置 ───────────────────────────────────────────────────────────

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'title',
      labelKey: 'common.col.contentName',
      type: 'input',
      placeholderKey: 'common.placeholder.keyword',
    },
    {
      name: 'statuses',
      labelKey: 'common.col.ingestStatus',
      type: 'multiSelect',
      options: INGEST_STATUS_OPTIONS,
    },
    {
      name: 'content_types',
      labelKey: 'common.col.contentType',
      type: 'multiSelect',
      options: VOD_CONTENT_TYPES,
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
      name: '_type',
      labelKey: 'common.col.type',
      type: 'select',
      placeholderKey: 'common.placeholder.selectComingSoon',
      disabled: true,
    },
    {
      name: '_category',
      labelKey: 'common.col.category',
      type: 'select',
      placeholderKey: 'common.placeholder.selectComingSoon',
      disabled: true,
    },
    {
      name: 'package_name',
      labelKey: 'common.col.package',
      type: 'input',
      placeholderKey: 'common.placeholder.packageKeyword',
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
      name: '_takedown_range',
      labelKey: 'common.col.takedownDate',
      type: 'dateRange',
      disabled: true,
    },
    {
      name: '_publish_range',
      labelKey: 'common.col.publishDate',
      type: 'dateRange',
      disabled: true,
    },
  ], [genreOptions, providerOptions, t])

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
    fieldsCount: searchFields.length,
    onSearch: async (values) => {
      const params: VodContentQueryParams = {}
      if (values.title) params.title = values.title
      if (values.statuses?.length) params.statuses = values.statuses
      if (values.content_types?.length) params.content_types = values.content_types
      if (values.genre_id) params.genre_id = values.genre_id
      if (values.provider_id) params.provider_id = values.provider_id
      if (values.package_name) params.package_name = values.package_name
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
      setSelectedRowKeys([])
      void loadList(1, pagination.pageSize, params, null, null)
    },
    onReset: () => {
      setFilters({})
      resetSort()
      setSelectedRowKeys([])
      void loadList(1, pagination.pageSize, {}, null, null)
    },
  })

  // ─── 处理从首页传递的过滤条件 ────────────────────────────────────────────────

  useEffect(() => {
    if (locationState?.filters) {
      const { contentType, ingestStatus, license_end_from, license_end_to } = locationState.filters
      const initialValues: SearchValues = {}
      if (contentType?.length) {
        initialValues.content_types = contentType
      }
      if (ingestStatus) {
        initialValues.statuses = [ingestStatus]
      }
      if (license_end_from && license_end_to) {
        initialValues.license_end_range = [dayjs(license_end_from), dayjs(license_end_to)]
      }
      // 设置表单初始值
      searchForm.setFieldsValue(initialValues)
      // 触发搜索
      const params: VodContentQueryParams = {}
      if (initialValues.content_types?.length) {
        params.content_types = initialValues.content_types
      }
      if (initialValues.statuses?.length) {
        params.statuses = initialValues.statuses
      }
      if (license_end_from && license_end_to) {
        params.license_end_from = license_end_from
        params.license_end_to = license_end_to
      }
      setFilters(params)
      void loadList(1, pagination.pageSize, params, null, null)
      // 清除 location state，避免刷新页面时重复应用
      navigate(location.pathname, { replace: true })
    }
  }, [locationState])

  // ─── 初始化 ───────────────────────────────────────────────────────────────

  useEffect(() => {
    void loadOptions()
    if (!locationState?.filters) {
      void loadList(1, pagination.pageSize, {}, null, null)
    }
  }, [])

  // 清理 blob URL，避免内存泄漏
  useEffect(() => {
    return () => {
      Object.values(posterBlobUrls).forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
    }
  }, [])

  const loadOptions = async () => {
    try {
      const [genres, providers] = await Promise.all([
        getGenres({ page: 1, page_size: 500 }),
        getProvidersSimple(),
      ])
      setGenreOptions(genres.items.map((g: GenreListItem) => ({ label: g.name, value: g.id })))
      setProviderOptions(providers.map((p) => ({ label: p.name, value: p.id })))
    } catch (err) {
      // 不阻塞主流程
    }
  }

  const loadList = async (page: number, pageSize: number, params: VodContentQueryParams, nextSortField?: string | null, nextSortOrder?: 'ascend' | 'descend' | null) => {
    setLoading(true)
    try {
      const res = await getVodContents({
        ...params,
        page,
        page_size: pageSize,
        sort_by: nextSortField ?? undefined,
        sort_order: nextSortOrder === 'ascend' ? 'asc' : nextSortOrder === 'descend' ? 'desc' : undefined,
      })
      setContents(res.items)
      updatePagination(res)

      // 加载海报 blob URL（参考 ContentDetailPage 的实现）
      const token = localStorage.getItem('token')
      const blobUrlMap: Record<number, string> = {}
      await Promise.all(
        res.items.map(async (item) => {
          if (item.poster_url) {
            try {
              const resp = await fetch(item.poster_url, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              })
              if (resp.ok) {
                blobUrlMap[item.id] = URL.createObjectURL(await resp.blob())
              }
            } catch (err) {
              // 忽略单个海报加载失败
            }
          }
        })
      )
      setPosterBlobUrls(blobUrlMap)
    } catch (err) {
      // 错误已由 API 拦截器统一处理
    } finally {
      setLoading(false)
    }
  }


  // ─── 打开海报管理弹框 ───────────────────────────────────────────────────────

  const openPosters = (record: VodContentListItem) => {
    setPostersTarget({
      id: record.id,
      title: record.title,
      entityType: resolveEntityType(record.content_type),
    })
    setPostersOpen(true)
  }

  // ─── 列定义 ───────────────────────────────────────────────────────────────

  const columns: ColumnsType<VodContentListItem> = [
    {
      title: t('common.col.poster'),
      key: 'poster',
      width: 72,
      fixed: 'left',
      render: (_, record) => {
        const blobUrl = posterBlobUrls[record.id]
        return blobUrl ? (
          <Image
            src={blobUrl}
            width={40}
            height={56}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            preview={false}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 56,
              background: '#f5f5f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              color: '#d9d9d9',
              fontSize: 20,
              cursor: 'pointer',
              border: '1px dashed #d9d9d9',
            }}
            onClick={() => openPosters(record)}
          >
            <PictureOutlined />
          </div>
        )
      },
    },
    {
      title: t('common.col.contentName'),
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'title' ? sortOrder : null,
      render: (title: string, record) => (
        <Tooltip title={title}>
          <a
            style={{ fontWeight: 500 }}
            onClick={() => navigate(`/trade/contents/${record.id}`)}
          >
            {title}
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
      title: t('common.col.ingestStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 160,
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
      title: t('common.col.type'),
      dataIndex: 'type_name',
      key: 'type_name',
      width: 120,
      ellipsis: { showTitle: false },
      render: (v?: string) => <Tooltip title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
    },
    {
      title: t('common.col.category'),
      dataIndex: 'category_name',
      key: 'category_name',
      width: 140,
      ellipsis: { showTitle: false },
      render: (v?: string) => <Tooltip title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
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
      title: t('common.col.licenseStart'),
      dataIndex: 'license_start',
      key: 'license_start',
      width: 120,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'license_start' ? sortOrder : null,
      render: (v?: string) => <Tooltip title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
    },
    {
      title: t('common.col.licenseEnd'),
      dataIndex: 'license_end',
      key: 'license_end',
      width: 120,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'license_end' ? sortOrder : null,
      render: (v?: string) => <Tooltip title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
    },
    {
      title: t('common.col.takedownDate'),
      dataIndex: 'takedown_date',
      key: 'takedown_date',
      width: 130,
      ellipsis: { showTitle: false },
      render: (v?: string) => <Tooltip title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
    },
    {
      title: t('common.col.publishDate'),
      dataIndex: 'publish_date',
      key: 'publish_date',
      width: 120,
      ellipsis: { showTitle: false },
      render: (v?: string) => <Tooltip title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title={t('common.detail')}>
            <Button
              type="link"
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() => navigate(`/contents/${record.id}`)}
            />
          </Tooltip>
          {canOperate && (
            <Tooltip title={t('common.edit')}>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`/contents/${record.id}?mode=edit`)}
              />
            </Tooltip>
          )}
          <Tooltip title={t('common.tooltip.posterManagement')}>
            <Button
              type="link"
              size="small"
              icon={<PictureOutlined />}
              onClick={() => openPosters(record)}
            />
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

      {/* 工具栏 */}
      <Row justify="end" style={{ marginBottom: 12 }}>
        <Col>
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => void message.info(t('vod.msg.exportSoon'))}
            >
              {t('common.btn.excelExport')}
            </Button>
            {canOperate && (
              <Button
                icon={<UploadOutlined />}
                onClick={() => void message.info(t('vod.msg.importSoon'))}
              >
                {t('common.btn.excelImport')}
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      <Table<VodContentListItem>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={contents}
        loading={loading}
        scroll={{ x: 1860, y: 550 }}
        onChange={handleTableChange}
        rowSelection={{
          type: 'checkbox',
          fixed: true,
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as number[]),
        }}
        pagination={tablePaginationProps}
      />

      {/* 海报管理弹框 */}
      {postersTarget && (
        <PostersModal
          open={postersOpen}
          entityType={postersTarget.entityType}
          entityId={postersTarget.id}
          entityName={postersTarget.title}
          readOnly={!canOperate}
          onClose={() => {
            setPostersOpen(false)
            setPostersTarget(null)
          }}
        />
      )}
    </div>
  )
}
