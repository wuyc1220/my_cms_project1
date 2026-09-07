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
 *  - Action：详情（i）/ 编辑（笔图标）
 *  - 操作按钮：Excel Export（占位）/ Excel Import（占位）
 *  - 搜索区超过 2 行时默认折叠
 *

 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Button,
  Col,
  Image,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Upload,
  message,
} from 'antd'
import type { UploadFile } from 'antd'
import {
  DownloadOutlined,
  EditOutlined,
  FileExcelOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getVodContents, exportVodContentsExcel, importVodContentsExcel, downloadVodTemplate } from '../../api/vod'
import type { VodImportResultPayload } from '../../api/vod'
import { getGenres } from '../../api/genres'
import { getDictTree } from '../../api/dicts'
import type { DictNodeListItem } from '../../types/dict'
import { getMultiLanguageOptions } from '../../api/i18n'
import { getProvidersSimple } from '../../api/providers'
import { getPackages } from '../../api/packages'
import { getCustomTags } from '../../api/customTags'
import { getContentTypes } from '../../api/contentTypes'
import SearchForm from '../../components/SearchForm'
import ResizableTable from '../../components/ResizableTable'
import { EditContentModal } from '../../components/ContentModals'
import type { VodContentListItem, VodContentQueryParams } from '../../types/content'
import type { GenreListItem, CustomTagListItem, ContentTypeListItem } from '../../types/basic'
import type { PackageListItem } from '../../types/package'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'
import { isHandledError } from '../../api'

// ─── 常量 ────────────────────────────────────────────────────────────────────

const VOD_CONTENT_TYPES = [
  { label: 'MOVIE', value: 'MOVIE' },
  { label: 'SEASON_SERIES', value: 'SEASON_SERIES' },
  { label: 'SEASON', value: 'SEASON' },
  { label: 'SERIES', value: 'SERIES' },
  { label: 'EPISODE', value: 'EPISODE' },
]

// 注意：不包含 Expired（计算状态，无对应存储状态，筛选恒为空）
// Ingest Status 选项与名称映射由 Ingest_Status 字典动态加载（与 ContentManagement 一致）

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

// ─── 搜索表单值类型 ────────────────────────────────────────────────────────────

interface SearchValues {
  title?: string
  statuses?: string[]
  content_types?: string[]
  genre_ids?: number[]
  custom_tag_ids?: number[]
  deleted?: string
  type_ids?: number[]
  category_name?: string
  package_ids?: number[]
  provider_ids?: number[]
  license_start_range?: [dayjs.Dayjs, dayjs.Dayjs]
  license_end_range?: [dayjs.Dayjs, dayjs.Dayjs]
  unpublish_range?: [dayjs.Dayjs, dayjs.Dayjs]
  publish_range?: [dayjs.Dayjs, dayjs.Dayjs]
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function VodContents() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.vod.contents.operate')
  const locationState = location.state as { filters?: { contentType?: string[]; genre?: string[]; ingestStatus?: string; deleted?: string; license_end_from?: string; license_end_to?: string } } | undefined

  // 保存从首页传递的题材名称，等待 genreOptions 加载后转换为 ID
  const pendingGenreRef = useRef<string[] | null>(null)

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

  const [genreOptions, setGenreOptions] = useState<{ label: string; value: number }[]>([])
  const [providerOptions, setProviderOptions] = useState<{ label: string; value: number }[]>([])
  const [packageOptions, setPackageOptions] = useState<{ label: string; value: number }[]>([])
  const [customTagOptions, setCustomTagOptions] = useState<{ label: string; value: number }[]>([])
  const [typeOptions, setTypeOptions] = useState<{ label: string; value: number }[]>([])
  const [ingestStatusOptions, setIngestStatusOptions] = useState<{ label: string; value: string }[]>([])
  const [ingestStatusMap, setIngestStatusMap] = useState<Record<string, string>>({})

  // 海报 blob URL 映射（content_id -> blob_url）
  const [posterBlobUrls, setPosterBlobUrls] = useState<Record<number, string>>({})
  const blobUrlRefs = useRef<Set<string>>(new Set())

  // 编辑弹框
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editContentId, setEditContentId] = useState<number | null>(null)

  // 导出/导入状态
  const [exporting, setExporting] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFileList, setImportFileList] = useState<UploadFile[]>([])

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
      options: ingestStatusOptions,
    },
    {
      name: 'content_types',
      labelKey: 'common.col.contentType',
      type: 'multiSelect',
      options: VOD_CONTENT_TYPES,
    },
    {
      name: 'genre_ids',
      labelKey: 'common.col.genre',
      type: 'multiSelect',
      render: () => (
        <Select
          mode="multiple"
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
      render: () => (
        <Select
          mode="multiple"
          placeholder={t('common.placeholder.select')}
          options={customTagOptions}
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
      render: () => (
        <Select
          mode="multiple"
          placeholder={t('common.placeholder.select')}
          options={typeOptions}
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
      name: 'category_name',
      labelKey: 'common.col.category',
      type: 'input',
      placeholderKey: 'common.placeholder.keyword',
    },
    {
      name: 'package_ids',
      labelKey: 'common.col.package',
      type: 'multiSelect',
      render: () => (
        <Select
          mode="multiple"
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
      name: 'provider_ids',
      labelKey: 'common.col.provider',
      type: 'multiSelect',
      render: () => (
        <Select
          mode="multiple"
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
      name: 'publish_range',
      labelKey: 'common.col.publishDate',
      type: 'dateRange',
    },
    {
      name: 'unpublish_range',
      labelKey: 'common.col.unpublishDate',
      type: 'dateRange',
    },
  ], [genreOptions, customTagOptions, typeOptions, packageOptions, providerOptions, ingestStatusOptions, t])

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
    defaultValues: {
      deleted: 'NO',
    },
    onSearch: async (values) => {
      const params: VodContentQueryParams = {}
      if (values.title) params.title = values.title
      if (values.statuses?.length) params.statuses = values.statuses
      if (values.content_types?.length) params.content_types = values.content_types
      if (values.genre_ids?.length) params.genre_ids = values.genre_ids
      if (values.custom_tag_ids?.length) params.custom_tag_ids = values.custom_tag_ids
      if (values.deleted) params.deleted = values.deleted
      if (values.type_ids?.length) params.type_ids = values.type_ids
      if (values.category_name) params.category_name = values.category_name
      if (values.package_ids?.length) params.package_ids = values.package_ids
      if (values.provider_ids?.length) params.provider_ids = values.provider_ids
      if (values.license_start_range?.[0]) {
        params.license_start_from = values.license_start_range[0].format('YYYY-MM-DD')
        params.license_start_to = values.license_start_range[1].format('YYYY-MM-DD')
      }
      if (values.license_end_range?.[0]) {
        params.license_end_from = values.license_end_range[0].format('YYYY-MM-DD')
        params.license_end_to = values.license_end_range[1].format('YYYY-MM-DD')
      }
      if (values.unpublish_range?.[0]) {
        params.unpublish_from = values.unpublish_range[0].format('YYYY-MM-DD')
        params.unpublish_to = values.unpublish_range[1].format('YYYY-MM-DD')
      }
      if (values.publish_range?.[0]) {
        params.publish_from = values.publish_range[0].format('YYYY-MM-DD')
        params.publish_to = values.publish_range[1].format('YYYY-MM-DD')
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
      const { contentType, genre, ingestStatus, deleted, license_end_from, license_end_to } = locationState.filters
      const initialValues: SearchValues = {}
      if (contentType?.length) {
        initialValues.content_types = contentType
      }
      if (ingestStatus) {
        initialValues.statuses = [ingestStatus]
      }
      if (deleted) {
        initialValues.deleted = deleted
      }
      if (license_end_from && license_end_to) {
        initialValues.license_end_range = [dayjs(license_end_from), dayjs(license_end_to)]
      }
      // 处理题材：如果 genreOptions 已加载，则直接转换；否则保存到 ref 等待后续处理
      let genrePending = false
      if (genre?.length) {
        if (genreOptions.length > 0) {
          const genreIds = genre.map(g => genreOptions.find(opt => opt.label === g)?.value).filter((v): v is number => v !== undefined)
          if (genreIds.length) {
            initialValues.genre_ids = genreIds
          }
        } else {
          pendingGenreRef.current = genre
          genrePending = true
        }
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
      if (initialValues.genre_ids?.length) {
        params.genre_ids = initialValues.genre_ids
      }
      if (deleted) {
        params.deleted = deleted
      }
      if (license_end_from && license_end_to) {
        params.license_end_from = license_end_from
        params.license_end_to = license_end_to
      }
      setFilters(params)
      // 题材待解析时跳过本次加载，等 genreOptions 加载后由 pendingGenreRef 统一处理，
      // 避免发出无 genre_ids 的请求与后续带 genre_ids 的请求产生竞态导致结果被覆盖
      if (genrePending) {
        navigate(location.pathname, { replace: true })
        return
      }
      void loadList(1, pagination.pageSize, params, null, null)
      // 清除 location state，避免刷新页面时重复应用
      navigate(location.pathname, { replace: true })
    }
  }, [locationState, genreOptions])

  // ─── 初始化 ───────────────────────────────────────────────────────────────

  useEffect(() => {
    void loadOptions()
    if (!locationState?.filters) {
      // 设置默认值
      searchForm.setFieldsValue({ deleted: 'NO' })
      // 使用默认值进行搜索
      const params: VodContentQueryParams = { deleted: 'NO' }
      setFilters(params)
      void loadList(1, pagination.pageSize, params, null, null)
    }
  }, [])

  // 清理 blob URL，避免内存泄漏
  const revokeAllBlobUrls = useCallback(() => {
    blobUrlRefs.current.forEach((url) => URL.revokeObjectURL(url))
    blobUrlRefs.current.clear()
  }, [])

  useEffect(() => {
    return () => { revokeAllBlobUrls() }
  }, [revokeAllBlobUrls])

  const loadOptions = async () => {
    try {
      const langOptions = await getMultiLanguageOptions()
      const defaultLang = langOptions.length > 0 ? langOptions[0].code : undefined
      const langFilter = defaultLang ? [defaultLang] : undefined
      const [genres, providers, packages, customTags, types, dicts] = await Promise.all([
        getGenres({ page: 1, page_size: 500, languages: langFilter }),
        getProvidersSimple(),
        getPackages({ page: 1, page_size: 500 }),
        getCustomTags({ page: 1, page_size: 500 }),
        getContentTypes({ page: 1, page_size: 500 }),
        getDictTree(),
      ])
      setGenreOptions(genres.items.map((g: GenreListItem) => ({ label: g.name, value: g.id })))
      setProviderOptions(providers.map((p) => ({ label: p.name, value: p.id })))
      setPackageOptions(packages.items.map((p: PackageListItem) => ({ label: p.name, value: p.id })))
      setCustomTagOptions(customTags.items.map((ct: CustomTagListItem) => ({ label: ct.name, value: ct.id })))
      setTypeOptions(types.items.map((t: ContentTypeListItem) => ({ label: t.name, value: t.id })))

      const ingestRoot = dicts.find((d: DictNodeListItem) => d.code === 'Ingest_Status')
      if (ingestRoot?.children) {
        setIngestStatusOptions(ingestRoot.children.map((c: DictNodeListItem) => ({ label: c.name, value: c.code })))
        const map: Record<string, string> = {}
        ingestRoot.children.forEach((c: DictNodeListItem) => { map[c.code] = c.name })
        setIngestStatusMap(map)
      }
    } catch (err) {
      // 不阻塞主流程
    }
  }

  // ─── 处理待处理的题材（genreOptions 加载完成后）────────────────────────────

  useEffect(() => {
    if (pendingGenreRef.current?.length && genreOptions.length > 0) {
      const genreIds = pendingGenreRef.current.map(g => genreOptions.find(opt => opt.label === g)?.value).filter((v): v is number => v !== undefined)
      if (genreIds.length) {
        // 设置表单值
        searchForm.setFieldsValue({ genre_ids: genreIds })
        // 更新 filters 并重新搜索
        setFilters(prev => {
          const newFilters = { ...prev, genre_ids: genreIds }
          void loadList(1, pagination.pageSize, newFilters, null, null)
          return newFilters
        })
      }
      pendingGenreRef.current = null
    }
  }, [genreOptions])

  // 异步加载海报 blob URL（不阻塞列表 loading，参考 CastManagement 的实现）
  const fetchPosterBlobUrls = useCallback(async (items: VodContentListItem[]) => {
    const token = localStorage.getItem('token')
    const entries = await Promise.all(
      items.filter((item) => item.poster_url).map(async (item) => {
        try {
          const resp = await fetch(item.poster_url!, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
          if (!resp.ok) return null
          const blobUrl = URL.createObjectURL(await resp.blob())
          blobUrlRefs.current.add(blobUrl)
          return [item.id, blobUrl] as const
        } catch {
          return null
        }
      }),
    )
    const map: Record<number, string> = {}
    entries.forEach((entry) => { if (entry) map[entry[0]] = entry[1] })
    setPosterBlobUrls(map)
  }, [])

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
      revokeAllBlobUrls()
      // 异步加载海报，不阻塞表格 loading，海报加载完成后渐进显示
      void fetchPosterBlobUrls(res.items)
    } catch (err) {
      // 错误已由 API 拦截器统一处理
    } finally {
      setLoading(false)
    }
  }


  // ─── 导出处理 ───────────────────────────────────────────────────────────────

  const handleExport = async () => {
    if (selectedRowKeys.length === 0) return
    setExporting(true)
    try {
      const blob = await exportVodContentsExcel(selectedRowKeys)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `VOD_Contents_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      void message.success(t('vod.msg.exportSuccess'))
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('vod.msg.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  // ─── 导入处理 ───────────────────────────────────────────────────────────────

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadVodTemplate()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'VOD_Import_Template.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      void message.success(t('vod.msg.templateDownloaded'))
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('vod.msg.templateDownloadFailed'))
    }
  }

  const handleImport = async (file: File) => {
    if (!canOperate) return
    setImporting(true)
    try {
      const result = await importVodContentsExcel(file)
      handleImportResult(result)
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      void message.error(detail || t('vod.msg.importFailed'), 5)
    } finally {
      setImporting(false)
      setImportFileList([])
    }
  }

  const handleImportResult = (result: VodImportResultPayload) => {
    const skippedInfo = result.skipped ? `, ${t('vod.msg.importSkipped', { skipped: result.skipped })}` : ''
    if (result.errors && result.errors.length > 0) {
      const errorLines = result.errors
        .map((e) => e.errors.map((msg) => t('vod.msg.importValidationErrorDetail', { row: e.row, error: msg })).join('\n'))
        .join('\n')
      Modal.warning({
        title: t('vod.msg.importValidationError'),
        width: 640,
        content: (
          <div style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
            <div>
              {t('vod.msg.importSuccess')} (total: {result.total}, created: {result.created}, updated: {result.updated}{skippedInfo})
            </div>
            <div style={{ marginTop: 8, color: '#ff4d4f' }}>{errorLines}</div>
          </div>
        ),
      })
    } else {
      void message.success(
        `${t('vod.msg.importSuccess')} (total: ${result.total}, created: ${result.created}, updated: ${result.updated}${skippedInfo})`,
      )
    }
    void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
    setImportModalOpen(false)
  }

  const getContentDetailPath = (record: VodContentListItem, options?: { mode?: string }) => {
    const ct = record.content_type
    const params = new URLSearchParams({ source: 'vod_management' })
    if (options?.mode) params.set('mode', options.mode)
    if (ct === 'CHANNEL') return `/live/channels/${record.id}?${params.toString()}`
    if (ct === 'SCHEDULE') return `/live/schedules/${record.id}?${params.toString()}`
    return `/contents/${record.id}?${params.toString()}`
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
            style={{ objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
            preview
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
              border: '1px dashed #d9d9d9',
            }}
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
            onClick={() => navigate(getContentDetailPath(record, { mode: record.is_discarded ? undefined : 'edit' }))}
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
        <Tooltip title={ingestStatusMap[v] ?? v}>
          <Tag color={STATUS_COLOR[v] ?? 'default'}>{ingestStatusMap[v] ?? v}</Tag>
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
      render: (names?: string[]) => {
        const text = names?.length ? names.join(', ') : '—'
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

      {/* 工具栏 */}
      <Row justify="end" style={{ marginBottom: 12 }}>
        <Col>
          <Space>
            <Button
              icon={<DownloadOutlined />}
              loading={exporting}
              disabled={selectedRowKeys.length === 0}
              onClick={handleExport}
            >
              {t('common.btn.excelExport')}
            </Button>
            {canOperate && (
              <Button
                icon={<UploadOutlined />}
                onClick={() => setImportModalOpen(true)}
              >
                {t('common.btn.excelImport')}
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      <ResizableTable<VodContentListItem>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={contents}
        loading={loading}
        scroll={{ x: 1800, y: 550 }}
        onChange={handleTableChange}
        rowSelection={{
          type: 'checkbox',
          fixed: true,
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as number[]),
        }}
        pagination={tablePaginationProps}
      />

      {/* 导入弹框 */}
      <Modal
        title={t('vod.importModal.title')}
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        footer={null}
        destroyOnHidden
        width={560}
      >
        <div style={{ padding: '24px 0' }}>
          <div style={{ marginBottom: 24, padding: 16, background: '#f5f5f5', borderRadius: 6 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              <FileExcelOutlined style={{ marginRight: 8, color: '#52c41a' }} />
              {t('vod.importModal.templateSectionTitle')}
            </div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
              {t('vod.importModal.templateSectionDesc')}
            </div>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownloadTemplate}
              size="small"
            >
              {t('common.btn.downloadTemplate')}
            </Button>
          </div>
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              <UploadOutlined style={{ marginRight: 8, color: '#1890ff' }} />
              {t('vod.importModal.uploadSectionTitle')}
            </div>
            <Upload
              accept=".xlsx,.xls"
              fileList={importFileList}
              maxCount={1}
              showUploadList={false}
              beforeUpload={() => false}
              onChange={({ file }) => {
                // antd v6: beforeUpload 返回 false 时, file 已经是原生 File 对象
                const f = file as unknown as File
                if (!f.name) return
                setImportFileList([file])
                void handleImport(f)
              }}
            >
              <Button icon={<UploadOutlined />} loading={importing}>
                {importing ? t('vod.importModal.importing') : t('vod.importModal.chooseFileButton')}
              </Button>
            </Upload>
            <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              {t('vod.importModal.fileFormatHint')}
            </div>
          </div>
        </div>
      </Modal>

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
