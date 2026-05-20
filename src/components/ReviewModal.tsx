/**
 * ReviewModal — 内容审核弹框（通用组件）
 *
 * 支持两种模式：
 * 1. 发起审核（initiate）：内容编辑点击"发起审核"按钮
 * 2. 审批操作（approve/reject）：审批人进行审批
 *
 * 原型：docs/todo.md 3.6.11 / 审核页面弹框
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Spin,
  Steps,
  message,
} from 'antd'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { getDictTree } from '../api/dicts'
import { initiateReview, submitReview, getReviewStatus } from '../api/live'
import { useI18n } from '../i18n/useI18n'
import { useFormRules } from '../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../constants/form'
import type { DictNodeListItem } from '../types/dict'
import { isHandledError } from '../api'


const { TextArea } = Input

/* ─── 辅助函数 ────────────────────────────────────────────────────────────── */

/** 从字典树中提取指定 code 的选项列表 */
function extractDictOptions(
  tree: DictNodeListItem[],
  code: string
): { label: string; value: string }[] {
  for (const node of tree) {
    if (node.code === code) {
      return node.children.map((c) => ({ label: c.name, value: c.code }))
    }
    if (node.children.length) {
      const found = extractDictOptions(node.children, code)
      if (found.length) return found
    }
  }
  return []
}

/** 将审核状态映射为 Steps 组件的 status */
function getStepStatus(
  status: string | null
): 'finish' | 'error' | 'process' | 'wait' {
  if (!status || status === 'None' || status === 'Not Assigned') return 'wait'
  if (status === 'Passed') return 'finish'
  if (status === 'Rejected') return 'error'
  if (status === 'Pending') return 'process'
  return 'wait'
}



/* ─── 类型定义 ───────────────────────────────────────────────────────────── */

interface ReviewStatus {
  id: number
  content_id: number
  review_level: string
  level_required: number
  level_1_status: string
  level_1_by: string | null
  level_1_at: string | null
  level_2_status: string
  level_2_by: string | null
  level_2_at: string | null
  level_3_status: string
  level_3_by: string | null
  level_3_at: string | null
  final_status: string
  initiated_by: string
  initiated_at: string
  completed_at: string | null
}

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface ReviewModalProps {
  open: boolean
  contentId: number
  contentName?: string
  mode: 'initiate' | 'review'
  readOnly?: boolean
  onClose: () => void
  onSuccess?: () => void
}

/* ─── 主组件 ─────────────────────────────────────────────────────────────── */

export default function ReviewModal({
  open,
  contentId,
  contentName: _contentName,
  mode,
  readOnly = false,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const { t } = useI18n()
  const formRules = useFormRules()
  const [form] = Form.useForm()

  const [submitting, setSubmitting] = useState(false)
  const [dictLoading, setDictLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [issueTypeOptions, setIssueTypeOptions] = useState<{ label: string; value: string }[]>([])
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | null>(null)

  /* ── 加载字典选项和审核状态 ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return
    
    // 加载问题类型字典
    setDictLoading(true)
    getDictTree({ code: 'Content_Issue_Types' })
      .then((tree) => {
        const options = extractDictOptions(tree, 'Content_Issue_Types')
        setIssueTypeOptions(options)
      })
      .catch(() => {
        void message.error(t('content.review.loadConfigFailed'), 3)
      })
      .finally(() => setDictLoading(false))
    
    // 如果是审批模式，加载当前审核状态
    if (mode === 'review') {
      setStatusLoading(true)
      getReviewStatus(contentId)
        .then((status) => {
          setReviewStatus(status)
        })
        .catch(() => {
          // 可能还没有审核记录
          setReviewStatus(null)
        })
        .finally(() => setStatusLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  /* ── 关闭时重置表单 ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) {
      form.resetFields()
      setReviewStatus(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /* ── 发起审核 ──────────────────────────────────────────────────────────── */
  const handleInitiate = useCallback(async () => {
    try {
      setSubmitting(true)
      const result = await initiateReview(contentId)
      
      if (result.auto_approved) {
        void message.success(t('content.review.autoApproved'), 3)
      } else {
        void message.success(t('content.review.initiatedWithLevel', { level: result.level_required }), 3)
      }
      
      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const msg = err instanceof Error ? err.message : String(err)
      void message.error(msg || t('content.review.initiateFailed'), 3)
    } finally {
      setSubmitting(false)
    }
  }, [contentId, onClose, onSuccess])

  /* ── 获取当前审批级别 ──────────────────────────────────────────────────── */
  const getCurrentReviewLevel = useCallback((): 'L1' | 'L2' | 'L3' => {
    if (!reviewStatus) return 'L1'
    // 根据审批状态判断当前级别
    // L1 未完成时，返回 L1
    if (reviewStatus.level_1_status === 'Pending') return 'L1'
    // L1 已完成，但 L2 未完成时，返回 L2
    if (reviewStatus.level_1_status === 'Passed' && 
        (reviewStatus.level_2_status === 'Pending' || reviewStatus.level_2_status === 'Not Assigned' || !reviewStatus.level_2_status)) {
      return 'L2'
    }
    // L2 已完成，但 L3 未完成时，返回 L3
    if (reviewStatus.level_2_status === 'Passed' && 
        (reviewStatus.level_3_status === 'Pending' || reviewStatus.level_3_status === 'Not Assigned' || !reviewStatus.level_3_status)) {
      return 'L3'
    }
    // 默认返回 L1
    return 'L1'
  }, [reviewStatus])

  /* ── 提交审批 ──────────────────────────────────────────────────────────── */
  const handleSubmit = useCallback(
    async (reviewType: 'approve' | 'reject') => {
      try {
        const values = await form.validateFields()

        // 不通过时，Content Issue Types 必填
        if (reviewType === 'reject' && (!values.issue_types || values.issue_types.length === 0)) {
          void message.error(t('content.review.issueTypesRequired'), 3)
          return
        }

        setSubmitting(true)
        const reviewLevel = getCurrentReviewLevel()
        await submitReview(contentId, {
          review_type: reviewType,
          issue_types: values.issue_types,
          description: values.description,
          review_level: reviewLevel,
        })
        void message.success(t('content.review.submitSuccess'), 3)
        onSuccess?.()
        onClose()
      } catch (err: unknown) {
        if (isHandledError(err)) return
        // 从 axios 错误中提取后端返回的详细错误消息
        const axiosError = err as { response?: { data?: { detail?: string } }; message?: string }
        const detail = axiosError.response?.data?.detail
        const msg = detail || (err instanceof Error ? err.message : String(err))
        if (msg && msg !== 'Validation failed') {
          // 只显示后端返回的错误消息，不显示额外的通用错误提示
          void message.error(msg, 3)
        }
      } finally {
        setSubmitting(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contentId, form, onClose, onSuccess, getCurrentReviewLevel]
  )

  /* ── 渲染发起审核模式 ──────────────────────────────────────────────────── */
  if (mode === 'initiate') {
    return (
      <Modal
        open={open}
        title={t('content.review.initiateTitle')}
        onCancel={onClose}
        footer={
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <Button onClick={onClose} style={{ minWidth: 100 }}>
              {t('common.cancel')}
            </Button>
            {!readOnly && (
              <Button
                type="primary"
                onClick={handleInitiate}
                loading={submitting}
                style={{ minWidth: 100 }}
              >
                {t('content.review.confirm')}
              </Button>
            )}
          </div>
        }
        destroyOnHidden
        maskClosable={false}
        width={480}
      >
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 16, marginBottom: 16 }}>
            {t('content.review.confirmInitiate')}
          </p>
          <p style={{ color: '#666', fontSize: 14 }}>
            {t('content.review.initiateDetail')}
          </p>
        </div>
      </Modal>
    )
  }

  /* ── 渲染审批操作模式 ──────────────────────────────────────────────────── */

  // 如果没有审核记录，显示提示并引导发起审核
  if (!statusLoading && (!reviewStatus || reviewStatus.final_status === 'None')) {
    return (
      <Modal
        open={open}
        title={t('content.review.title')}
        onCancel={onClose}
        footer={
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <Button onClick={onClose} style={{ minWidth: 100 }}>
              {t('common.cancel')}
            </Button>
            {!readOnly && (
              <Button
                type="primary"
                onClick={handleInitiate}
                loading={submitting}
                style={{ minWidth: 100 }}
              >
                {t('content.review.initiateReview')}
              </Button>
            )}
          </div>
        }
        destroyOnHidden
        maskClosable={false}
        width={480}
      >
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 16, marginBottom: 16 }}>
            {t('content.review.notInitiated')}
          </p>
          <p style={{ color: '#666', fontSize: 14 }}>
            {t('content.review.pleaseInitiate')}，{t('content.review.initiateDetail')}
          </p>
        </div>
      </Modal>
    )
  }

  const reviewSteps = (() => {
    if (!reviewStatus) return { items: [], current: 0 }

    const finishIcon = (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: '50%',
          backgroundColor: '#52c41a',
          color: '#fff',
        }}
      >
        <CheckOutlined style={{ fontSize: 12 }} />
      </span>
    )

    const errorIcon = (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: '50%',
          backgroundColor: '#ff4d4f',
          color: '#fff',
        }}
      >
        <CloseOutlined style={{ fontSize: 12 }} />
      </span>
    )

    const levelIcon = (label: string) => (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: '50%',
          backgroundColor: '#e5e7eb',
          color: '#666',
          fontSize: 11,
        }}
      >
        {label}
      </span>
    )

    // 审核状态标签映射
    const STATUS_LABEL: Record<string, string> = {
      Passed: t('content.review.passed'),
      Rejected: t('content.review.rejected'),
      Pending: t('content.review.pending'),
      'Not Assigned': t('content.review.notAssigned'),
    }

    const items: {
      title: string
      description?: string
      status: 'finish' | 'error' | 'process' | 'wait'
      icon?: React.ReactNode
    }[] = []

    items.push({
      title: t('content.review.initiator'),
      description: reviewStatus.initiated_by,
      status: 'finish',
      icon: finishIcon,
    })

    let terminated = false

    if (reviewStatus.level_required >= 1 && !terminated) {
      const s = reviewStatus.level_1_status
      const stepStatus = getStepStatus(s)
      items.push({
        title: t('content.review.level1'),
        description: reviewStatus.level_1_by
          ? `${reviewStatus.level_1_by} · ${STATUS_LABEL[s] ?? s}`
          : STATUS_LABEL[s] ?? t('content.review.pending'),
        status: stepStatus,
        icon:
          stepStatus === 'finish'
            ? finishIcon
            : stepStatus === 'error'
              ? errorIcon
              : levelIcon('L1'),
      })
      if (stepStatus === 'error') terminated = true
    }

    if (reviewStatus.level_required >= 2 && !terminated) {
      const s = reviewStatus.level_2_status
      const stepStatus = getStepStatus(s)
      items.push({
        title: t('content.review.level2'),
        description: reviewStatus.level_2_by
          ? `${reviewStatus.level_2_by} · ${STATUS_LABEL[s] ?? s}`
          : STATUS_LABEL[s] ?? t('content.review.pending'),
        status: stepStatus,
        icon:
          stepStatus === 'finish'
            ? finishIcon
            : stepStatus === 'error'
              ? errorIcon
              : levelIcon('L2'),
      })
      if (stepStatus === 'error') terminated = true
    }

    if (reviewStatus.level_required >= 3 && !terminated) {
      const s = reviewStatus.level_3_status
      const stepStatus = getStepStatus(s)
      items.push({
        title: t('content.review.level3'),
        description: reviewStatus.level_3_by
          ? `${reviewStatus.level_3_by} · ${STATUS_LABEL[s] ?? s}`
          : STATUS_LABEL[s] ?? t('content.review.pending'),
        status: stepStatus,
        icon:
          stepStatus === 'finish'
            ? finishIcon
            : stepStatus === 'error'
              ? errorIcon
              : levelIcon('L3'),
      })
      if (stepStatus === 'error') terminated = true
    }

    const approvalIdx = items.slice(1).findIndex((item) => item.status !== 'finish')
    return { items, current: approvalIdx >= 0 ? approvalIdx + 1 : items.length - 1 }
  })()

  const footer = readOnly ? (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
      <Button onClick={onClose} style={{ minWidth: 100 }}>
        {t('common.cancel')}
      </Button>
    </div>
  ) : (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
      <Button
        onClick={() => handleSubmit('reject')}
        loading={submitting}
        disabled={dictLoading}
        style={{ minWidth: 100 }}
      >
        {t('content.review.reject')}
      </Button>
      <Button
        type="primary"
        onClick={() => handleSubmit('approve')}
        loading={submitting}
        disabled={dictLoading}
        style={{ minWidth: 100 }}
      >
        {t('content.review.approve')}
      </Button>
    </div>
  )

  return (
    <Modal
      open={open}
      title={t('content.review.title')}
      onCancel={onClose}
      footer={footer}
      destroyOnHidden
      maskClosable={false}
      width={560}
    >
      <Spin spinning={dictLoading || statusLoading}>
        {reviewStatus && reviewSteps.items.length > 0 && (
          <Steps
            current={reviewSteps.current}
            direction="horizontal"
            size="small"
            items={reviewSteps.items}
            style={{ marginBottom: 16, paddingTop: 15, paddingLeft: 5, paddingRight: 5 }}
          />
        )}

        {!readOnly && (
          <Form
            form={form}
            layout="vertical"
            style={{ marginTop: 16 }}
            autoComplete="off"
          >
            <Form.Item
              name="issue_types"
              label={t('content.review.issueTypes')}
            >
              <Select
                showSearch
                optionFilterProp="label"
                mode="multiple"
                allowClear
                placeholder={t('content.review.issueTypesPlaceholder')}
                options={issueTypeOptions}
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
              name="description"
              label={t('content.review.description')}
              rules={[formRules.maxLength(FORM_MAX_LENGTH.TEXT_AREA)]}
            >
              <TextArea
                rows={4}
                placeholder={t('content.review.descriptionPlaceholder')}
              />
            </Form.Item>
          </Form>
        )}
      </Spin>
    </Modal>
  )
}
