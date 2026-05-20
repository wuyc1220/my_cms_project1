import { useCallback, useState } from 'react'
import { App } from 'antd'
import { initiateReview, checkReviewPermission } from '../api/live'
import { normalizeNodeCode } from '../utils/workflow'
import { useI18n } from '../i18n/useI18n'
import type { MessageKey } from '../i18n/messages'
import type { ContentLicenseRef } from '../types/content'
import { isHandledError } from '../api'


export interface UseReviewAndPublishOptions {
  contentId: number | undefined
  contentName?: string
  contentStatus?: string  // 内容当前状态
  licenses?: ContentLicenseRef[]
  hasInitiatedReview?: boolean
  processes?: Array<{ node_code?: string; status?: string }>  // ✅ 字段改为可选
  isTaskAssignee?: boolean  // 当前用户是否是任务分配人
  onSuccess?: () => void
}

export interface UseReviewAndPublishReturn {
  reviewOpen: boolean
  reviewMode: 'initiate' | 'review'
  reviewReadOnly: boolean  // 审核弹框是否只读（无审批权限时只能查看）
  publishPlanOpen: boolean
  placeholderModal: string | null
  submitting: boolean
  handleReviewAction: (key: string, label: string) => Promise<boolean>
  openReview: (mode: 'initiate' | 'review', readOnly?: boolean) => void
  closeReview: () => void
  openPublishPlan: () => void
  closePublishPlan: () => void
  closePlaceholder: () => void
  handleInitiateReview: () => Promise<void>
}

function checkLicenseBound(licenses: ContentLicenseRef[] | undefined, t: (key: MessageKey, params?: Record<string, string | number>) => string): {
  valid: boolean
  message: string
} {
  if (!licenses || licenses.length === 0) {
    return { valid: false, message: t('content.license.noLicenseBound') }
  }
  return { valid: true, message: '' }
}

export function useReviewAndPublish(
  options: UseReviewAndPublishOptions
): UseReviewAndPublishReturn {
  const { contentId, contentStatus, hasInitiatedReview, licenses, processes, onSuccess } = options
  const { t } = useI18n()
  const { message } = App.useApp()

  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewMode, setReviewMode] = useState<'initiate' | 'review'>('review')
  const [reviewReadOnly, setReviewReadOnly] = useState(false)
  const [publishPlanOpen, setPublishPlanOpen] = useState(false)
  const [placeholderModal, setPlaceholderModal] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleReviewAction = useCallback(
    async (key: string, label: string): Promise<boolean> => {
      console.log('[handleReviewAction] key:', key, 'label:', label)
      const normalizedKey = normalizeNodeCode(key)
      console.log('[handleReviewAction] normalizedKey:', normalizedKey)

      if (normalizedKey === 'ApplicationReview') {
        // 获取 ContentReview 节点的状态
        const contentReviewProcess = processes?.find((p) => p.node_code === 'ContentReview')
        const reviewStatus = contentReviewProcess?.status

        // 1. 审核进行中（Pending）→ 不允许重复提交
        if (hasInitiatedReview && reviewStatus === 'Pending') {
          message.info(t('content.applyReview.alreadyInitiated'), 3)
          return false
        }

        // 2. 审核已通过（Passed）→ 允许重新提交
        if (hasInitiatedReview && reviewStatus === 'Passed') {
          // 如果不是任务分配人，不显示确认按钮（通过 readOnly 控制）
          // 是任务分配人，打开 ReviewModal（和第一次申请一样）
          setReviewMode('initiate')
          setReviewReadOnly(false)
          setReviewOpen(true)
          return true
        }

        // 3. 审核被拒绝（Rejected）或未审核 → 允许重新提交
        // 校验是否已绑定许可证
        const check = checkLicenseBound(licenses, t)
        if (!check.valid) {
          message.error(check.message, 3)
          return false
        }
        setReviewMode('initiate')
        setReviewReadOnly(false)
        setReviewOpen(true)
        return true
      }
      if (normalizedKey === 'ContentReview') {
        // 内容审批节点：先检查权限，无权限时以只读模式打开
        if (!contentId) {
          message.error(t('content.msg.invalidContentId'), 3)
          return false
        }
        try {
          const permissionResult = await checkReviewPermission(contentId)
          setReviewMode('review')
          // 无审批权限时设为只读模式（可以查看流程但不能操作）
          setReviewReadOnly(!permissionResult.has_permission)
          setReviewOpen(true)
          return true
        } catch {
          // 接口调用失败时，仍然以只读模式打开，让用户可以查看
          setReviewMode('review')
          setReviewReadOnly(true)
          setReviewOpen(true)
          return true
        }
      }
      if (normalizedKey === 'PublishPlan') {
        // 校验内容状态是否为 ReadyForPublish
        if (contentStatus !== 'ReadyForPublish') {
          message.error(t('content.publishPlan.statusNotReady'), 3)
          return false
        }
        setPublishPlanOpen(true)
        return true
      }

      setPlaceholderModal(label)
      return true
    },
    [licenses, hasInitiatedReview, contentStatus, t, message, contentId]
  )

  const openReview = useCallback((mode: 'initiate' | 'review', readOnly = false) => {
    setReviewMode(mode)
    setReviewReadOnly(readOnly)
    setReviewOpen(true)
  }, [])

  const closeReview = useCallback(() => {
    setReviewOpen(false)
  }, [])

  const openPublishPlan = useCallback(() => {
    setPublishPlanOpen(true)
  }, [])

  const closePublishPlan = useCallback(() => {
    setPublishPlanOpen(false)
  }, [])

  const closePlaceholder = useCallback(() => {
    setPlaceholderModal(null)
  }, [])

  const handleInitiateReview = useCallback(async () => {
    if (!contentId) return
    setSubmitting(true)
    try {
      const result = await initiateReview(contentId)

      if (result.auto_approved) {
        message.success(t('content.review.autoApproved'), 3)
      } else {
        message.success(t('content.review.initiatedWithLevel', { level: result.level_required }), 3)
      }

      setReviewOpen(false)
      onSuccess?.()
    } catch (err: unknown) {
      if (isHandledError(err)) return
      // 优先从 axios 响应中提取后端返回的具体错误消息
      const axiosError = err as { response?: { data?: { detail?: string } }; message?: string }
      const detail = axiosError.response?.data?.detail
      const msg = detail || (err instanceof Error ? err.message : String(err))
      message.error(msg || t('content.review.initiateFailed'), 3)
    } finally {
      setSubmitting(false)
    }
  }, [contentId, onSuccess, t, message])

  return {
    reviewOpen,
    reviewMode,
    reviewReadOnly,
    publishPlanOpen,
    placeholderModal,
    submitting,
    handleReviewAction,
    openReview,
    closeReview,
    openPublishPlan,
    closePublishPlan,
    closePlaceholder,
    handleInitiateReview,
  }
}
