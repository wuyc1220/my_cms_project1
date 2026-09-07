/**
 * PublishPlanModal — 设置发布计划弹框（通用组件）
 *
 * 适用于所有 Content Type。
 * 包含 Now or Plan 开关、Date（日期）、Time（时间）。
 * 已发布时显示发布状态和发布时间。
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  DatePicker,
  Descriptions,
  Form,
  Modal,
  Switch,
  Tag,
  TimePicker,
  message,
} from 'antd'
import { CheckCircleFilled, CloseCircleFilled, SyncOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { setPublishPlan } from '../api/live'
import { batchPublish, batchUnpublish } from '../api/publishes'
import { useI18n } from '../i18n/useI18n'
import { isHandledError } from '../api'


interface ApiError {
  error_code?: string
  message?: string
  detail?: string | string[]
}

export interface PublishInfo {
  publish_status?: string
  publish_time?: string
  unpublish_time?: string
  task_type?: string
  execution_mode?: string
  scheduled_time?: string
}

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface PublishPlanModalProps {
  open: boolean
  contentId?: number
  contentIds?: number[]
  contentName?: string
  contentType?: string
  mode?: 'publish' | 'unpublish'
  initialScheduledTime?: string
  publishInfo?: PublishInfo
  hasPublishHistory?: boolean  // 是否有发布历史
  readOnly?: boolean
  preCheckFailed?: boolean  // 前置校验是否已失败（用于禁用提交按钮）
  onClose: () => void
  onSuccess?: () => void
}

/* ─── 发布状态映射 ──────────────────────────────────────────────────────── */

const PUBLISH_STATUS_MAP: Record<string, { color: string; icon: React.ReactNode }> = {
  success: { color: 'success', icon: <CheckCircleFilled /> },
  publishing: { color: 'processing', icon: <SyncOutlined spin /> },
  plan: { color: 'blue', icon: null },
  closed: { color: 'default', icon: <CloseCircleFilled /> },
  failure: { color: 'error', icon: <CloseCircleFilled /> },
  none: { color: 'default', icon: null },
}

/* ─── 主组件 ─────────────────────────────────────────────────────────────── */

export default function PublishPlanModal({
  open,
  contentId,
  contentIds,
  contentName,
  contentType,
  mode = 'publish',
  initialScheduledTime,
  publishInfo,
  hasPublishHistory = false,
  readOnly = false,
  preCheckFailed = false,
  onClose,
  onSuccess,
}: PublishPlanModalProps) {
  const { t } = useI18n()
  const [form] = Form.useForm()

  const [submitting, setSubmitting] = useState(false)
  const [isPlan, setIsPlan] = useState(false)

  const isBatchMode = Boolean(contentIds && contentIds.length > 0)

  const isPublished = publishInfo?.publish_status === 'success'
  const isClosed = publishInfo?.publish_status === 'closed'
  const isPlanned = publishInfo?.publish_status === 'plan'
  const showPublishInfo = isPublished || isClosed || isPlanned

  /* ── 关闭时重置表单 ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) {
      form.resetFields()
      setIsPlan(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /* ── 打开时若有已有计划，预填表单 ────────────────────────────────────── */
  useEffect(() => {
    if (open && initialScheduledTime) {
      const dt = dayjs(initialScheduledTime)
      // 只有计划时间在未来时才预填；已过期计划不再回填，避免用户直接提交过去时间
      if (dt.isValid() && dt.isAfter(dayjs())) {
        setIsPlan(true)
        form.setFieldsValue({
          is_plan: true,
          plan_date: dt,
          plan_time: dt,
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialScheduledTime])

  /* ── 提交 ──────────────────────────────────────────────────────────────── */
  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields()

      let scheduledTime: string | undefined = undefined
      if (isPlan && values.plan_date && values.plan_time) {
        const d = dayjs(values.plan_date)
        const tm = dayjs(values.plan_time)
        const combined = d
          .hour(tm.hour())
          .minute(tm.minute())
          .second(0)
          .millisecond(0)
        scheduledTime = combined.toISOString()
      }

      setSubmitting(true)
      if (isBatchMode && contentIds && contentIds.length > 0) {
        const batchData: { entity_ids: number[]; entity_type: string; task_type: 'publish' | 'unpublish'; execution_mode: 'now' | 'plan'; scheduled_time?: string } = {
          entity_ids: contentIds,
          entity_type: 'Content',
          task_type: mode,
          execution_mode: isPlan ? 'plan' : 'now',
          scheduled_time: scheduledTime,
        }
        let batchResult: { entity_id: number; entity_name?: string; success: boolean; message?: string }[] = []
        if (mode === 'publish') {
          batchResult = await batchPublish(batchData)
        } else {
          batchResult = await batchUnpublish(batchData)
        }
        const failed = batchResult.filter(r => !r.success)
        if (failed.length > 0) {
          const names = failed.map(f => `${f.entity_name || f.entity_id}(${f.message})`).join(', ')
          void message.error(t('content.publishPlan.batchPartialFailed') + ': ' + names, 5)
        }
        if (batchResult.some(r => r.success)) {
          void message.success(t('content.publishPlan.submitSuccess'), 3)
          onSuccess?.()
          onClose()
        } else {
          onClose()
        }
      } else if (contentId) {
        await setPublishPlan(contentId, {
          execution_mode: isPlan ? 'plan' : 'now',
          task_type: mode,
          scheduled_time: scheduledTime,
          content_type: contentType,
        })
        void message.success(t('content.publishPlan.submitSuccess'), 3)
        onSuccess?.()
        onClose()
      }
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const error = err as { _handled?: boolean; response?: { data?: ApiError } }
      if (error._handled) {
        // 全局拦截器已提示，不重复
      } else {
        const apiError = error.response?.data
        if (apiError?.detail) {
          const detailMsg = Array.isArray(apiError.detail)
            ? apiError.detail.join('; ')
            : apiError.detail
          void message.error(detailMsg, 5)
        } else {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg && msg !== 'Validation failed') {
            void message.error(t('content.publishPlan.submitFailed'), 3)
          }
        }
      }
    } finally {
      setSubmitting(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId, contentName, isPlan, isBatchMode, contentIds, form, onClose, onSuccess, mode])

  /* ── 弹框底部按钮 ──────────────────────────────────────────────────────── */
  // 只读模式或前置校验失败时隐藏 Confirm 按钮
  const footer = readOnly || preCheckFailed ? (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
      <Button onClick={onClose} style={{ minWidth: 100 }}>
        {t('content.publishPlan.cancel')}
      </Button>
    </div>
  ) : (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
      <Button onClick={onClose} disabled={submitting} style={{ minWidth: 100 }}>
        {t('content.publishPlan.cancel')}
      </Button>
      <Button type="primary" onClick={handleSubmit} loading={submitting} style={{ minWidth: 100 }}>
        {t('content.publishPlan.confirm')}
      </Button>
    </div>
  )

  // 根据模式获取标题
  const getTitle = () => {
    if (isBatchMode) {
      return mode === 'publish' ? t('content.publishPlan.batchTitle') : t('content.unpublishPlan.batchTitle')
    }
    return mode === 'publish' ? t('content.publishPlan.title') : t('content.unpublishPlan.title')
  }

  const getPublishStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      success: t('content.publishPlan.statusPublished'),
      publishing: t('content.publishPlan.statusPublishing'),
      plan: t('content.publishPlan.statusPlanned'),
      closed: t('content.publishPlan.statusClosed'),
      failure: t('content.publishPlan.statusFailed'),
      none: t('content.publishPlan.statusNone'),
    }
    return map[status] || status
  }

  return (
    <Modal
      open={open}
      title={getTitle()}
      onCancel={onClose}
      footer={footer}
      destroyOnHidden
      mask={{ closable: false }}
      width={520}
    >
      {/* 前置校验失败提示 */}
      {preCheckFailed && (
        <div style={{ padding: '20px 0', textAlign: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 16, marginBottom: 16, color: '#ff4d4f' }}>
            {t('content.publishPlan.preCheckFailed')}
          </p>
          <p style={{ color: '#666', fontSize: 14 }}>
            {t('content.publishPlan.preCheckFailedDetail')}
          </p>
        </div>
      )}

      {/* 只读模式且无发布历史时，显示提示文字 */}
      {readOnly && !hasPublishHistory && !showPublishInfo && (
        <div style={{ padding: '20px 0', textAlign: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 16, marginBottom: 16, color: '#faad14' }}>
            {t('content.publishPlan.notPublished')}
          </p>
          <p style={{ color: '#666', fontSize: 14 }}>
            {t('content.publishPlan.notPublishedDetail')}
          </p>
        </div>
      )}
      
      {showPublishInfo && publishInfo && (
        <Descriptions
          column={1}
          size="small"
          bordered
          style={{ marginBottom: 16 }}
        >
          <Descriptions.Item label={t('content.publishPlan.publishStatus')}>
            <Tag
              color={PUBLISH_STATUS_MAP[publishInfo.publish_status ?? 'none']?.color || 'default'}
              icon={PUBLISH_STATUS_MAP[publishInfo.publish_status ?? 'none']?.icon}
            >
              {getPublishStatusLabel(publishInfo.publish_status ?? 'none')}
            </Tag>
          </Descriptions.Item>
          {publishInfo.execution_mode && (
            <Descriptions.Item label={t('content.publishPlan.executionMode')}>
              {publishInfo.execution_mode === 'now'
                ? t('content.publishPlan.now')
                : t('content.publishPlan.plan')}
            </Descriptions.Item>
          )}
          {isPublished && publishInfo.publish_time && (
            <Descriptions.Item label={t('content.publishPlan.publishTime')}>
              {dayjs(publishInfo.publish_time).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          )}
          {isClosed && publishInfo.unpublish_time && (
            <Descriptions.Item label={t('content.publishPlan.unpublishTime')}>
              {dayjs(publishInfo.unpublish_time).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          )}
          {publishInfo.scheduled_time && (
            <Descriptions.Item label={t('content.publishPlan.scheduledTime')}>
              {dayjs(publishInfo.scheduled_time).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          )}
        </Descriptions>
      )}

      {/* 前置校验失败、只读模式且无发布历史时，不显示表单 */}
      {(preCheckFailed || readOnly) && !hasPublishHistory && !showPublishInfo ? (
        null  // 不显示表单，已在上方显示提示文字
      ) : !readOnly && !preCheckFailed && (
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
          autoComplete="off"
        >
          <Form.Item
            name="is_plan"
            label={t('content.publishPlan.nowOrPlan')}
            initialValue={false}
          >
            <Switch
              checked={isPlan}
              onChange={readOnly ? undefined : (checked) => {
                setIsPlan(checked)
                form.setFieldsValue({ is_plan: checked })
                if (!checked) {
                  form.setFieldsValue({ plan_date: undefined, plan_time: undefined })
                }
              }}
              disabled={readOnly}
              checkedChildren="✓"
              unCheckedChildren="✕"
            />
          </Form.Item>

          {isPlan && (
            <>
              <Form.Item
                name="plan_date"
                label={mode === 'publish' ? t('content.publishPlan.date') : t('content.publishPlan.unpublishDate')}
                rules={[{ required: true, message: t('content.publishPlan.dateRequired') }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder=""
                  disabled={readOnly}
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>

              <Form.Item
                name="plan_time"
                label={mode === 'publish' ? t('content.publishPlan.time') : t('content.publishPlan.unpublishTime')}
                rules={[{ required: true, message: t('content.publishPlan.timeRequired') }]}
              >
                <TimePicker
                  style={{ width: '100%' }}
                  format="HH:mm"
                  placeholder=""
                  disabled={readOnly}
                  disabledTime={() => {
                    const planDate = form.getFieldValue('plan_date')
                    if (planDate && planDate.isSame(dayjs(), 'day')) {
                      const currentHour = dayjs().hour()
                      const currentMinute = dayjs().minute()
                      return {
                        disabledHours: () => Array.from({ length: currentHour }, (_, i) => i),
                        disabledMinutes: (hour: number) =>
                          hour === currentHour ? Array.from({ length: currentMinute + 1 }, (_, i) => i) : [],
                      }
                    }
                    return {}
                  }}
                />
              </Form.Item>
            </>
          )}
        </Form>
      )}
    </Modal>
  )
}
