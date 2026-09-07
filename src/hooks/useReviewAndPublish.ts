import { useCallback, useState } from 'react'
import { App } from 'antd'
import { initiateReview, checkReviewPermission } from '../api/live'
import { checkPicturesPublishStatus } from '../api/pictures'
import { checkPackagesPublishStatus } from '../api/packages'
import { checkArchivePublishStatus } from '../api/publishes'
import { normalizeNodeCode } from '../utils/workflow'
import { useI18n } from '../i18n/useI18n'
import type { MessageKey } from '../i18n/messages'
import type { ContentLicenseRef } from '../types/content'
import { isHandledError } from '../api'


export interface UseReviewAndPublishOptions {
  contentId: number | undefined
  contentName?: string
  contentStatus?: string
  contentType?: string
  parentId?: number | undefined
  licenses?: ContentLicenseRef[]
  hasInitiatedReview?: boolean
  processes?: Array<{ node_code?: string; status?: string }>
  isTaskAssignee?: boolean
  pageReadOnly?: boolean
  isNodeReadOnly?: (nodeCode: string) => boolean
  onSuccess?: () => void
}

export interface UseReviewAndPublishReturn {
  reviewOpen: boolean
  reviewMode: 'initiate' | 'review'
  reviewReadOnly: boolean
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
  const { contentId, contentStatus, contentType, parentId, hasInitiatedReview, licenses, processes, pageReadOnly, isNodeReadOnly, onSuccess } = options
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
      const normalizedKey = normalizeNodeCode(key)
      console.log('[handleReviewAction] key=', key, 'normalizedKey=', normalizedKey, 'hasInitiatedReview=', hasInitiatedReview, 'pageReadOnly=', pageReadOnly)

      if (normalizedKey === 'ApplicationReview') {
        console.log('[handleReviewAction] ApplicationReview branch, hasInitiatedReview=', hasInitiatedReview)
        const nodeReadOnly = isNodeReadOnly?.('ApplicationReview') ?? false
        const effectiveReadOnly = pageReadOnly || nodeReadOnly

        // ApplicationReview 总是打开 initiate 模式（发起审核）
        // 如果已经发起过，显示只读状态
        if (effectiveReadOnly) {
          console.log('[handleReviewAction] ApplicationReview -> initiate mode (readOnly)')
          setReviewMode('initiate')
          setReviewReadOnly(true)
          setReviewOpen(true)
          return true
        }

        const check = checkLicenseBound(licenses, t)
        if (!check.valid) {
          message.error(check.message, 3)
          return false
        }
        console.log('[handleReviewAction] ApplicationReview -> initiate mode (new)')
        setReviewMode('initiate')
        setReviewReadOnly(false)
        setReviewOpen(true)
        return true
      }
      if (normalizedKey === 'ContentReview') {
        console.log('[handleReviewAction] ContentReview branch')
        if (!contentId) {
          message.error(t('content.msg.invalidContentId'), 3)
          return false
        }
        const nodeReadOnly = isNodeReadOnly?.('ContentReview') ?? false
        const effectiveReadOnly = pageReadOnly || nodeReadOnly

        if (effectiveReadOnly) {
          setReviewMode('review')
          setReviewReadOnly(true)
          setReviewOpen(true)
          return true
        }
        try {
          const permissionResult = await checkReviewPermission(contentId)
          setReviewMode('review')
          setReviewReadOnly(!permissionResult.has_permission)
          setReviewOpen(true)
          return true
        } catch {
          setReviewMode('review')
          setReviewReadOnly(true)
          setReviewOpen(true)
          return true
        }
      }
      if (normalizedKey === 'PublishPlan') {
        console.log('[handleReviewAction] PublishPlan branch, contentId=', contentId, 'contentType=', contentType, 'contentStatus=', contentStatus)
        if (pageReadOnly) {
          console.log('[handleReviewAction] PublishPlan -> placeholder (pageReadOnly)')
          setPlaceholderModal(label)
          return true
        }

        // 【归档校验】节目单已归档时，校验归档产物是否已发布（与后端 create_publish_plan 规则一致）
        // 必须放在状态门槛之前：归档回滚会将节目单置为 InProgress，状态门槛会先拦截导致归档校验不可达
        if (contentId && contentType === 'SCHEDULE') {
          try {
            const archiveCheck = await checkArchivePublishStatus('Content', contentId)
            if (!archiveCheck.can_publish) {
              console.log('[handleReviewAction] PublishPlan -> archived content not published')
              message.error(t('content.publishPlan.archivedContentNotPublished'), 5)
              return false
            }
          } catch (err) {
            console.log('[handleReviewAction] PublishPlan checkArchivePublishStatus error:', err)
            // 校验失败时允许继续，由后端再次校验
          }
        }

        const PUBLISH_READY_STATUSES = ['ReadyForPublish', 'Publishing', 'PublishFailed', 'Published', 'NoActiveLicense', 'Closed']
        if (!PUBLISH_READY_STATUSES.includes(contentStatus || '')) {
          const errorMsg = !contentStatus 
            ? t('content.publishPlan.dataNotLoaded')
            : t('content.publishPlan.statusNotReady')
          console.log('[handleReviewAction] PublishPlan -> status not ready:', errorMsg)
          message.error(errorMsg, 3)
          return false
        }

        // 校验海报是否已发布（只对 SCHEDULE 和 CHANNEL 类型）
        console.log('[handleReviewAction] PublishPlan checking pictures, contentType=', contentType)
        if (contentId && contentType && ['SCHEDULE', 'CHANNEL'].includes(contentType)) {
          try {
            console.log('[handleReviewAction] PublishPlan calling checkPicturesPublishStatus...')
            const checkResult = await checkPicturesPublishStatus('Content', contentId, contentType)
            console.log('[handleReviewAction] PublishPlan checkResult=', checkResult)
            if (!checkResult.can_publish) {
              message.error(
                t('content.publishPlan.picturesNotPublished', {
                  unpublished: checkResult.unpublished_count,
                  total: checkResult.total_count,
                }),
                5
              )
              return false
            }
          } catch (err) {
            console.log('[handleReviewAction] PublishPlan checkPicturesPublishStatus error:', err)
            // 校验失败时允许继续，由后端再次校验
          }
        } else {
          console.log('[handleReviewAction] PublishPlan skipping picture check (not SCHEDULE/CHANNEL or missing contentType)')
        }

        // 父频道发布状态校验由后端 _validate_parent_published 统一处理
        // 后端基于 ObjectPublishStatus.is_published（实际发布状态）判断，
        // 而非 Content.status（内容生命周期状态），避免已发布但状态非 Published 的父级被误判

        // 校验服务包是否已发布（只对 SCHEDULE 类型）
        if (contentId && contentType === 'SCHEDULE') {
          try {
            const packageCheck = await checkPackagesPublishStatus(contentId)
            if (!packageCheck.can_publish) {
              message.error(
                t('content.publishPlan.packagesNotPublished', {
                  unpublished: packageCheck.unpublished_count,
                  total: packageCheck.total_count,
                }),
                5
              )
              return false
            }
          } catch (err) {
            console.log('[handleReviewAction] PublishPlan checkPackagesPublishStatus error:', err)
            // 校验失败时允许继续，由后端再次校验
          }
        }

        console.log('[handleReviewAction] PublishPlan -> opening modal')
        setPublishPlanOpen(true)
        return true
      }

      setPlaceholderModal(label)
      return true
    },
    [licenses, hasInitiatedReview, contentStatus, contentType, t, message, contentId, parentId, pageReadOnly, isNodeReadOnly, processes]
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
