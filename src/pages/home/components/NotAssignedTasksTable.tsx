import { Card, Table, Button, Modal, Form, Select, message } from 'antd'
import type { TablePaginationConfig } from 'antd/es/table'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TaskListItem } from '../../../types/task'
import type { UserListItem } from '../../../types/user'
import { useI18n } from '../../../i18n/useI18n'
import { getUsers } from '../../../api/users'
import { getTasks, assignTask } from '../../../api/tasks'
import { PAGINATION_CONFIG } from '../../../constants/pagination'
import { isHandledError } from '../../../api'


interface NotAssignedTasksTableProps {
  onDataChange?: () => void
}

const NotAssignedTasksTable: React.FC<NotAssignedTasksTableProps> = ({ onDataChange }) => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskListItem | null>(null)
  const [userOptions, setUserOptions] = useState<{ label: string; value: number }[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TaskListItem[]>([])
  const [form] = Form.useForm()

  // 分页状态
  const [paginationState, setPaginationState] = useState({
    current: 1,
    pageSize: PAGINATION_CONFIG.defaultPageSize,
    total: 0,
  })

  // 加载未分配任务列表（后端分页）
  const loadData = useCallback(async (page?: number, pageSize?: number) => {
    setLoading(true)
    try {
      const res = await getTasks({
        page: page ?? paginationState.current,
        page_size: pageSize ?? paginationState.pageSize,
        assignee_is_null: true,
        task_statuses: ['Not Assigned'],
        sort_mode: 'not_assigned',
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
  }, [paginationState.current, paginationState.pageSize, t])

  // 初始加载
  useEffect(() => {
    void loadData(1, PAGINATION_CONFIG.defaultPageSize)
  }, [])

  // 加载用户列表
  const loadUsers = async () => {
    setLoadingUsers(true)
    try {
      const res = await getUsers({
        page: 1,
        page_size: 1000,
        status: 'active',
      })
      const options = res.items.map((user: UserListItem) => ({
        label: user.display_name || user.username,
        value: user.id,
      }))
      setUserOptions(options)
    } catch (error) {
      if (isHandledError(error)) return
      message.error(t('dashboard.loadUsersFailed'))
    } finally {
      setLoadingUsers(false)
    }
  }

  // 弹窗打开时加载用户列表
  useEffect(() => {
    if (isModalOpen) {
      void loadUsers()
    }
  }, [isModalOpen])

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
          size="small"
          onClick={() => {
            setSelectedTask(record)
            setIsModalOpen(true)
          }}
        >
          {t('dashboard.assign')}
        </Button>
      ),
    },
  ]

  const handleAssign = async () => {
    try {
      const values = await form.validateFields()
      if (!selectedTask) return

      await assignTask(selectedTask.id, {
        assignee_id: values.userId,
        update_childs: false,
      })

      message.success(t('dashboard.assignSuccess'))
      setIsModalOpen(false)
      form.resetFields()
      // 刷新当前页数据
      void loadData()
      onDataChange?.()
    } catch (error) {
      if (isHandledError(error)) return
      message.error(t('dashboard.assignFailed'))
    }
  }

  // 处理分页变化
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
    <Card title={t('dashboard.notAssignedTasks')}>
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

      <Modal
        title={t('dashboard.assignTask')}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false)
          form.resetFields()
        }}
        onOk={handleAssign}
        okButtonProps={{ htmlType: 'button' }}
      >
        <Form form={form} layout="vertical" onFinish={handleAssign}>
          <Form.Item
            name="userId"
            label={t('dashboard.selectUser')}
            rules={[{ required: true, message: t('dashboard.selectUserRequired') }]}
          >
            <Select
              placeholder={t('dashboard.selectUserPlaceholder')}
              options={userOptions}
              loading={loadingUsers}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default NotAssignedTasksTable
