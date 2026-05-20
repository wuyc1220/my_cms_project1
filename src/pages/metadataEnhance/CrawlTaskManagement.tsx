/**
 * 爬取任务管理页面
 */
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Space, Tag, Popconfirm, message, Modal, Tooltip,
} from 'antd'
import {
  DeleteOutlined, RedoOutlined, InfoCircleOutlined,
} from '@ant-design/icons'
import { useI18n } from '../../i18n/useI18n'
import {
  getCrawlTasks,
  retryCrawlTask,
  batchDeleteCrawlTasks,
  deleteCrawlTask,
} from '../../api/crawlTasks'
import type { CrawlTaskListItem } from '../../types/metadataEnhance'
import type { PaginatedResponse } from '../../types/basic'
import { isHandledError } from '../../api'
import SearchForm from '../../components/SearchForm'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import type { SearchFieldConfig } from '../../types/searchForm'


const OBJECT_TYPES = ['Movie', 'Series', 'Cast']
const CRAWL_STATUSES = ['Created', 'InProgress', 'Completed', 'Failed']

const STATUS_COLORS: Record<string, string> = {
  Created: 'default',
  InProgress: 'processing',
  Completed: 'success',
  Failed: 'error',
}

interface SearchValues {
  source_name?: string
  object_name?: string
  object_types?: string[]
  crawl_statuses?: string[]
}

export default function CrawlTaskManagement() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [data, setData] = useState<PaginatedResponse<CrawlTaskListItem>>({
    total: 0, page: 1, page_size: 10, items: [],
  })
  const [loading, setLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])

  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filters, sortField, sortOrder)
    },
  })

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'source_name',
      labelKey: 'crawlTask.search.sourceNamePlaceholder',
      type: 'input',
    },
    {
      name: 'object_name',
      labelKey: 'crawlTask.search.objectNamePlaceholder',
      type: 'input',
    },
    {
      name: 'object_types',
      labelKey: 'crawlTask.search.objectTypePlaceholder',
      type: 'multiSelect',
      options: OBJECT_TYPES.map((item) => ({ label: item, value: item })),
    },
    {
      name: 'crawl_statuses',
      labelKey: 'crawlTask.search.crawlStatusPlaceholder',
      type: 'multiSelect',
      options: CRAWL_STATUSES.map((s) => ({ label: s, value: s })),
    },
  ], [])

  const {
    form: searchForm,
    filters,
    setFilters,
    showExpand,
    handleSearch,
    handleReset,
  } = useSearchForm<SearchValues>({
    fieldsCount: searchFields.length,
    onSearch: (values) => {
      setFilters(values)
      setSelectedRowKeys([])
      void loadList(1, pagination.pageSize, values, sortField, sortOrder)
    },
    onReset: () => {
      setFilters({})
      setSelectedRowKeys([])
      resetSort()
      void loadList(1, pagination.pageSize, {}, null, null)
    },
  })

  const loadList = async (
    page: number,
    pageSize: number,
    searchValues: SearchValues,
    nextSortField?: string | null,
    nextSortOrder?: 'ascend' | 'descend' | null,
  ) => {
    setLoading(true)
    try {
      const result = await getCrawlTasks({
        page,
        page_size: pageSize,
        source_name: searchValues.source_name || undefined,
        object_name: searchValues.object_name || undefined,
        object_types: searchValues.object_types?.length ? searchValues.object_types : undefined,
        crawl_statuses: searchValues.crawl_statuses?.length ? searchValues.crawl_statuses : undefined,
        sort_by: nextSortField ?? undefined,
        sort_order: nextSortOrder === 'ascend' ? 'asc' : nextSortOrder === 'descend' ? 'desc' : undefined,
      })
      setData(result)
      updatePagination(result)
    } catch (err) {
      if (isHandledError(err)) return
      message.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadList(1, pagination.pageSize, {}, null, null) }, [])

  const handleRetry = async (id: number) => {
    try {
      await retryCrawlTask(id)
      message.success(t('crawlTask.msg.retried'))
      void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('crawlTask.msg.retryFailed'))
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteCrawlTask(id)
      message.success(t('crawlTask.msg.deleted'))
      setSelectedRowKeys(prev => prev.filter(key => key !== id))
      void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('crawlTask.msg.deleteFailed'))
    }
  }

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return
    Modal.confirm({
      title: t('crawlTask.confirm.batchDelete'),
      content: t('crawlTask.confirm.batchDeleteContent', { count: String(selectedRowKeys.length) }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await batchDeleteCrawlTasks(selectedRowKeys)
          message.success(t('crawlTask.msg.batchDeleted'))
          setSelectedRowKeys([])
          void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
        } catch (err) {
          if (isHandledError(err)) return
          message.error(t('crawlTask.msg.deleteFailed'))
        }
      },
    })
  }

  const columns = [
    {
      title: t('crawlTask.col.taskId'),
      dataIndex: 'id',
      key: 'id',
      width: 100,
      sorter: true,
      sortOrder: sortField === 'id' ? sortOrder : null,
    },
    {
      title: t('crawlTask.col.objectName'),
      dataIndex: 'object_name',
      key: 'object_name',
      sorter: true,
      sortOrder: sortField === 'object_name' ? sortOrder : null,
      ellipsis: true,
    },
    {
      title: t('crawlTask.col.objectType'),
      dataIndex: 'object_type',
      key: 'object_type',
      sorter: true,
      sortOrder: sortField === 'object_type' ? sortOrder : null,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: t('crawlTask.col.sourceName'),
      dataIndex: 'source_name',
      key: 'source_name',
      sorter: true,
      sortOrder: sortField === 'source_name' ? sortOrder : null,
      ellipsis: true,
    },
    {
      title: t('crawlTask.col.crawlStatus'),
      dataIndex: 'crawl_status',
      key: 'crawl_status',
      sorter: true,
      sortOrder: sortField === 'crawl_status' ? sortOrder : null,
      render: (v: string) => <Tag color={STATUS_COLORS[v] || 'default'}>{t(`crawlTask.status.${v}` as any)}</Tag>,
    },
    {
      title: t('crawlTask.col.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      sorter: true,
      sortOrder: sortField === 'created_at' ? sortOrder : null,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: t('crawlTask.col.completedAt'),
      dataIndex: 'completed_at',
      key: 'completed_at',
      width: 180,
      sorter: true,
      sortOrder: sortField === 'completed_at' ? sortOrder : null,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: t('crawlTask.col.action'),
      key: 'action',
      width: 140,
      render: (_: unknown, record: CrawlTaskListItem) => (
        <Space>
          <Tooltip title={t('crawlTask.action.detail')}>
            <Button type="link" size="small" icon={<InfoCircleOutlined />} onClick={() => navigate(`/metadata-enhance/crawl-tasks/${record.id}`)} />
          </Tooltip>
          <Popconfirm title={t('crawlTask.confirm.retry')} okText={t('common.confirm')} cancelText={t('common.cancel')} onConfirm={() => handleRetry(record.id)}>
            <Tooltip title={t('crawlTask.action.retry')}>
              <Button type="link" size="small" icon={<RedoOutlined />} />
            </Tooltip>
          </Popconfirm>
          <Popconfirm title={t('crawlTask.confirm.delete')} okText={t('common.confirm')} cancelText={t('common.cancel')} onConfirm={() => handleDelete(record.id)}>
            <Tooltip title={t('crawlTask.action.delete')}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
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
        showExpand={showExpand}
        onSearch={handleSearch}
        onReset={handleReset}
        loading={loading}
      />

      {/* 工具栏 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
        <Button
          onClick={() => {
            if (selectedRowKeys.length === 0) return
            Promise.all(selectedRowKeys.map((id) => retryCrawlTask(id)))
              .then(() => { message.success(t('crawlTask.msg.retried')); setSelectedRowKeys([]); void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder) })
              .catch(() => message.error(t('crawlTask.msg.retryFailed')))
          }}
          disabled={selectedRowKeys.length === 0}
        >
          {t('crawlTask.toolbar.batchRetry')}
        </Button>
        <Popconfirm
          title={t('crawlTask.confirm.batchDelete')}
          onConfirm={() => void handleBatchDelete()}
          disabled={selectedRowKeys.length === 0}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
        >
          <Button danger disabled={selectedRowKeys.length === 0}>
            {t('crawlTask.toolbar.batchDelete')}{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ''}
          </Button>
        </Popconfirm>
      </div>

      {/* 表格 */}
      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={data.items}
        loading={loading}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as number[]),
        }}
        pagination={tablePaginationProps}
        onChange={handleTableChange}
      />
    </div>
  )
}
