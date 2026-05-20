import { Card, Table, Button, message } from 'antd'
import type { TablePaginationConfig } from 'antd/es/table'
import { InfoCircleOutlined } from '@ant-design/icons'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TaskListItem } from '../../../types/task'
import { useI18n } from '../../../i18n/useI18n'
import { getTasks } from '../../../api/tasks'
import { useAuthStore } from '../../../stores/authStore'
import { PAGINATION_CONFIG } from '../../../constants/pagination'
import { isHandledError } from '../../../api'

const AssignedToMeTable: React.FC = () => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TaskListItem[]>([])

  const [paginationState, setPaginationState] = useState({
    current: 1,
    pageSize: PAGINATION_CONFIG.defaultPageSize,
    total: 0,
  })

  const loadData = useCallback(async (page?: number, pageSize?: number) => {
    if (!user?.id) return
    setLoading(true)
    try {
      const res = await getTasks({
        page: page ?? paginationState.current,
        page_size: pageSize ?? paginationState.pageSize,
        assignee_id: user.id,
        sort_mode: 'assigned_to_me',
      })
      setData(res.items)
      setPaginationState((prev) => ({
        ...prev,
        current: res.page,
        pageSize: res.page_size,
        total: res.total,
      }))
    } catch (error) {
      if (isHandledError(error)) return
      message.error(t('dashboard.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [user?.id, paginationState.current, paginationState.pageSize, t])

  useEffect(() => {
    void loadData(1, PAGINATION_CONFIG.defaultPageSize)
  }, [])

  const columns = [
    {
      title: t('dashboard.column.contentName'),
      dataIndex: 'content_name',
      key: 'content_name',
      render: (text: string, record: TaskListItem) => (
        <a
          onClick={() => {
            navigate(`/contents/${record.content_id}`)
          }}
          style={{ cursor: 'pointer', color: '#1890ff' }}
        >
          {text}
        </a>
      ),
    },
    {
      title: t('dashboard.column.contentType'),
      dataIndex: 'content_type',
      key: 'content_type',
    },
    {
      title: t('dashboard.column.ingestStatus'),
      dataIndex: 'ingest_status',
      key: 'ingest_status',
    },
    {
      title: t('dashboard.column.taskType'),
      dataIndex: 'task_type',
      key: 'task_type',
    },
    {
      title: t('dashboard.column.taskStatus'),
      dataIndex: 'task_status',
      key: 'task_status',
    },
    {
      title: t('dashboard.column.startTime'),
      dataIndex: 'start_time',
      key: 'start_time',
    },
    {
      title: t('dashboard.action'),
      key: 'action',
      render: (_: unknown, record: TaskListItem) => (
        <Button
          type="primary"
          shape="circle"
          icon={<InfoCircleOutlined />}
          size="small"
          onClick={() => {
            navigate(`/business/tasks/${record.id}`)
          }}
        />
      ),
    },
  ]

  const handleTableChange = useCallback((pagination: { current?: number; pageSize?: number }) => {
    void loadData(pagination.current, pagination.pageSize)
  }, [loadData])

  const paginationConfig = useMemo((): TablePaginationConfig => ({
    current: paginationState.current,
    pageSize: paginationState.pageSize,
    total: paginationState.total,
    showSizeChanger: true,
    pageSizeOptions: PAGINATION_CONFIG.pageSizeOptions.map(String),
    showTotal: (total: number) => t('pagination.total', { n: total }),
    style: { textAlign: 'right' },
    position: ['bottomCenter'],
  }), [paginationState, t])

  return (
    <Card title={t('dashboard.assignedToMe')}>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={paginationConfig}
        onChange={handleTableChange}
        size="small"
        className="compact-table"
      />
    </Card>
  )
}

export default AssignedToMeTable
