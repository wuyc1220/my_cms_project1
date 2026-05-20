import { Card, Table } from 'antd'
import type { TablePaginationConfig } from 'antd/es/table'
import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TaskAssignedMatrix as TaskAssignedMatrixType, TaskAssignedMatrixItem } from '../../../types/dashboard'
import { useI18n } from '../../../i18n/useI18n'
import { PAGINATION_CONFIG } from '../../../constants/pagination'

interface TaskAssignedMatrixProps {
  data: TaskAssignedMatrixType
}

type ColumnKey = 'arrangement_pending' | 'review_l1_pending' | 'review_l2_pending' | 'review_l3_pending' | 'arrangement_completed' | 'review_completed'

interface ColumnFilterInfo {
  taskTypes: string[]
  taskStatus: string
}

const COLUMN_FILTER_MAP: Record<ColumnKey, ColumnFilterInfo> = {
  arrangement_pending: { taskTypes: ['arrangement'], taskStatus: 'Pending' },
  review_l1_pending: { taskTypes: ['review L1'], taskStatus: 'Pending' },
  review_l2_pending: { taskTypes: ['review L2'], taskStatus: 'Pending' },
  review_l3_pending: { taskTypes: ['review L3'], taskStatus: 'Pending' },
  arrangement_completed: { taskTypes: ['arrangement'], taskStatus: 'Completed' },
  review_completed: { taskTypes: ['review L1', 'review L2', 'review L3'], taskStatus: 'Completed' },
}

const extractUsername = (userName: string): string => {
  const match = userName.match(/（(.+)）$/)
  return match ? match[1] : userName
}

const TaskAssignedMatrix: React.FC<TaskAssignedMatrixProps> = ({ data }) => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { data: matrixData } = data
  
  // 分页状态
  const [paginationState, setPaginationState] = useState({
    current: 1,
    pageSize: PAGINATION_CONFIG.defaultPageSize,
  })

  const handleCellClick = (userId: number, userName: string, columnKey: string) => {
    const filterInfo = COLUMN_FILTER_MAP[columnKey as ColumnKey]
    if (!filterInfo) return

    navigate('/business/tasks', {
      state: {
        filters: {
          task_types: filterInfo.taskTypes,
          task_statuses: [filterInfo.taskStatus],
          assignee_id: userId,
          assignee_keyword: extractUsername(userName),
        },
      },
    })
  }

  const columns = [    {
      title: t('dashboard.column.userName'),
      dataIndex: 'user_name',
      key: 'user_name',
      fixed: 'left' as const,
      width: 200,
    },
    {
      title: t('dashboard.column.arrangementPending'),
      dataIndex: 'arrangement_pending',
      key: 'arrangement_pending',
      width: 120,
      align: 'center' as const,
      render: (value: number, record: TaskAssignedMatrixItem) => (
        <span
          style={{ cursor: 'pointer', color: '#1890ff' }}
          onClick={() => handleCellClick(record.user_id, record.user_name, 'arrangement_pending')}
        >
          {value}
        </span>
      ),
    },
    {
      title: t('dashboard.column.reviewL1Pending'),
      dataIndex: 'review_l1_pending',
      key: 'review_l1_pending',
      width: 120,
      align: 'center' as const,
      render: (value: number, record: TaskAssignedMatrixItem) => (
        <span
          style={{ cursor: 'pointer', color: '#1890ff' }}
          onClick={() => handleCellClick(record.user_id, record.user_name, 'review_l1_pending')}
        >
          {value}
        </span>
      ),
    },
    {
      title: t('dashboard.column.reviewL2Pending'),
      dataIndex: 'review_l2_pending',
      key: 'review_l2_pending',
      width: 120,
      align: 'center' as const,
      render: (value: number, record: TaskAssignedMatrixItem) => (
        <span
          style={{ cursor: 'pointer', color: '#1890ff' }}
          onClick={() => handleCellClick(record.user_id, record.user_name, 'review_l2_pending')}
        >
          {value}
        </span>
      ),
    },
    {
      title: t('dashboard.column.reviewL3Pending'),
      dataIndex: 'review_l3_pending',
      key: 'review_l3_pending',
      width: 120,
      align: 'center' as const,
      render: (value: number, record: TaskAssignedMatrixItem) => (
        <span
          style={{ cursor: 'pointer', color: '#1890ff' }}
          onClick={() => handleCellClick(record.user_id, record.user_name, 'review_l3_pending')}
        >
          {value}
        </span>
      ),
    },
    {
      title: t('dashboard.column.arrangementCompleted'),
      dataIndex: 'arrangement_completed',
      key: 'arrangement_completed',
      width: 120,
      align: 'center' as const,
      render: (value: number, record: TaskAssignedMatrixItem) => (
        <span
          style={{ cursor: 'pointer', color: '#1890ff' }}
          onClick={() => handleCellClick(record.user_id, record.user_name, 'arrangement_completed')}
        >
          {value}
        </span>
      ),
    },
    {
      title: t('dashboard.column.reviewCompleted'),
      dataIndex: 'review_completed',
      key: 'review_completed',
      width: 120,
      align: 'center' as const,
      render: (value: number, record: TaskAssignedMatrixItem) => (
        <span
          style={{ cursor: 'pointer', color: '#1890ff' }}
          onClick={() => handleCellClick(record.user_id, record.user_name, 'review_completed')}
        >
          {value}
        </span>
      ),
    },
    {
      title: t('dashboard.column.completionRate'),
      dataIndex: 'completion_rate',
      key: 'completion_rate',
      width: 120,
      align: 'center' as const,
      render: (value: number) => `${value}%`,
    },
  ]

  const handleTableChange = useCallback((pagination: { current?: number; pageSize?: number }) => {
    setPaginationState({
      current: pagination.current ?? 1,
      pageSize: pagination.pageSize ?? PAGINATION_CONFIG.defaultPageSize,
    })
  }, [])

  const paginationConfig = useMemo((): TablePaginationConfig => ({
    current: paginationState.current,
    pageSize: paginationState.pageSize,
    total: matrixData.length,
    showSizeChanger: true,
    pageSizeOptions: PAGINATION_CONFIG.pageSizeOptions.map(String),
    showTotal: (total: number) => t('pagination.total', { n: total }),
    style: { textAlign: 'right' },
    position: ['bottomCenter'],
  }), [paginationState, matrixData.length, t])

  return (
    <Card title={t('dashboard.taskAssignedTable')} bordered={false}>
      <Table
        columns={columns}
        dataSource={matrixData}
        rowKey="user_name"
        scroll={{ x: 700 }}
        pagination={paginationConfig}
        onChange={handleTableChange}
        size="small"
        bordered
        className="compact-table"
      />
    </Card>
  )
}

export default TaskAssignedMatrix
