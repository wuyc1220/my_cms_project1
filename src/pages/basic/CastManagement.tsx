import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Image,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { EditOutlined, DeleteOutlined, InfoCircleOutlined, PictureOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { batchDeleteCasts, deleteCast, getCasts } from '../../api/casts'
import PostersModal from '../../components/PostersModal'
import ObjectIngestHistoryModal from '../../components/ObjectIngestHistoryModal'
import SearchForm from '../../components/SearchForm'
import CastFormModal from '../../components/CastFormModal'
import { useI18n } from '../../i18n/useI18n'
import type { CastListItem } from '../../types/basic'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'

const getIngestTagColor = (val: string) => {
  if (val === 'success') return 'success'
  if (val === 'failure') return 'error'
  if (val === 'processing') return 'processing'
  return 'default'
}

interface SearchValues {
  cast_id?: number | null
  name?: string
  description?: string
  ingest_statuses?: string[]
}

export default function CastManagement() {
  const navigate = useNavigate()
  const { t } = useI18n()

  const [list, setList] = useState<CastListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<CastListItem | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filters, sortField, sortOrder)
    },
  })

  const [postersModal, setPostersModal] = useState<{ open: boolean; record: CastListItem | null }>({ open: false, record: null })
  const [historyModal, setHistoryModal] = useState<{ open: boolean; record: CastListItem | null }>({ open: false, record: null })
  const [posterBlobUrls, setPosterBlobUrls] = useState<Record<number, string>>({})
  const blobUrlRefs = useRef<Set<string>>(new Set())
  const { hasPermission } = usePermission()
  const canView = hasPermission('menu.basic.casts.view') || hasPermission('menu.basic.casts.operate')
  const canOperate = hasPermission('menu.basic.casts.operate')

  const revokeAllBlobUrls = useCallback(() => {
    blobUrlRefs.current.forEach((url) => URL.revokeObjectURL(url))
    blobUrlRefs.current.clear()
  }, [])

  const fetchPosterBlobUrls = useCallback(async (items: CastListItem[]) => {
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

  useEffect(() => {
    return () => { revokeAllBlobUrls() }
  }, [revokeAllBlobUrls])

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'cast_id',
      labelKey: 'cast.search.castId',
      type: 'number',
      placeholderKey: 'cast.search.castId',
      min: 1,
    },
    {
      name: 'name',
      labelKey: 'cast.search.castName',
      type: 'input',
      placeholderKey: 'cast.search.castName',
    },
    {
      name: 'description',
      labelKey: 'cast.search.description',
      type: 'input',
      placeholderKey: 'cast.search.description',
    },
    {
      name: 'ingest_statuses',
      labelKey: 'cast.search.ingestStatus',
      type: 'multiSelect',
      placeholderKey: 'common.placeholder.select',
      options: [
        { label: 'none', value: 'none' },
        { label: 'processing', value: 'processing' },
        { label: 'success', value: 'success' },
        { label: 'failure', value: 'failure' },
      ],
    },
  ], [t])

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
      void loadList(1, pagination.pageSize, values, sortField, sortOrder)
    },
    onReset: () => {
      setSelectedIds([])
      resetSort()
      void loadList(1, pagination.pageSize, {}, null, null)
    },
    fieldsCount: searchFields.length,
  })

  const loadList = async (page = pagination.current, pageSize = pagination.pageSize, nextFilters = filters, nextSortField?: string | null, nextSortOrder?: 'ascend' | 'descend' | null) => {
    setLoading(true)
    try {
      const data = await getCasts({
        page,
        page_size: pageSize,
        cast_id: nextFilters.cast_id ?? undefined,
        name: nextFilters.name,
        description: nextFilters.description,
        ingest_statuses: nextFilters.ingest_statuses,
        sort_by: nextSortField ?? undefined,
        sort_order: nextSortOrder === 'ascend' ? 'asc' : nextSortOrder === 'descend' ? 'desc' : undefined,
      })
      setList(data.items)
      updatePagination(data)
      revokeAllBlobUrls()
      void fetchPosterBlobUrls(data.items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadList(1, 10, {})
  }, [])

  const openCreate = () => {
    setEditingRecord(null)
    setModalOpen(true)
  }

  const openEdit = (record: CastListItem) => {
    setEditingRecord(record)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingRecord(null)
  }

  const handleModalSuccess = () => {
    closeModal()
    void loadList(editingRecord ? pagination.current : 1, pagination.pageSize, filters, sortField, sortOrder)
  }

  const handleDelete = async (record: CastListItem) => {
    await deleteCast(record.id)
    void message.success(t('cast.msg.deleted'), 3)
    setSelectedIds(prev => prev.filter(id => id !== record.id))
    void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    await batchDeleteCasts({ ids: selectedIds })
    void message.success(t('common.recordsCount', { count: selectedIds.length }), 3)
    setSelectedIds([])
    void loadList(1, pagination.pageSize, filters, sortField, sortOrder)
  }

  const columns: ColumnsType<CastListItem> = [
    { title: t('cast.col.castId'), dataIndex: 'id', key: 'id', width: 90, sorter: true, sortOrder: sortField === 'id' ? sortOrder : null },
    {
      title: t('cast.col.poster'),
      key: 'poster',
      width: 160,
      render: (_, record) => {
        const blobUrl = posterBlobUrls[record.id]
        if (blobUrl) {
          return <Image src={blobUrl} width={48} height={48} style={{ objectFit: 'cover', borderRadius: 4 }} preview={false} fallback="" />
        }
        if (record.poster_url) {
          return (
            <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', borderRadius: 4 }}>
              <PictureOutlined style={{ fontSize: 24, color: '#bfbfbf' }} />
            </div>
          )
        }
        return (
          <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', borderRadius: 4 }}>
            <Button
              type="link"
              size="small"
              icon={<PictureOutlined style={{ fontSize: 24, color: '#bfbfbf' }} />}
              onClick={() => setPostersModal({ open: true, record })}
            />
          </div>
        )
      },
    },
    { title: t('cast.col.castName'), dataIndex: 'name', key: 'name', sorter: true, sortOrder: sortField === 'name' ? sortOrder : null },
    {
      title: t('cast.col.description'),
      dataIndex: 'description',
      key: 'description',
      render: (val: string | null) => val ?? '—',
    },
    {
      title: t('cast.col.ingestStatus'),
      dataIndex: 'ingest_status',
      key: 'ingest_status',
      sorter: true,
      sortOrder: sortField === 'ingest_status' ? sortOrder : null,
      render: (val: string | null, record: CastListItem) => {
        const displayVal = val ?? 'None'
        const tagColor = getIngestTagColor(displayVal)
        return (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => setHistoryModal({ open: true, record })}
          >
            <Tag color={tagColor} style={{ cursor: 'pointer', margin: 0 }}>{displayVal}</Tag>
          </Button>
        )
      },
    },
    {
      title: t('cast.col.action'),
      key: 'action',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space size={0}>
          {canView && (
            <Tooltip title={t('cast.action.detail')}>
              <Button
                type="link"
                size="small"
                icon={<InfoCircleOutlined />}
                onClick={() => navigate(`/basic/casts/${record.id}`)}
              />
            </Tooltip>
          )}
          {canView && (
            <Tooltip title={t('cast.action.managePosters')}>
              <Button
                type="link"
                size="small"
                icon={<PictureOutlined />}
                onClick={() => setPostersModal({ open: true, record })}
              />
            </Tooltip>
          )}
          {canOperate && (
            <Tooltip title={t('cast.action.edit')}>
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
              <Tooltip title={t('cast.action.delete')}>
                <Button type="link" size="small" icon={<DeleteOutlined />} danger />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

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
            title={`${t('common.confirm')} ${t('common.batchDelete')} ${selectedIds.length} ${t('common.action')}？`}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            onConfirm={() => void handleBatchDelete()}
            disabled={selectedIds.length === 0}
          >
            <Button danger disabled={selectedIds.length === 0}>
              {t('cast.toolbar.batchDelete')}{selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
            </Button>
          </Popconfirm>
        )}
        {canOperate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t('cast.toolbar.newCast')}
          </Button>
        )}
      </div>

      <Table<CastListItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={list}
        scroll={{ x: 800 }}
        onChange={handleTableChange}
        rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as number[]) }}
        pagination={tablePaginationProps}
        size="small"
      />

      {/* 新增/编辑弹框 */}
      <CastFormModal
        open={modalOpen}
        mode={editingRecord ? 'edit' : 'create'}
        castId={editingRecord?.id}
        onClose={closeModal}
        onSuccess={handleModalSuccess}
      />

      {/* 海报管理弹框 */}
      <PostersModal
        open={postersModal.open}
        entityType="cast"
        entityId={postersModal.record?.id ?? 0}
        entityName={postersModal.record?.name}
        readOnly={!canOperate}
        onClose={() => setPostersModal({ open: false, record: null })}
      />

      <ObjectIngestHistoryModal
        open={historyModal.open && !!historyModal.record}
        entityType="Cast"
        entityId={historyModal.record?.id ?? 0}
        entityName={historyModal.record?.name ?? ''}
        onClose={() => setHistoryModal({ open: false, record: null })}
      />
    </div>
  )
}
