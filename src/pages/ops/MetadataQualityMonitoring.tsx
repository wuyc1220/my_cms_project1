import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Modal,
  Space,
  Table,
  Tag,
  message,
} from 'antd'
import {
  DeleteOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  deleteMetadataQualityChecks,
  downloadMetadataQualityReport,
  getMetadataQualityChecks,
  triggerMetadataQualityCheck,
} from '../../api/metadataQuality'
import type {
  MetadataQualityCheck,
  MetadataQualityQueryParams,
} from '../../api/metadataQuality'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import SearchForm from '../../components/SearchForm'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useSearchForm } from '../../hooks/useSearchForm'
import { useAuthStore } from '../../stores/authStore'
import { isHandledError } from '../../api'


interface SearchValues {
  time_range?: [dayjs.Dayjs, dayjs.Dayjs]
  status?: string[]
}

/** 状态标签颜色映射 */
const STATUS_COLORS: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
}

export default function MetadataQualityMonitoring() {
  const { t, language } = useI18n()
  const { user } = useAuthStore()
  const [list, setList] = useState<MetadataQualityCheck[]>([])
  const [loading, setLoading] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const filtersRef = useRef<MetadataQualityQueryParams>({})
  const navigate = useNavigate()

  // 权限判断
  const hasOperationPermission =
    !user?.role_codes?.length ||
    user.role_codes.includes('admin') ||
    user.role_codes.some((code) => !code.endsWith('_viewer') && !code.endsWith('_readonly'))

  const {
    pagination,
    updatePagination,
    sortField,
    sortOrder,
    resetSort,
    tablePaginationProps,
    handleTableChange,
  } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filtersRef.current, sortField, sortOrder)
    },
  })

  // 状态选项
  const statusOptions = useMemo(
    () => [
      { label: t('ops.metadataQuality.status.pending'), value: 'pending' },
      { label: t('ops.metadataQuality.status.running'), value: 'running' },
      { label: t('ops.metadataQuality.status.completed'), value: 'completed' },
      { label: t('ops.metadataQuality.status.failed'), value: 'failed' },
    ],
    [t, language],
  )

  // 搜索字段配置
  const searchFields: SearchFieldConfig[] = useMemo(
    () => [
      {
        name: 'time_range',
        labelKey: 'ops.metadataQuality.search.timeRange',
        type: 'dateRange',
      },
      {
        name: 'status',
        labelKey: 'ops.metadataQuality.search.status',
        type: 'multiSelect',
        options: statusOptions,
        placeholderKey: 'ops.metadataQuality.search.statusPlaceholder',
      },
    ],
    [statusOptions],
  )

  // 使用 useSearchForm Hook
  const {
    form: searchForm,
    showExpand,
    handleSearch,
    handleReset,
  } = useSearchForm<SearchValues>({
    fieldsCount: searchFields.length,
    onSearch: async (values) => {
      setSelectedIds([])
      const filters = buildParams(values)
      filtersRef.current = filters
      resetSort()
      loadList(1, pagination.pageSize, filters, null, null)
    },
    onReset: () => {
      setSelectedIds([])
      filtersRef.current = {}
      resetSort()
      loadList(1, pagination.pageSize, {}, null, null)
    },
  })

  const buildParams = (values: SearchValues): MetadataQualityQueryParams => {
    const params: MetadataQualityQueryParams = {}
    if (values.status && values.status.length > 0) {
      params.status = values.status
    }
    if (values.time_range?.length === 2) {
      params.time_start = values.time_range[0].startOf('day').toISOString()
      params.time_end = values.time_range[1].endOf('day').toISOString()
    }
    return params
  }

  const loadList = async (
    page = pagination.current,
    pageSize = pagination.pageSize,
    filters = filtersRef.current,
    nextSortField?: string | null,
    nextSortOrder?: 'ascend' | 'descend' | null,
  ) => {
    setLoading(true)
    try {
      const res = await getMetadataQualityChecks({
        page,
        page_size: pageSize,
        ...filters,
        sort_by: nextSortField ?? undefined,
        sort_order: nextSortOrder === 'ascend' ? 'asc' : nextSortOrder === 'descend' ? 'desc' : undefined,
      })
      setList(res.items)
      updatePagination(res)
    } catch (err) {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTrigger = async () => {
    Modal.confirm({
      title: t('ops.metadataQuality.confirmTrigger'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        setTriggering(true)
        try {
          await triggerMetadataQualityCheck()
          message.success(t('ops.metadataQuality.msgTriggerSuccess'), 3)
          loadList(1, pagination.pageSize, filtersRef.current, sortField, sortOrder)
        } catch (err) {
          if (isHandledError(err)) return
          message.error(t('ops.metadataQuality.msgTriggerFailed'), 5)
        } finally {
          setTriggering(false)
        }
      },
    })
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      message.warning(t('common.msg.initFailed'))
      return
    }
    Modal.confirm({
      title: t('ops.metadataQuality.confirmDelete').replace('{count}', String(selectedIds.length)),
      onOk: async () => {
        setLoading(true)
        try {
          await deleteMetadataQualityChecks(selectedIds)
          message.success(t('ops.metadataQuality.msgDeleteSuccess'), 3)
          setSelectedIds([])
          loadList(1, pagination.pageSize, filtersRef.current, sortField, sortOrder)
        } catch (err) {
          if (isHandledError(err)) return
          message.error(t('ops.metadataQuality.msgDeleteFailed'), 5)
        } finally {
          setLoading(false)
        }
      },
    })
  }

  const handleViewDetail = (record: MetadataQualityCheck) => {
    navigate(`/ops/monitor/${record.id}`)
  }

  const handleDownload = async (record: MetadataQualityCheck) => {
    try {
      await downloadMetadataQualityReport(record.id)
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('ops.metadataQuality.msgDownloadFailed'), 5)
    }
  }

  const columns: ColumnsType<MetadataQualityCheck> = [
    {
      title: t('ops.metadataQuality.colCheckTime'),
      dataIndex: 'check_time',
      key: 'check_time',
      sorter: true,
      sortOrder: sortField === 'check_time' ? sortOrder : null,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t('ops.metadataQuality.colStatus'),
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      sortOrder: sortField === 'status' ? sortOrder : null,
      render: (v: string) => (
        <Tag color={STATUS_COLORS[v] ?? 'default'}>
          {t(`ops.metadataQuality.status.${v}` as 'ops.metadataQuality.status.pending')}
        </Tag>
      ),
    },
    {
      title: t('ops.metadataQuality.colTotal'),
      dataIndex: 'total_contents',
      key: 'total_contents',
      sorter: true,
      sortOrder: sortField === 'total_contents' ? sortOrder : null,
      render: (v: number) => v ?? '-',
    },
    {
      title: t('ops.metadataQuality.colPassed'),
      dataIndex: 'passed_count',
      key: 'passed_count',
      sorter: true,
      sortOrder: sortField === 'passed_count' ? sortOrder : null,
      render: (v: number) => v ?? '-',
    },
    {
      title: t('ops.metadataQuality.colFailed'),
      dataIndex: 'failed_count',
      key: 'failed_count',
      sorter: true,
      sortOrder: sortField === 'failed_count' ? sortOrder : null,
      render: (v: number) => v ?? '-',
    },
    {
      title: t('ops.metadataQuality.colDuration'),
      dataIndex: 'duration',
      key: 'duration',
      sorter: true,
      sortOrder: sortField === 'duration' ? sortOrder : null,
      render: (v: number | null, record: MetadataQualityCheck) =>
        record.status === 'running'
          ? t('ops.metadataQuality.durationRunning')
          : v !== null
            ? t('ops.metadataQuality.seconds').replace('{n}', String(v))
            : '-',
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={() => handleViewDetail(record)}
          />
          {record.status === 'completed' && (
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
            />
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="main-container">
      <SearchForm
        fields={searchFields}
        form={searchForm}
        showExpand={showExpand}
        onSearch={handleSearch}
        onReset={handleReset}
        loading={loading}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
        {hasOperationPermission && (
          <Button
            danger
            ghost
            icon={<DeleteOutlined />}
            disabled={selectedIds.length === 0}
            onClick={handleBatchDelete}
          >
            {t('ops.metadataQuality.btnBatchDelete')}
          </Button>
        )}
        {hasOperationPermission && (
          <Button
            type="primary"
            ghost
            icon={<PlayCircleOutlined />}
            loading={triggering}
            onClick={handleTrigger}
          >
            {t('ops.metadataQuality.btnTrigger')}
          </Button>
        )}
      </div>

      <Table<MetadataQualityCheck>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={list}
        loading={loading}
        scroll={{ x: 900 }}
        onChange={handleTableChange}
        pagination={tablePaginationProps}
        rowSelection={
          hasOperationPermission
            ? {
                selectedRowKeys: selectedIds,
                onChange: (keys) => setSelectedIds(keys as number[]),
              }
            : undefined
        }
      />
    </div>
  )
}
