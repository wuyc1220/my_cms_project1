import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Modal,
  Table,
  Tag,
  message,
} from 'antd'
import {
  InfoCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getScheduledTasks,
  triggerScheduledTasks,
} from '../../api/scheduledTasks'
import type {
  ScheduledTask,
  ScheduledTaskQueryParams,
} from '../../api/scheduledTasks'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useAuthStore } from '../../stores/authStore'
import { isHandledError } from '../../api'


/** 调度状态标签颜色 */
const SCHEDULE_STATUS_COLORS: Record<string, string> = {
  enabled: 'success',
  disabled: 'default',
}

/** 执行状态标签颜色 */
const EXEC_STATUS_COLORS: Record<string, string> = {
  idle: 'default',
  running: 'processing',
}

export default function ScheduledTaskManagement() {
  const { t } = useI18n()
  const { user } = useAuthStore()
  const [list, setList] = useState<ScheduledTask[]>([])
  const [loading, setLoading] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const filtersRef = useRef<ScheduledTaskQueryParams>({})
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
    tablePaginationProps,
    handleTableChange,
  } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filtersRef.current, sortField, sortOrder)
    },
  })

  const loadList = async (
    page = pagination.current,
    pageSize = pagination.pageSize,
    filters = filtersRef.current,
    nextSortField?: string | null,
    nextSortOrder?: 'ascend' | 'descend' | null,
  ) => {
    setLoading(true)
    try {
      const res = await getScheduledTasks({
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

  const handleManualTrigger = async () => {
    if (selectedIds.length === 0) {
      message.warning(t('ops.scheduledTask.msgSelectFirst'))
      return
    }
    Modal.confirm({
      title: t('ops.scheduledTask.confirmManualTrigger').replace('{count}', String(selectedIds.length)),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        setTriggering(true)
        try {
          await triggerScheduledTasks(selectedIds)
          message.success(t('ops.scheduledTask.msgTriggerSuccess'), 3)
          setSelectedIds([])
          loadList(1, pagination.pageSize, filtersRef.current, sortField, sortOrder)
        } catch (err: unknown) {
          if (isHandledError(err)) return
          const error = err as Error
          const msg = error.message || ''
          if (msg.startsWith('BLOCKED_RUNNING:')) {
            const names = msg.replace('BLOCKED_RUNNING:', '')
            message.error(t('ops.scheduledTask.msgBlockedRunning').replace('{names}', names), 5)
          } else if (msg.startsWith('BLOCKED_DISABLED:')) {
            const names = msg.replace('BLOCKED_DISABLED:', '')
            message.error(t('ops.scheduledTask.msgBlockedDisabled').replace('{names}', names), 5)
          } else {
            message.error(t('ops.scheduledTask.msgTriggerFailed'), 5)
          }
        } finally {
          setTriggering(false)
        }
      },
    })
  }

  const handleViewDetail = (record: ScheduledTask) => {
    navigate(`/ops/cron/${record.id}`)
  }

  const getTaskTypeLabel = (type: string) => {
    return t(`ops.scheduledTask.taskType.${type}` as 'ops.scheduledTask.taskType.ContentOffline') || type
  }

  const columns: ColumnsType<ScheduledTask> = [
    {
      title: t('ops.scheduledTask.colTaskType'),
      dataIndex: 'task_type',
      key: 'task_type',
      width: 300,
      sorter: true,
      sortOrder: sortField === 'task_type' ? sortOrder : null,
      render: (v: string) => getTaskTypeLabel(v),
    },
    {
      title: t('ops.scheduledTask.colDescription'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: t('ops.scheduledTask.colScheduleStatus'),
      dataIndex: 'schedule_status',
      key: 'schedule_status',
      width: 120,
      sorter: true,
      sortOrder: sortField === 'schedule_status' ? sortOrder : null,
      render: (v: string) => (
        <Tag color={SCHEDULE_STATUS_COLORS[v] ?? 'default'}>
          {t(`ops.scheduledTask.status.${v}` as 'ops.scheduledTask.status.enabled')}
        </Tag>
      ),
    },
    {
      title: t('ops.scheduledTask.colExecutionStatus'),
      dataIndex: 'execution_status',
      key: 'execution_status',
      width: 120,
      sorter: true,
      sortOrder: sortField === 'execution_status' ? sortOrder : null,
      render: (v: string) => (
        <Tag color={EXEC_STATUS_COLORS[v] ?? 'default'}>
          {t(`ops.scheduledTask.execStatus.${v}` as 'ops.scheduledTask.execStatus.idle')}
        </Tag>
      ),
    },
    {
      title: t('ops.scheduledTask.colLastExecution'),
      dataIndex: 'last_execution_time',
      key: 'last_execution_time',
      width: 180,
      sorter: true,
      sortOrder: sortField === 'last_execution_time' ? sortOrder : null,
      render: (v: string | null) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t('ops.scheduledTask.colNextExecution'),
      dataIndex: 'next_execution_time',
      key: 'next_execution_time',
      width: 180,
      sorter: true,
      sortOrder: sortField === 'next_execution_time' ? sortOrder : null,
      render: (v: string | null, record: ScheduledTask) =>
        record.schedule_status === 'disabled' ? '-' : v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<InfoCircleOutlined />}
          onClick={() => handleViewDetail(record)}
        />
      ),
    },
  ]

  return (
    <div className="main-container">
      {hasOperationPermission && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={triggering}
            onClick={handleManualTrigger}
          >
            {t('ops.scheduledTask.btnManualTrigger')}
          </Button>
        </div>
      )}

      <Table<ScheduledTask>
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
