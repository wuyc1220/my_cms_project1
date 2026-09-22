import { Card, Button, message, Tooltip } from 'antd'
import ResizableTable from '../../../components/ResizableTable'
import type { TablePaginationConfig } from 'antd/es/table'
import { InfoCircleOutlined } from '@ant-design/icons'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
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

  const getContentDetailPath = (record: TaskListItem) => {
    const ct = record.content_type
    // 任务处理人跳转编排详情，需携带 mode=edit 才能进行内容编排（系统统一约定）
    if (ct === 'CHANNEL') return `/live/channels/${record.content_id}?mode=edit`
    if (ct === 'SCHEDULE') return `/live/schedules/${record.content_id}?mode=edit`
    return `/contents/${record.content_id}?mode=edit`
  }

  const columns = [
    {
      title: t('dashboard.column.contentName'),
      dataIndex: 'content_name',
      key: 'content_name',
      width: 330,
      ellipsis: { showTitle: false },
      render: (text: string, record: TaskListItem) => (
        <Tooltip autoAdjustOverflow={false} placement="topLeft" title={text}>
          <a
            onClick={() => {
              navigate(getContentDetailPath(record))
            }}
            style={{ cursor: 'pointer', color: '#1890ff' }}
          >
            {text}
          </a>
        </Tooltip>
      ),
    },
    {
      title: t('dashboard.column.contentType'),
      dataIndex: 'content_type',
      key: 'content_type',
      width: 200,
    },
    {
      title: t('dashboard.column.ingestStatus'),
      dataIndex: 'ingest_status',
      key: 'ingest_status',
      width: 220,
    },
    {
      title: t('dashboard.column.taskType'),
      dataIndex: 'task_type',
      key: 'task_type',
      width: 200,
    },
    {
      title: t('dashboard.column.taskStatus'),
      dataIndex: 'task_status',
      key: 'task_status',
      width: 200,
    },
    {
      title: t('dashboard.column.startTime'),
      dataIndex: 'start_time',
      key: 'start_time',
      width: 180,
      render: (v?: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: t('dashboard.action'),
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, record: TaskListItem) => (
        <Tooltip title={t('common.detail')}>
          <Button
            type="link"
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={() => {
              // 跳转至任务管理模块的任务详情页（与 TaskManagement 列表详情按钮跳转模式一致）
              navigate(`/business/tasks/${record.id}`)
            }}
          />
        </Tooltip>
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
    showQuickJumper: true ,
    pageSizeOptions: PAGINATION_CONFIG.pageSizeOptions.map(String),
    showTotal: (total: number) => t('pagination.total', { n: total }),
    style: { textAlign: 'right' },
    position: ['bottomCenter'],
  }), [paginationState, t])

  return (
    <Card title={t('dashboard.assignedToMe')}>
      <ResizableTable
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1010 }}
        pagination={paginationConfig}
        onChange={handleTableChange}
        size="small"
        className="compact-table"
      />
    </Card>
  )
}

export default AssignedToMeTable
