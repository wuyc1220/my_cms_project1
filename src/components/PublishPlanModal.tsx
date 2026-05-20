/**
 * PublishPlanModal — 设置发布计划弹框（通用组件）
 *
 * 适用于所有 Content Type。
 * 包含 Now or Plan 开关、Date（日期）、Time（时间）。
 *
 * 原型：docs/todo.md 3.6.13 / 设置发布计划弹框
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  DatePicker,
  Form,
  Modal,
  Switch,
  TimePicker,
  message,
} from 'antd'
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

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface PublishPlanModalProps {
  open: boolean
  contentId?: number
  contentIds?: number[]
  contentName?: string
  contentType?: string
  mode?: 'publish' | 'unpublish'
  initialScheduledTime?: string  // 已有计划的 scheduled_time，用于回显
  readOnly?: boolean
  onClose: () => void
  onSuccess?: () => void
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
  readOnly = false,
  onClose,
  onSuccess,
}: PublishPlanModalProps) {
  const { t } = useI18n()
  const [form] = Form.useForm()

  const [submitting, setSubmitting] = useState(false)
  const [isPlan, setIsPlan] = useState(false)

  const isBatchMode = Boolean(contentIds && contentIds.length > 0)

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
      if (dt.isValid()) {
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
        if (mode === 'publish') {
          await batchPublish(batchData)
        } else {
          await batchUnpublish(batchData)
        }
        void message.success(t('content.publishPlan.submitSuccess'), 3)
        onSuccess?.()
        onClose()
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
  const footer = readOnly ? (
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

  return (
    <Modal
      open={open}
      title={getTitle()}
      onCancel={onClose}
      footer={footer}
      destroyOnHidden
      maskClosable={false}
      width={520}
    >
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
              />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  )
}
