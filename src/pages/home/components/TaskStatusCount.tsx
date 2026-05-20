import { Card } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { TaskStatusCount as TaskStatusCountType } from '../../../types/dashboard'
import { useI18n } from '../../../i18n/useI18n'

interface TaskStatusCountProps {
  data: TaskStatusCountType
}

const TaskStatusCount: React.FC<TaskStatusCountProps> = ({ data }) => {
  const { t } = useI18n()
  const navigate = useNavigate()

  const statusItems = [
    { key: 'pending', label: t('dashboard.taskStatus.pending'), value: data.pending, color: '#1890ff', statusCode: 'Pending' },
    { key: 'completed', label: t('dashboard.taskStatus.completed'), value: data.completed, color: '#52c41a', statusCode: 'Completed' },
    { key: 'not_assigned', label: t('dashboard.taskStatus.notAssigned'), value: data.not_assigned, color: '#ff4d4f', statusCode: 'Not Assigned' },
  ]

  const handleClick = (statusCode: string) => {
    // 跳转到Task任务管理列表，携带查询条件
    // Pending/Completed 使用 task_statuses 查询
    // Not Assigned 使用 assignee_is_null + task_statuses 查询未分配的任务
    const filters: Record<string, unknown> = {}

    if (statusCode === 'Not Assigned') {
      // 未分配任务 - 使用 assignee_is_null + task_statuses 查询
      filters.assignee_is_null = true
      filters.task_statuses = ['Not Assigned']
    } else {
      // Pending 或 Completed - 使用 task_statuses 数组查询
      filters.task_statuses = [statusCode]
    }

    navigate('/business/tasks', {
      state: {
        filters,
      },
    })
  }

  return (
    <Card title={t('dashboard.taskStatusCount')}>
      <div style={{ display: 'flex', gap: 16 }}>
        {statusItems.map((item) => (
          <div
            key={item.key}
            style={{
              padding: '16px 24px',
              border: `1px solid ${item.color}`,
              borderRadius: 4,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s',
              flex: 1,
            }}
            onClick={() => handleClick(item.statusCode)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f6ffed'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <div style={{ color: item.color, fontSize: 16, fontWeight: 'bold' }}>
              {item.label} - {item.value}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default TaskStatusCount
