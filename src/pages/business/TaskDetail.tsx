import { useEffect, useState } from 'react'
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
  message,
} from 'antd'
import dayjs from 'dayjs'
import { getTask, assignTask } from '../../api/tasks'
import { getAuthUsers } from '../../api/dataAuth'
import { useI18n } from '../../i18n/useI18n'
import type { TaskDetail as TaskDetailType } from '../../types/task'
import type { UserSimpleItem } from '../../types/dataAuth'
import { isHandledError } from '../../api'
import SectionTitle from '../../components/SectionTitle'
import TrimInput from '../../components/TrimInput'
import ProcessedHistoryTab from '../../components/ProcessedHistoryTab'


// ─── 辅助函数 ─────────────────────────────────────────────────────────

const statusToI18nKey = (status: string): string => {
  const map: Record<string, string> = {
    'Not Assigned': 'task.status.notAssigned',
    'Pending': 'task.status.pending',
    'Completed': 'task.status.completed',
  }
  return map[status] ?? status
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const taskId = Number(id)

  const [loading, setLoading] = useState(true)
  const [task, setTask] = useState<TaskDetailType | null>(null)
  const [userOptions, setUserOptions] = useState<{ label: string; value: number }[]>([])

  const [assignOpen, setAssignOpen] = useState(false)
  const [assigneeId, setAssigneeId] = useState<number | undefined>()
  const [updateChilds, setUpdateChilds] = useState(false)
  const [assignLoading, setAssignLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const taskData = await getTask(taskId)
      setTask(taskData)
      setAssigneeId(taskData.assignee_id ?? undefined)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const users = await getAuthUsers()
      setUserOptions(
        users.map((u: UserSimpleItem) => ({
          label: u.display_name ? `${u.display_name}(${u.username})` : u.username,
          value: u.id,
        })),
      )
    } catch {
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
          <ProcessedHistoryTab entityType="task" entityId={taskId} mode="full" />
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
        destroyOnHidden
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
