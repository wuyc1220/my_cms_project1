import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Divider,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  PlusOutlined,
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
} from '../../api/packages'
import { getDictTree } from '../../api/dicts'
import { getGenres } from '../../api/genres'
import { getCustomTags } from '../../api/customTags'
import { getMultiLanguageOptions } from '../../api/i18n'
import { useI18n } from '../../i18n/useI18n'
import PackageCreateModal from '../../components/PackageCreateModal'
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

// Tab key → content_type 值映射
const TAB_CONTENT_TYPES: Record<string, string[]> = {
  program: ['MOVIE'],
  series: ['SERIES', 'SEASON'],
  channel: ['CHANNEL'],
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
  const [addContentTab, setAddContentTab] = useState('program')
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
  const [savingContents, setSavingContents] = useState(false)
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
        { label: 'none', value: 'none' },
        { label: 'processing', value: 'processing' },
        { label: 'success', value: 'success' },
        { label: 'failure', value: 'failure' },
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
    await batchDeletePackages({ ids: selectedIds })
    void message.success(t('common.recordsCount', { count: selectedIds.length }), 3)
    setSelectedIds([])
    void loadList(1, pagination.pageSize, filters, sortField, sortOrder)
  }

  // ─── Add Content to Package 弹框 ──────────────────────────────────────

  const openAddContent = async (record: PackageListItem) => {
    setAddContentModal({ open: true, record })
    setAddContentTab('program')
    setAddContentSearch('')
    // 默认选中 Program Tab 对应的内容类型
    const defaultContentTypes = TAB_CONTENT_TYPES['program']
    setSelectedContentTypes(defaultContentTypes)
    setSelectedGenreIds([])
    setSelectedCustomTagIds([])
    setPendingAdd([])
    void loadPackageContents(record.id)
    void loadAvailableContents(record.id, 1, 'program', '', defaultContentTypes, [], [])
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
      const res = await getGenres({ page: 1, page_size: 1000, languages: langFilter })
      setGenreOptions(res.items.map((g: GenreListItem) => ({ label: g.name, value: g.id })))
    } catch {
      setGenreOptions([])
    }
  }

  const loadCustomTagOptions = async () => {
    try {
      // 获取数据字典 Multi_Languages 第一语言进行过滤
      const langOptions = await getMultiLanguageOptions()
      const defaultLang = langOptions.length > 0 ? langOptions[0].code : undefined
      const langFilter = defaultLang ? [defaultLang] : undefined
      const res = await getCustomTags({ page: 1, page_size: 1000, languages: langFilter })
      setCustomTagOptions(res.items.map((t: CustomTagListItem) => ({ label: t.name, value: t.id })))
    } catch {
      setCustomTagOptions([])
    }
  }

  const loadPackageContents = async (packageId: number) => {
    const res = await getPackageContents(packageId)
    setPackageContents(res.items)
  }

  const loadAvailableContents = async (
    packageId: number,
    page: number,
    tab: string,
    search: string,
    contentTypes: string[] = [],
    genreIds: number[] = [],
    customTagIds: number[] = [],
  ) => {
    setAvailableLoading(true)
    try {
      // 如果用户手动选择了内容类型，使用用户选择的；否则使用 Tab 默认的
      const finalContentTypes = contentTypes.length > 0 ? contentTypes : TAB_CONTENT_TYPES[tab]
      const data = await getAvailableContents(packageId, {
        page,
        page_size: 10,
        title: search || undefined,
        content_types: finalContentTypes,
        genre_ids: genreIds.length > 0 ? genreIds : undefined,
        custom_tag_ids: customTagIds.length > 0 ? customTagIds : undefined,
      })
      setAvailableContents(data)
    } finally {
      setAvailableLoading(false)
    }
  }

  const handleAddContentTabChange = (tab: string) => {
    setAddContentTab(tab)
    setAddContentSearch('')
    // 点击Tab自动设置内容类型查询条件
    const tabContentTypes = TAB_CONTENT_TYPES[tab] || []
    setSelectedContentTypes(tabContentTypes)
    setSelectedGenreIds([])
    setSelectedCustomTagIds([])
    if (addContentModal.record) {
      void loadAvailableContents(addContentModal.record.id, 1, tab, '', tabContentTypes, [], [])
    }
  }

  const handleAddContentSearch = () => {
    if (addContentModal.record) {
      void loadAvailableContents(
        addContentModal.record.id,
        1,
        addContentTab,
        addContentSearch,
        selectedContentTypes,
        selectedGenreIds,
        selectedCustomTagIds,
      )
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

  // 从已关联列表移除（已保存的）
  const handleRemoveLinked = async (contentId: number) => {
    if (!addContentModal.record) return
    await removeContentFromPackage(addContentModal.record.id, contentId)
    void message.success(t('common.msg.removed'), 3)
    setPackageContents((prev) => prev.filter((c) => c.id !== contentId))
  }

  const handleSaveContents = async () => {
    if (!addContentModal.record || pendingAdd.length === 0) return
    setSavingContents(true)
    try {
      const updated = await addContentsToPackage(addContentModal.record.id, {
        content_ids: pendingAdd.map((c) => c.id),
      })
      setPackageContents(updated)
      setPendingAdd([])
      void message.success(t('common.msg.saveSuccess'), 3)
      // 刷新左侧可选列表（排除已关联）
      void loadAvailableContents(addContentModal.record.id, availableContents.page, addContentTab, addContentSearch)
    } finally {
      setSavingContents(false)
    }
  }

  const closeAddContent = () => {
    setAddContentModal({ open: false, record: null })
    setPackageContents([])
    setPendingAdd([])
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
            <Tag color={getIngestTagColor(displayVal)} style={{ cursor: 'pointer', margin: 0 }}>{displayVal}</Tag>
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
            onClick={() => navigate(`/contents/${row.id}`)}
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
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            disabled={isDisabled}
            onClick={() => handleQueueContent(row)}
          />
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
          <Button onClick={() => void message.info(t('vod.msg.exportSoon'), 3)}>{t('common.btn.excelExport')}</Button>
          {canOperate && (
            <Button onClick={() => void message.info(t('vod.msg.importSoon'), 3)}>{t('common.btn.excelImport')}</Button>
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
              disabled={pendingAdd.length === 0}
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
            <Tabs
              activeKey={addContentTab}
              onChange={handleAddContentTabChange}
              items={[
                { key: 'program', label: t('publish.contentType.MOVIE') },
                { key: 'series', label: t('publish.contentType.SERIES') },
                { key: 'channel', label: t('publish.contentType.CHANNEL') },
              ]}
            />
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
                  { label: t('publish.contentType.CHANNEL'), value: 'CHANNEL' },
                  { label: t('publish.contentType.SCHEDULE'), value: 'SCHEDULE' },
                ]}
                style={{ width: 220 }}
                maxTagCount={1}
              />
              <Select
                mode="multiple"
                placeholder={t('package.addContent.genre')}
                value={selectedGenreIds}
                onChange={(value) => {
                  setSelectedGenreIds(value as number[])
                }}
                options={genreOptions}
                style={{ width: 220 }}
                maxTagCount={1}
              />
              <Select
                mode="multiple"
                placeholder={t('package.addContent.customTags')}
                value={selectedCustomTagIds}
                onChange={(value) => {
                  setSelectedCustomTagIds(value as number[])
                }}
                options={customTagOptions}
                style={{ width: 220 }}
                maxTagCount={1}
              />
              <Button onClick={handleAddContentSearch}>{t('common.search')}</Button>
            </Space>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <Table<ContentSimpleItem>
                rowKey="id"
                size="small"
                loading={availableLoading}
                columns={availableColumns}
                dataSource={availableContents.items}
                scroll={{ x: 440 }}
                pagination={{
                  current: availableContents.page,
                  pageSize: availableContents.page_size,
                  total: availableContents.total,
                  size: 'small',
                  position: ['bottomCenter'],
                  onChange: (page) => {
                    if (addContentModal.record) {
                      void loadAvailableContents(
                        addContentModal.record.id,
                        page,
                        addContentTab,
                        addContentSearch,
                        selectedContentTypes,
                        selectedGenreIds,
                        selectedCustomTagIds,
                      )
                    }
                  },
                }}
              />
            </div>
          </div>

          <Divider type="vertical" style={{ height: '100%' }} />

          {/* 右侧：当前服务包信息 + 已关联内容 */}
          <div style={{ width: 320, display: 'flex', flexDirection: 'column' }}>
            {addContentModal.record && (
              <div style={{ marginBottom: 12, background: '#fafafa', padding: 12, borderRadius: 6 }}>
                <div style={{ marginBottom: 4 }}>
                  <strong>{t('package.detail.packageName')}：</strong>{addContentModal.record.name}
                </div>
                <div style={{ marginBottom: 4 }}>
                  <strong>{t('package.detail.platform')}：</strong>
                  {(addContentModal.record.platforms ?? []).length === 0
                    ? '—'
                    : (addContentModal.record.platforms ?? []).map((p) => <Tag key={p} style={{ marginRight: 4 }}>{platformMap[p] ?? p}</Tag>)}
                </div>
                <div>
                  <strong>{t('package.detail.packageType')}：</strong>
                  {addContentModal.record.package_type
                    ? (packageTypeMap[addContentModal.record.package_type] ?? addContentModal.record.package_type)
                    : '—'}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('package.addContent.contentsOfPackage')}</div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {/* 已保存的关联内容 */}
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
                  <Popconfirm
                    title={t('package.addContent.confirmRemove', { name: c.title })}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    onConfirm={() => void handleRemoveLinked(c.id)}
                  >
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                    />
                  </Popconfirm>
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
    </div>
  )
}
