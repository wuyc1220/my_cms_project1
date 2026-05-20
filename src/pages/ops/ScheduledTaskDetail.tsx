import { useCallback, useEffect, useState } from 'react'
import { Button, Empty, Form, Row, Col, Spin, Table, Tag } from 'antd'
import { LeftOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useNavigate, useParams } from 'react-router-dom'
import { getScheduledTask, getScheduledTaskLogs } from '../../api/scheduledTasks'
import TrimInput from '../../components/TrimInput'
import type { ExecutionLog, ScheduledTaskDetail as ScheduledTaskDetailType } from '../../api/scheduledTasks'
import { useI18n } from '../../i18n/useI18n'
import SectionTitle from '../../components/SectionTitle'
import { PAGINATION_CONFIG } from '../../constants/pagination'

const LOG_STATUS_COLORS: Record<string, string> = {
  success: 'success',
  failed: 'error',
  running: 'processing',
}

export default function ScheduledTaskDetail() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const taskId = Number(id)

  const [detailRecord, setDetailRecord] = useState<ScheduledTaskDetailType | null>(null)
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsPage, setLogsPage] = useState(1)
  const [logsPageSize, setLogsPageSize] = useState(PAGINATION_CONFIG.defaultPageSize)

  useEffect(() => {
    if (!id || isNaN(taskId)) return
    setLoading(true)
    getScheduledTask(taskId)
      .then((data) => setDetailRecord(data))
      .catch(() => {
      })
      .finally(() => setLoading(false))
  }, [id, taskId])

  const loadLogs = useCallback(async (page: number, pageSize: number) => {
    if (isNaN(taskId)) return
    setLogsLoading(true)
    try {
      const res = await getScheduledTaskLogs(taskId, page, pageSize)
      setLogs(res.items)
      setLogsTotal(res.total)
      setLogsPage(page)
      setLogsPageSize(pageSize)
    } catch {
    } finally {
      setLogsLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    if (!isNaN(taskId)) {
      void loadLogs(1, logsPageSize)
    }
  }, [taskId, loadLogs, logsPageSize])

  const getTaskTypeLabel = (type: string) => {
    return t(`ops.scheduledTask.taskType.${type}` as 'ops.scheduledTask.taskType.ContentOffline') || type
  }

  const logColumns: ColumnsType<ExecutionLog> = [
    {
      title: t('ops.scheduledTask.logColExecutionTime'),
      dataIndex: 'execution_time',
      width: 170,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t('ops.scheduledTask.logColTriggerType'),
      dataIndex: 'trigger_type',
      width: 110,
      render: (v: string) => t(`ops.scheduledTask.triggerType.${v}` as 'ops.scheduledTask.triggerType.scheduled'),
    },
    {
      title: t('ops.scheduledTask.logColExecutionStatus'),
      dataIndex: 'execution_status',
      width: 110,
      render: (v: string) => (
        <Tag color={LOG_STATUS_COLORS[v] ?? 'default'}>
          {t(`ops.scheduledTask.logStatus.${v}` as 'ops.scheduledTask.logStatus.success')}
        </Tag>
      ),
    },
    {
      title: t('ops.scheduledTask.logColDuration'),
      dataIndex: 'duration',
      width: 110,
      render: (v: number | null) => (v !== null ? `${v}s` : '-'),
    },
    {
      title: t('ops.scheduledTask.logColResult'),
      dataIndex: 'result',
      ellipsis: true,
    },
  ]

  if (loading) {
    return (
      <div className="main-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!detailRecord) {
    return (
      <div className="main-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description={t('common.noData')} />
      </div>
    )
  }

  const scheduleStatusLabel = t(`ops.scheduledTask.status.${detailRecord.schedule_status}` as 'ops.scheduledTask.status.enabled')
  const execStatusLabel = t(`ops.scheduledTask.execStatus.${detailRecord.execution_status}` as 'ops.scheduledTask.execStatus.idle')
  const nextExecDisplay =
    detailRecord.schedule_status === 'disabled'
      ? '-'
      : detailRecord.next_execution_time
        ? dayjs(detailRecord.next_execution_time).format('YYYY-MM-DD HH:mm:ss')
        : '-'

  return (
    <div className="main-container">
      <div style={{ marginBottom: 16 }}>
        <Button
          type="link"
          icon={<LeftOutlined />}
          onClick={() => navigate('/ops/cron')}
          style={{ padding: 0 }}
        >
          {t('common.backToList')}
        </Button>
      </div>

      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('ops.scheduledTask.basicInfo')} />
        <div style={{ paddingLeft: 20 }}>
          <Form layout="vertical">
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item label={t('ops.scheduledTask.labelTaskType')}>
                  <TrimInput
                    value={getTaskTypeLabel(detailRecord.task_type)}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('ops.scheduledTask.labelDescription')}>
                  <TrimInput
                    value={detailRecord.description}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('ops.scheduledTask.labelCron')}>
                  <TrimInput
                    value={detailRecord.cron_expression}
                    disabled
                    style={{ background: '#f5f5f5', fontFamily: 'monospace' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('ops.scheduledTask.labelScheduleStatus')}>
                  <TrimInput
                    value={scheduleStatusLabel}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('ops.scheduledTask.labelExecutionStatus')}>
                  <TrimInput
                    value={execStatusLabel}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('ops.scheduledTask.labelTimeout')}>
                  <TrimInput
                    value={`${detailRecord.execution_timeout}s`}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('ops.scheduledTask.labelRetryCount')}>
                  <TrimInput
                    value={String(detailRecord.retry_count)}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('ops.scheduledTask.labelCreatedAt')}>
                  <TrimInput
                    value={detailRecord.created_at ? dayjs(detailRecord.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('ops.scheduledTask.labelModifiedAt')}>
                  <TrimInput
                    value={detailRecord.modified_at ? dayjs(detailRecord.modified_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('ops.scheduledTask.labelLastExecution')}>
                  <TrimInput
                    value={detailRecord.last_execution_time ? dayjs(detailRecord.last_execution_time).format('YYYY-MM-DD HH:mm:ss') : '-'}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('ops.scheduledTask.labelNextExecution')}>
                  <TrimInput
                    value={nextExecDisplay}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      </div>

      <div>
        <SectionTitle title={t('ops.scheduledTask.executionLog')} />
        <div style={{ paddingLeft: 20 }}>
          <Table
            rowKey="id"
            size="small"
            bordered
            loading={logsLoading}
            dataSource={logs}
            pagination={{
              current: logsPage,
              pageSize: logsPageSize,
              total: logsTotal,
              defaultPageSize: PAGINATION_CONFIG.defaultPageSize,
              pageSizeOptions: PAGINATION_CONFIG.pageSizeOptions.map(String),
              showSizeChanger: true,
              showTotal: (total) => t('common.totalItems', { n: total }),
              position: ['bottomCenter'],
              onChange: (page, pageSize) => {
                void loadLogs(page, pageSize)
              },
            }}
            scroll={{ x: 700 }}
            columns={logColumns}
            locale={{ emptyText: t('common.noData') }}
          />
        </div>
      </div>
    </div>
  )
}
