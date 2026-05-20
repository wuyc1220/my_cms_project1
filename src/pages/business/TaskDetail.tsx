import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Empty,
  Form,
  Modal,
  Row,
  Col,
  Select,
  Spin,
  Switch,
  Table,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getTask, getTaskHistory, assignTask } from '../../api/tasks'
import { getAuthUsers } from '../../api/dataAuth'
import { useI18n } from '../../i18n/useI18n'
import type { TaskDetail as TaskDetailType, TaskHistoryItem } from '../../types/task'
import type { UserSimpleItem } from '../../types/dataAuth'
import { isHandledError } from '../../api'
import SectionTitle from '../../components/SectionTitle'
import TrimInput from '../../components/TrimInput'
import { PAGINATION_CONFIG } from '../../constants/pagination'


// ─── 辅助函数 ─────────────────────────────────────────────────────────

const statusToI18nKey = (status: string): string => {
  const map: Record<string, string> = {
    'Not Assigned': 'task.status.notAssigned',
    'Pending': 'task.status.pending',
    'Completed': 'task.status.completed',
  }
  return map[status] ?? status
}

const historyTypeToI18nKey = (type: string): string => {
  const map: Record<string, string> = {
    'Add': 'task.history.type.Add',
    'Update': 'task.history.type.Update',
    'Delete': 'task.history.type.Delete',
    'Assign': 'task.history.type.Assign',
    'Review': 'task.history.type.Review',
  }
  return map[type] ?? type
}

// ─── 主组件 ───────────────────────────────────────────────────────────

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const taskId = Number(id)

  const [loading, setLoading] = useState(true)
  const [task, setTask] = useState<TaskDetailType | null>(null)
  const [history, setHistory] = useState<TaskHistoryItem[]>([])
  const [userOptions, setUserOptions] = useState<{ label: string; value: number }[]>([])

  // 分配弹框
  const [assignOpen, setAssignOpen] = useState(false)
  const [assigneeId, setAssigneeId] = useState<number | undefined>()
  const [updateChilds, setUpdateChilds] = useState(false)
  const [assignLoading, setAssignLoading] = useState(false)

  // ─── 历史表格列 ─────────────────────────────────────────────────────

  const historyColumns: ColumnsType<TaskHistoryItem> = useMemo(
    () => [
      {
        title: t('task.history.processedAt'),
        dataIndex: 'processed_at',
        key: 'processed_at',
        width: 180,
        render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        title: t('task.history.processedBy'),
        dataIndex: 'processed_by',
        key: 'processed_by',
        width: 160,
        render: (val: string | null) => val || '—',
      },
      {
        title: t('task.history.processedType'),
        dataIndex: 'processed_type',
        key: 'processed_type',
        width: 120,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        render: (val: string) => t(historyTypeToI18nKey(val) as any),
      },
      {
        title: t('task.history.previousValue'),
        dataIndex: 'previous_value',
        key: 'previous_value',
        ellipsis: { showTitle: false },
        render: (val: string | null) => val || '—',
      },
      {
        title: t('task.history.updatedValue'),
        dataIndex: 'updated_value',
        key: 'updated_value',
        ellipsis: { showTitle: false },
        render: (val: string | null) => val || '—',
      },
    ],
    [t],
  )

  // ─── 数据加载 ─────────────────────────────────────────────────────────

  const loadData = async () => {
    setLoading(true)
    try {
      const [taskData, historyData] = await Promise.all([
        getTask(taskId),
        getTaskHistory(taskId),
      ])
      setTask(taskData)
      setHistory(historyData)
      setAssigneeId(taskData.assignee_id ?? undefined)
    } catch (err) {
      // 错误已在拦截器中处理
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const users = await getAuthUsers()
      setUserOptions(
        users.map((u: UserSimpleItem) => ({
          label: u.display_name ? `${u.display_name}（${u.username}）` : u.username,
          value: u.id,
        })),
      )
    } catch (err) {
      setUserOptions([])
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
    void loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  // ─── 分配 ─────────────────────────────────────────────────────────────


  const handleAssignSubmit = async () => {
    if (!assigneeId) {
      void message.warning(t('task.modal.assignToRequired'), 3)
      return
    }
    setAssignLoading(true)
    try {
      await assignTask(taskId, { assignee_id: assigneeId, update_childs: updateChilds })
      void message.success(t('task.msg.assigned'), 3)
      setAssignOpen(false)
      void loadData()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('task.msg.assignFailed'), 5)
    } finally {
      setAssignLoading(false)
    }
  }

  // ─── 渲染 ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="main-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!task) {
    return (
      <div className="main-container">
        <Empty description={t('common.noData')} />
      </div>
    )
  }

  const statusLabel = (() => {
    const key = statusToI18nKey(task.task_status)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return t(key as any)
  })()

  return (
    <div className="main-container">
      {/* 基本信息 */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('task.detail.basicInfo')} />
        <div style={{ paddingLeft: 20 }}>
          <Form layout="vertical">
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item label={t('task.detail.contentName')}>
                  <TrimInput value={task.content_name ?? '—'} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('task.detail.taskType')}>
                  <TrimInput value={task.task_type ?? '—'} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('task.detail.taskStatus')}>
                  <TrimInput
                    value={statusLabel}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('task.detail.startTime')}>
                  <TrimInput
                    value={task.start_time ? dayjs(task.start_time).format('YYYY-MM-DD HH:mm') : '—'}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('task.detail.endTime')}>
                  <TrimInput
                    value={task.end_time ? dayjs(task.end_time).format('YYYY-MM-DD HH:mm') : '—'}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('task.detail.assignee')}>
                  <TrimInput
                    value={task.assignee_name ?? '—'}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      </div>

      {/* 操作历史 */}
      <div>
        <SectionTitle title={t('task.detail.history')} />
        <div style={{ paddingLeft: 20 }}>
          <Table<TaskHistoryItem>
            rowKey="id"
            columns={historyColumns}
            dataSource={history}
            pagination={{
              defaultPageSize: PAGINATION_CONFIG.defaultPageSize,
              pageSizeOptions: PAGINATION_CONFIG.pageSizeOptions.map(String),
              showSizeChanger: true,
              position: ['bottomCenter'],
            }}
            size="small"
            scroll={{ x: 800 }}
            locale={{ emptyText: t('common.noData') }}
          />
        </div>
      </div>

      {/* ── 分配弹框 ──────────────────────────────────────────────── */}
      <Modal
        title={t('task.modal.assignTitle')}
        open={assignOpen}
        onOk={() => void handleAssignSubmit()}
        onCancel={() => setAssignOpen(false)}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        confirmLoading={assignLoading}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            {t('task.modal.assignTo')} <span style={{ color: '#ff4d4f' }}>*</span>
          </label>
          <Select
            placeholder={t('common.placeholder.select')}
            options={userOptions}
            value={assigneeId}
            onChange={(val) => setAssigneeId(val)}
            style={{ width: '100%' }}
            showSearch
            optionFilterProp="label"
          />
        </div>
        {task.has_children && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={updateChilds}
              onChange={(checked) => setUpdateChilds(checked)}
            />
            <span>{t('task.modal.updateChilds')}</span>
          </div>
        )}
      </Modal>
    </div>
  )
}
