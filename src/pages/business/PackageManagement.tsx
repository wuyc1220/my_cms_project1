import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Divider,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  addContentsToPackage,
  batchDeletePackages,
  deletePackage,
  getAvailableContents,
  getPackageContents,
  getPackages,
  removeContentFromPackage,
  exportPackagesExcel,
  syncPackages,
} from '../../api/packages'
import type { PackageSyncResponse } from '../../api/packages'
import { isHandledError } from '../../api'
import { getDictTree } from '../../api/dicts'
import { getGenres } from '../../api/genres'
import { getCustomTags } from '../../api/customTags'
import { getMultiLanguageOptions } from '../../api/i18n'
import { useI18n } from '../../i18n/useI18n'
import PackageCreateModal from '../../components/PackageCreateModal'
import PackageImportModal from '../../components/PackageImportModal'
import ObjectIngestHistoryModal from '../../components/ObjectIngestHistoryModal'
import SearchForm from '../../components/SearchForm'
import TrimInput from '../../components/TrimInput'
import type {
  ContentSimpleItem,
  PackageListItem,
  PaginatedResponse,
} from '../../types/package'
import type { DictNodeListItem } from '../../types/dict'
import type { SearchFieldConfig } from '../../types/searchForm'
import type { GenreListItem, CustomTagListItem } from '../../types/basic'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'

// ─── 辅助函数 ─────────────────────────────────────────────────────────

const getIngestTagColor = (val: string) => {
  if (val === 'success') return 'success'
  if (val === 'failure') return 'error'
  if (val === 'processing') return 'processing'
  return 'default'
}

// ─── 主组件 ────────────────────────────────────────────────────────────

interface SearchValues extends Record<string, unknown> {
  name?: string
  package_type?: string
  platforms?: string[]
  ingest_statuses?: string[]
  description?: string
}

export default function PackageManagement() {
  const navigate = useNavigate()
  const { t } = useI18n()

  // 列表状态
  const [list, setList] = useState<PackageListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filters, sortField, sortOrder)
    },
  })

  // 下拉选项
  const [packageTypeOptions, setPackageTypeOptions] = useState<{ label: string; value: string }[]>([])
  const [packageTypeMap, setPackageTypeMap] = useState<Record<string, string>>({})
  const [platformOptions, setPlatformOptions] = useState<{ label: string; value: string }[]>([])
  const [platformMap, setPlatformMap] = useState<Record<string, string>>({})
  const [ingestStatusOptions, setIngestStatusOptions] = useState<{ label: string; value: string }[]>([])

  // 新增/编辑弹框
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<PackageListItem | null>(null)

  // Ingest 历史弹框
  const [historyModal, setHistoryModal] = useState<{ open: boolean; record: PackageListItem | null }>({ open: false, record: null })

  // Add Content to Package 弹框
  const [addContentModal, setAddContentModal] = useState<{ open: boolean; record: PackageListItem | null }>({
    open: false,
    record: null,
  })
  const [availableContents, setAvailableContents] = useState<PaginatedResponse<ContentSimpleItem>>({
    total: 0,
    page: 1,
    page_size: 10,
    items: [],
  })
  const [availableLoading, setAvailableLoading] = useState(false)
  const [addContentSearch, setAddContentSearch] = useState('')
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>([])
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([])
  const [selectedCustomTagIds, setSelectedCustomTagIds] = useState<number[]>([])
  const [genreOptions, setGenreOptions] = useState<{ label: string; value: number }[]>([])
  const [customTagOptions, setCustomTagOptions] = useState<{ label: string; value: number }[]>([])
  const [packageContents, setPackageContents] = useState<ContentSimpleItem[]>([])
  const [pendingAdd, setPendingAdd] = useState<ContentSimpleItem[]>([]) // 待保存的新增项
  const [pendingRemoveIds, setPendingRemoveIds] = useState<number[]>([]) // 待保存的移除项（仅 ID，提交时才调用后端）
  const [savingContents, setSavingContents] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const { hasPermission } = usePermission()
  const canView = hasPermission('menu.business.packages.view') || hasPermission('menu.business.packages.operate')
  const canOperate = hasPermission('menu.business.packages.operate')

  // ─── 搜索字段配置 ─────────────────────────────────────────────────────

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'name',
      labelKey: 'package.col.name',
      type: 'input',
      placeholderKey: 'package.placeholder.name',
    },
    {
      name: 'package_type',
      labelKey: 'package.col.type',
      type: 'select',
      placeholderKey: 'package.placeholder.type',
      options: packageTypeOptions,
    },
    {
      name: 'platforms',
      labelKey: 'package.col.platform',
      type: 'multiSelect',
      placeholderKey: 'package.placeholder.platform',
      options: platformOptions,
    },
    {
      name: 'ingest_statuses',
      labelKey: 'package.col.ingestStatus',
      type: 'multiSelect',
      placeholderKey: 'common.placeholder.select',
      options: ingestStatusOptions,
    },
    {
      name: 'description',
      labelKey: 'package.col.description',
      type: 'input',
      placeholderKey: 'package.placeholder.description',
    },
  ], [packageTypeOptions, platformOptions])

  // ─── 使用 useSearchForm Hook ─────────────────────────────────────────────

  const {
    form: searchForm,
    filters,
    expanded,
    setExpanded,
    showExpand,
    handleSearch,
    handleReset,
  } = useSearchForm<SearchValues>({
    onSearch: (values) => {
      setSelectedIds([])
      resetSort()
      void loadList(1, pagination.pageSize, values, null, null)
    },
    onReset: () => {
      setSelectedIds([])
      resetSort()
      void loadList(1, pagination.pageSize, {}, null, null)
    },
    fieldsCount: searchFields.length,
  })

  // ─── 初始化 ──────────────────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      const dicts = await getDictTree()
      const pkgTypeRoot = dicts.find((d: DictNodeListItem) => d.code === 'Package_Type')
      const platformRoot = dicts.find((d: DictNodeListItem) => d.code === 'Platform')
      const pkgTypeChildren = pkgTypeRoot?.children ?? []
      setPackageTypeOptions(pkgTypeChildren.map((c: DictNodeListItem) => ({ label: c.name, value: c.code })))
      setPackageTypeMap(Object.fromEntries(pkgTypeChildren.map((c: DictNodeListItem) => [c.code, c.name])))
      const platformChildren = platformRoot?.children ?? []
      setPlatformOptions(platformChildren.map((c: DictNodeListItem) => ({ label: c.name, value: c.code })))
      setPlatformMap(Object.fromEntries(platformChildren.map((c: DictNodeListItem) => [c.code, c.name])))
      setIngestStatusOptions([
        { label: t('common.ingestStatus.none'), value: 'none' },
        { label: t('common.ingestStatus.processing'), value: 'processing' },
        { label: t('common.ingestStatus.success'), value: 'success' },
        { label: t('common.ingestStatus.failure'), value: 'failure' },
      ])
      await loadList(1, 10, {})
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── 列表加载 ─────────────────────────────────────────────────────────

  const loadList = async (page = pagination.current, pageSize = pagination.pageSize, nextFilters = filters, nextSortField?: string | null, nextSortOrder?: 'ascend' | 'descend' | null) => {
    setLoading(true)
    try {
      const data = await getPackages({
        page,
        page_size: pageSize,
        name: nextFilters.name,
        package_type: nextFilters.package_type,
        platforms: nextFilters.platforms,
        ingest_statuses: nextFilters.ingest_statuses,
        description: nextFilters.description,
        sort_by: nextSortField ?? undefined,
        sort_order: nextSortOrder === 'ascend' ? 'asc' : nextSortOrder === 'descend' ? 'desc' : undefined,
      })
      setList(data.items)
      updatePagination(data)
    } finally {
      setLoading(false)
    }
  }


  // ─── 批量发布 ─────────────────────────────────────────────────────────

  const handleSync = async () => {
    if (selectedIds.length === 0) {
      void message.info(t('package.msg.noSelection'), 3)
      return
    }
    setSyncing(true)
    try {
      const result: PackageSyncResponse = await syncPackages({ package_ids: selectedIds })
      if (result.success) {
        void message.success(result.message || t('package.msg.syncSuccess'), 3)
      } else {
        void message.error(result.message, 5)
      }
      void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('package.msg.syncFailed'), 5)
    } finally {
      setSyncing(false)
    }
  }

  // ─── 新增/编辑 ────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingRecord(null)
    setModalOpen(true)
  }

  const openEdit = (record: PackageListItem) => {
    setEditingRecord(record)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingRecord(null)
  }

  // ─── 删除 ─────────────────────────────────────────────────────────────

  const handleDelete = async (record: PackageListItem) => {
    await deletePackage(record.id)
    void message.success(t('common.msg.deleted'), 3)
    setSelectedIds(prev => prev.filter(id => id !== record.id))
    void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    const total = selectedIds.length
    // 后端会跳过存在关联内容的服务包，返回实际删除数，提示需与实际结果一致
    const { deleted } = await batchDeletePackages({ ids: selectedIds })
    const skipped = total - deleted
    if (deleted === 0) {
      void message.warning(t('package.msg.batchDeleteNone'), 5)
    } else if (skipped > 0) {
      void message.warning(t('package.msg.batchDeletePartial', { deleted, skipped }), 5)
    } else {
      void message.success(t('package.msg.batchDeleted', { count: deleted }), 3)
    }
    setSelectedIds([])
    void loadList(1, pagination.pageSize, filters, sortField, sortOrder)
  }

  // ─── Add Content to Package 弹框 ──────────────────────────────────────

  const openAddContent = async (record: PackageListItem) => {
    setAddContentModal({ open: true, record })
    setAddContentSearch('')
    setSelectedContentTypes([])
    setSelectedGenreIds([])
    setSelectedCustomTagIds([])
    setPendingAdd([])
    void loadPackageContents(record.id)
    void loadAvailableContents(record.id, 1, '', [], [], [])
    // 加载题材和自定义标签选项
    void loadGenreOptions()
    void loadCustomTagOptions()
  }

  const loadGenreOptions = async () => {
    try {
      // 获取数据字典 Multi_Languages 第一语言进行过滤
      const langOptions = await getMultiLanguageOptions()
      const defaultLang = langOptions.length > 0 ? langOptions[0].code : undefined
      const langFilter = defaultLang ? [defaultLang] : undefined

      // 先尝试带语言过滤查询
      let res = await getGenres({ page: 1, page_size: 1000, languages: langFilter })

      // 如果带语言过滤没有数据，尝试不带语言过滤再查询
      if (res.items.length === 0 && langFilter) {
        res = await getGenres({ page: 1, page_size: 1000 })
      }

      setGenreOptions(res.items.map((g: GenreListItem) => ({ label: g.name, value: g.id })))
    } catch {
      setGenreOptions([])
    }
  }

  const loadCustomTagOptions = async () => {
    try {
      const res = await getCustomTags({ page: 1, page_size: 1000 })
      setCustomTagOptions(res.items.map((t: CustomTagListItem) => ({ label: t.name, value: t.id })))
    } catch {
      setCustomTagOptions([])
    }
  }

  const loadPackageContents = async (packageId: number) => {
    const res = await getPackageContents(packageId, { page: 1, page_size: 1000 })
    setPackageContents(res.items)
  }

  const loadAvailableContents = async (
    packageId: number,
    page: number,
    search: string,
    contentTypes: string[] = [],
    genreIds: number[] = [],
    customTagIds: number[] = [],
    pageSize = 10,
  ) => {
    setAvailableLoading(true)
    try {
      const data = await getAvailableContents(packageId, {
        page,
        page_size: pageSize,
        title: search || undefined,
        content_types: contentTypes.length > 0 ? contentTypes : undefined,
        genre_ids: genreIds.length > 0 ? genreIds : undefined,
        custom_tag_ids: customTagIds.length > 0 ? customTagIds : undefined,
      })
      setAvailableContents(data)
    } finally {
      setAvailableLoading(false)
    }
  }

  const handleAddContentSearch = () => {
    if (addContentModal.record) {
      void loadAvailableContents(
        addContentModal.record.id,
        1,
        addContentSearch,
        selectedContentTypes,
        selectedGenreIds,
        selectedCustomTagIds,
      )
    }
  }

  const handleResetAddContentFilters = () => {
    setAddContentSearch('')
    setSelectedContentTypes([])
    setSelectedGenreIds([])
    setSelectedCustomTagIds([])
    if (addContentModal.record) {
      void loadAvailableContents(addContentModal.record.id, 1, '', [], [], [])
    }
  }

  // 将左侧内容加入右侧待保存列表
  const handleQueueContent = (content: ContentSimpleItem) => {
    const alreadyInPackage = packageContents.some((c) => c.id === content.id)
    const alreadyPending = pendingAdd.some((c) => c.id === content.id)
    if (alreadyInPackage || alreadyPending) {
      void message.warning(t('package.msg.contentInPackage'), 3)
      return
    }
    setPendingAdd((prev) => [...prev, content])
  }

  // 从右侧待保存列表移除（未保存的）
  const handleRemovePending = (contentId: number) => {
    setPendingAdd((prev) => prev.filter((c) => c.id !== contentId))
  }

  // 从已关联列表移除（临时，不调用后端，提交时才生效）
  const handleRemoveLinked = (contentId: number) => {
    setPendingRemoveIds((prev) => (prev.includes(contentId) ? prev : [...prev, contentId]))
    setPackageContents((prev) => prev.filter((c) => c.id !== contentId))
  }

  const handleSaveContents = async () => {
    if (!addContentModal.record) return
    if (pendingAdd.length === 0 && pendingRemoveIds.length === 0) return
    setSavingContents(true)
    try {
      // 先处理移除（逐个调用后端）
      for (const cid of pendingRemoveIds) {
        await removeContentFromPackage(addContentModal.record.id, cid)
      }
      // 再处理新增（批量调用后端，返回最新关联列表）
      let updated: ContentSimpleItem[] = packageContents
      if (pendingAdd.length > 0) {
        updated = await addContentsToPackage(addContentModal.record.id, {
          content_ids: pendingAdd.map((c) => c.id),
        })
      }
      setPackageContents(updated)
      setPendingAdd([])
      setPendingRemoveIds([])
      void message.success(t('common.msg.saveSuccess'), 3)
      closeAddContent()
      // 刷新左侧可选列表（排除已关联）
      void loadAvailableContents(
        addContentModal.record.id,
        availableContents.page,
        addContentSearch,
        selectedContentTypes,
        selectedGenreIds,
        selectedCustomTagIds,
      )
    } finally {
      setSavingContents(false)
    }
  }

  const closeAddContent = () => {
    setAddContentModal({ open: false, record: null })
    setPackageContents([])
    setPendingAdd([])
    setPendingRemoveIds([])
    setAddContentSearch('')
    setSelectedContentTypes([])
    setSelectedGenreIds([])
    setSelectedCustomTagIds([])
    setGenreOptions([])
    setCustomTagOptions([])
  }

  // ─── 表格列定义 ────────────────────────────────────────────────────────

  const columns: ColumnsType<PackageListItem> = [
    {
      title: t('package.col.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'name' ? sortOrder : null,
      render: (val: string) => <Tooltip title={val}><span>{val}</span></Tooltip>,
    },
    {
      title: t('package.col.type'),
      dataIndex: 'package_type',
      key: 'package_type',
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'package_type' ? sortOrder : null,
      render: (val: string | null) => {
        const label = val ? (packageTypeMap[val] ?? val) : '—'
        return <Tooltip title={label}><span>{label}</span></Tooltip>
      },
    },
    {
      title: t('package.col.platform'),
      dataIndex: 'platforms',
      key: 'platforms',
      width: 360,
      sorter: true,
      sortOrder: sortField === 'platforms' ? sortOrder : null,
      render: (vals: string[] | null) => (
        (vals ?? []).length === 0
          ? '—'
          : (
            <Space size={4} wrap>
              {(vals ?? []).map((v) => <Tag key={v}>{platformMap[v] ?? v}</Tag>)}
            </Space>
          )
      ),
    },
    {
      title: t('package.col.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'description' ? sortOrder : null,
      render: (val: string | null) => (
        <Tooltip title={val ?? ''}><span>{val ?? '—'}</span></Tooltip>
      ),
    },
    {
      title: t('package.col.ingestStatus'),
      dataIndex: 'ingest_status',
      key: 'ingest_status',
      width: 160,
      sorter: true,
      sortOrder: sortField === 'ingest_status' ? sortOrder : null,
      render: (val: string | null, record: PackageListItem) => {
        const displayVal = val ?? 'None'
        return (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => setHistoryModal({ open: true, record })}
          >
            <Tag color={getIngestTagColor(displayVal)} style={{ cursor: 'pointer', margin: 0 }}>{t(`common.ingestStatus.${displayVal}` as any)}</Tag>
          </Button>
        )
      },
    },
    {
      title: t('package.col.action'),
      key: 'action',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space size={0}>
          {canView && (
            <Tooltip title={t('package.action.detail')}>
              <Button
                type="link"
                size="small"
                icon={<InfoCircleOutlined />}
                onClick={() => navigate(`/business/packages/${record.id}`)}
              />
            </Tooltip>
          )}
          {canOperate && (
            <Tooltip title={t('package.action.addContent')}>
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => openAddContent(record)}
              />
            </Tooltip>
          )}
          {canOperate && (
            <Tooltip title={t('package.action.edit')}>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              />
            </Tooltip>
          )}
          {canOperate && (
            <Popconfirm
              title={t('common.confirmDelete', { name: record.name })}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              onConfirm={() => void handleDelete(record)}
            >
              <Tooltip title={t('package.action.delete')}>
                <Button type="link" size="small" icon={<DeleteOutlined />} danger />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const getContentDetailPath = (row: ContentSimpleItem) => {
    const ct = row.content_type
    if (ct === 'CHANNEL') return `/live/channels/${row.id}`
    if (ct === 'SCHEDULE') return `/live/schedules/${row.id}`
    return `/contents/${row.id}`
  }

  const availableColumns: ColumnsType<ContentSimpleItem> = [
    {
      title: t('package.addContent.contentName'),
      dataIndex: 'title',
      key: 'title',
      ellipsis: { showTitle: false },
      render: (val: string, row: ContentSimpleItem) => (
        <Tooltip title={val}>
          <Button
            type="link"
            size="small"
            style={{ padding: 0, textAlign: 'left' }}
            onClick={() => navigate(getContentDetailPath(row))}
          >
            {val}
          </Button>
        </Tooltip>
      ),
    },
    { title: t('package.addContent.contentType'), dataIndex: 'content_type', key: 'content_type', width: 90 },
    {
      title: t('package.addContent.genre'),
      dataIndex: 'genre',
      key: 'genre',
      width: 100,
      render: (val: string | null) => val || '—',
    },
    {
      title: t('package.addContent.customTags'),
      dataIndex: 'custom_tags',
      key: 'custom_tags',
      width: 220,
      render: (val: string[] | undefined) => {
        if (!val || val.length === 0) return '—'
        return (
          <Space size={2} wrap>
            {val.slice(0, 2).map((tag, idx) => (
              <Tag key={idx}>{tag}</Tag>
            ))}
            {val.length > 2 && <Tag>+{val.length - 2}</Tag>}
          </Space>
        )
      },
    },
    {
      title: t('package.addContent.status'),
      dataIndex: 'status',
      key: 'status',
      width: 220,
      render: (val: string) => <Tag color={val === 'Published' ? 'success' : 'default'}>{val}</Tag>,
    },
    {
      title: t('package.addContent.license'),
      key: 'license',
      width: 70,
      render: (_, row) =>
        row.has_license ? (
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
        ) : (
          <ExclamationCircleOutlined style={{ color: '#d9d9d9' }} />
        ),
    },
    {
      title: t('package.addContent.action'),
      key: 'action',
      width: 70,
      render: (_, row) => {
        const isInPackage = packageContents.some((c) => c.id === row.id)
        const isPending = pendingAdd.some((c) => c.id === row.id)
        const isDisabled = isInPackage || isPending
        return (
          <Tooltip title={t('common.add')}>
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              disabled={isDisabled}
              onClick={() => handleQueueContent(row)}
            />
          </Tooltip>
        )
      },
    },
  ]

  // ─── JSX ─────────────────────────────────────────────────────────────

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
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
          {canOperate && (
            <Popconfirm
              title={t('common.confirmDeleteSelected', { count: selectedIds.length })}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              onConfirm={() => void handleBatchDelete()}
              disabled={selectedIds.length === 0}
            >
              <Button danger disabled={selectedIds.length === 0}>
                {t('common.batchDelete')}{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
              </Button>
            </Popconfirm>
          )}
          {canOperate && (
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              loading={syncing}
              disabled={selectedIds.length === 0}
              onClick={() => void handleSync()}
            >
              {t('package.toolbar.syncBtn')}{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
            </Button>
          )}
          <Button
            icon={<DownloadOutlined />}
            disabled={selectedIds.length === 0}
            onClick={async () => {
              try {
                const blob = await exportPackagesExcel(selectedIds)
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `packages_${Date.now()}.xlsx`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                window.URL.revokeObjectURL(url)
                void message.success(t('package.msg.exportSuccess'))
              } catch (err) {
                if (isHandledError(err)) return
                void message.error(t('package.msg.exportFailed'))
              }
            }}
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
          {canOperate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {t('package.toolbar.newPackage')}
            </Button>
          )}
        </div>

        <Table<PackageListItem>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={list}
          scroll={{ x: 900 }}
          onChange={handleTableChange}
          rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as number[]) }}
          pagination={tablePaginationProps}
          size="small"
        />

      {/* ── 新增/编辑弹框 ──────────────────────────────────────────────── */}
      <PackageCreateModal
        open={modalOpen}
        editingRecord={editingRecord}
        packageTypeOptions={packageTypeOptions}
        platformOptions={platformOptions}
        onClose={closeModal}
        onSuccess={() => {
          void loadList(
            editingRecord ? pagination.current : 1,
            pagination.pageSize,
            filters,
            sortField,
            sortOrder,
          )
        }}
      />

      {/* ── Add Content to Package 弹框 ───────────────────────────────────── */}
      <Modal
        title={`${t('package.addContent.title')} — ${addContentModal.record?.name ?? ''}`}
        open={addContentModal.open}
        onCancel={closeAddContent}
        footer={
          <Space>
            <Button onClick={closeAddContent}>{t('common.cancel')}</Button>
            <Button
              type="primary"
              loading={savingContents}
              disabled={pendingAdd.length === 0 && pendingRemoveIds.length === 0}
              onClick={() => void handleSaveContents()}
            >
              {t('common.confirm')}
            </Button>
          </Space>
        }
        width={'80%'}
        destroyOnHidden
      >
        <div style={{ display: 'flex', gap: 16, height: 500 }}>
          {/* 左侧：可选内容 */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <Space style={{ marginBottom: 12 }} wrap>
              <TrimInput
                placeholder={t('license.addContent.contentName')}
                value={addContentSearch}
                onChange={(e) => setAddContentSearch(e.target.value)}
                onPressEnter={handleAddContentSearch}
                style={{ width: 220 }}
              />
              <Select
                mode="multiple"
                maxTagCount="responsive"
                placeholder={t('package.addContent.contentType')}
                value={selectedContentTypes}
                onChange={(value) => {
                  setSelectedContentTypes(value as string[])
                }}
                options={[
                  { label: t('publish.contentType.MOVIE'), value: 'MOVIE' },
                  { label: t('publish.contentType.EPISODE'), value: 'EPISODE' },
                  { label: t('publish.contentType.SERIES'), value: 'SERIES' },
                  { label: t('publish.contentType.SEASON'), value: 'SEASON' },
                  { label: t('publish.contentType.SEASON_SERIES'), value: 'SEASON_SERIES' },
                  { label: t('publish.contentType.CHANNEL'), value: 'CHANNEL' },
                  { label: t('publish.contentType.SCHEDULE'), value: 'SCHEDULE' },
                ]}
                style={{ width: 220 }}
              />
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                allowClear
                maxTagCount="responsive"
                placeholder={t('package.addContent.genre')}
                value={selectedGenreIds}
                onChange={(values) => {
                  setSelectedGenreIds(values as number[])
                }}
                options={genreOptions}
                style={{ width: 220 }}
              />
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                allowClear
                maxTagCount="responsive"
                placeholder={t('package.addContent.customTags')}
                value={selectedCustomTagIds}
                onChange={(values) => {
                  setSelectedCustomTagIds(values as number[])
                }}
                options={customTagOptions}
                style={{ width: 220 }}
              />
              <Button onClick={handleResetAddContentFilters}>{t('common.reset')}</Button>
              <Button onClick={handleAddContentSearch}>{t('common.search')}</Button>
            </Space>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <Table<ContentSimpleItem>
                rowKey="id"
                size="small"
                loading={availableLoading}
                columns={availableColumns}
                dataSource={availableContents.items}
                scroll={{ x: 440 }}
                pagination={false}
              />
            </div>
            <div style={{ paddingTop: 12, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <Pagination
                current={availableContents.page}
                pageSize={availableContents.page_size}
                total={availableContents.total}
                size="small"
                showSizeChanger
                showTotal={(n) => t('pagination.total', { n })}
                onChange={(page, pageSize) => {
                  if (addContentModal.record) {
                    void loadAvailableContents(
                      addContentModal.record.id,
                      page,
                      addContentSearch,
                      selectedContentTypes,
                      selectedGenreIds,
                      selectedCustomTagIds,
                      pageSize,
                    )
                  }
                }}
              />
            </div>
          </div>

          <Divider type="vertical" style={{ height: '100%' }} />

          {/* 右侧：当前服务包信息 + 已关联内容 */}
          <div style={{ width: 320, display: 'flex', flexDirection: 'column' }}>
            {addContentModal.record && (
              <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ marginBottom: 2, fontSize: 12, color: '#666' }}>{t('package.detail.packageName')}</div>
                  <Input value={addContentModal.record.name} disabled style={{ background: '#f5f5f5' }} />
                </div>
                <div>
                  <div style={{ marginBottom: 2, fontSize: 12, color: '#666' }}>{t('package.detail.platform')}</div>
                  <Input
                    value={(addContentModal.record.platforms ?? []).map((p) => platformMap[p] ?? p).join(', ')}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </div>
                <div>
                  <div style={{ marginBottom: 2, fontSize: 12, color: '#666' }}>{t('package.detail.packageType')}</div>
                  <Input
                    value={addContentModal.record.package_type ? (packageTypeMap[addContentModal.record.package_type] ?? addContentModal.record.package_type) : '—'}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </div>
              </div>
            )}

            <div style={{ flex: 1, overflow: 'auto' }}>
              {/* 已关联内容（删除时直接从列表移除，点击确认才调用后端） */}
              {packageContents.map((c) => (
                <div
                  key={`linked-${c.id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  <Tooltip title={c.title}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                      {c.title}
                    </span>
                  </Tooltip>
                  <Button
                    type="link"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveLinked(c.id)}
                  />
                </div>
              ))}
              {/* 待保存的新增内容 */}
              {pendingAdd.map((c) => (
                <div
                  key={`pending-${c.id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    borderBottom: '1px solid #f0f0f0',
                    background: '#f6ffed',
                  }}
                >
                  <Tooltip title={c.title}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8, color: '#52c41a' }}>
                      + {c.title}
                    </span>
                  </Tooltip>
                  <Button
                    type="link"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemovePending(c.id)}
                  />
                </div>
              ))}
              {packageContents.length === 0 && pendingAdd.length === 0 && (
                <div style={{ color: '#999', textAlign: 'center', paddingTop: 24 }}>{t('package.addContent.noLinkedContent')}</div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Ingest 历史弹框 */}
      <ObjectIngestHistoryModal
        open={historyModal.open && !!historyModal.record}
        entityType="Package"
        entityId={historyModal.record?.id ?? 0}
        entityName={historyModal.record?.name ?? ''}
        onClose={() => setHistoryModal({ open: false, record: null })}
      />

      {/* 导入弹框 */}
      <PackageImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => {
          void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
        }}
      />
    </div>
  )
}
