/**
 * useTaskAssigneePermission — 任务指派人权限校验 Hook
 *
 * 用于详情页操作节点（上传海报、元数据保存等）时，
 * 校验当前用户是否是任务指派人。
 *
 * 规则：
 * - 内容审核（ContentReview / Review 节点）：调用后端接口实时校验权限
 * - 其他操作节点（含 ApplicationReview、海报、元数据等）：校验 arrangement 任务的 assignee_id
 */

import { useCallback, useRef } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useAuthStore } from '../stores/authStore'
import { checkReviewPermission } from '../api/live'
import type { ContentTaskAssignees } from '../types/content'

export interface UseTaskAssigneePermissionOptions {
  taskAssignees: ContentTaskAssignees | null
  contentId?: number
  /**
   * 是否需要强制校验任务指派人（即使 arrangement 未分配也不允许操作）
   * 默认 true
   */
  enforceAssignment?: boolean
}

export interface UseTaskAssigneePermissionReturn {
  /**
   * 校验 arrangement 任务指派人权限
   * @returns true=有权限，false=无权限
   */
  checkArrangementPermission: () => boolean

  /**
   * 通用校验：根据节点类型自动选择 arrangement 或 review 权限校验
   * ContentReview 节点调用后端接口，其他节点使用本地缓存
   * @param nodeKey 节点 key
   * @returns Promise<{allowed: boolean, message: string | null}>
   */
  checkPermissionAsync: (nodeKey: string) => Promise<{ allowed: boolean; message: string | null }>

  /**
   * 通用校验（同步）：根据节点类型自动选择 arrangement 或 review 权限校验
   * ContentReview 节点始终返回 true（由异步版本处理），其他节点使用本地缓存
   * @param nodeKey 节点 key
   * @returns true=有权限，false=无权限
   */
  checkPermission: (nodeKey: string) => boolean

  /**
   * 获取当前用户 ID
   */
  getCurrentUserId: () => number | null

  /**
   * 获取无权限时的错误消息（同步版本，仅用于非 ContentReview 节点）
   * @param nodeKey 节点 key
   * @returns 错误消息字符串
   */
  getNoPermissionMessage: (nodeKey: string) => string
}

export function useTaskAssigneePermission(
  options: UseTaskAssigneePermissionOptions
): UseTaskAssigneePermissionReturn {
  const { taskAssignees, contentId, enforceAssignment = true } = options
  const { user } = useAuthStore()
  const { t } = useI18n()

  const lastReviewMessageRef = useRef<string | null>(null)

  const isAdmin = user?.role_codes?.includes('ADMIN') ?? false

  const getCurrentUserId = useCallback((): number | null => {
    return user?.id ?? null
  }, [user?.id])

  const getNoPermissionMessage = useCallback(
    (nodeKey: string): string => {
      const normalizedKey = nodeKey.toLowerCase()

      if (
        normalizedKey === 'review' ||
        normalizedKey === 'contentreview'
      ) {
        return lastReviewMessageRef.current || t('content.msg.noTaskPermission.unassigned')
      }

      const assigneeName = taskAssignees?.arrangement_assignee_name ?? null

      if (!assigneeName) {
        return t('content.msg.noTaskPermission.unassigned')
      }

      return t('content.msg.noTaskPermission', { assignee: assigneeName })
    },
    [taskAssignees, t]
  )

  const checkArrangementPermission = useCallback((): boolean => {
    if (isAdmin) {
      return true
    }

    if (!taskAssignees) {
      return !enforceAssignment
    }

    const currentUserId = getCurrentUserId()
    if (currentUserId === null) {
      return false
    }

    if (taskAssignees.arrangement_assignee_id === null) {
      return !enforceAssignment
    }

    return currentUserId === taskAssignees.arrangement_assignee_id
  }, [isAdmin, taskAssignees, enforceAssignment, getCurrentUserId])

  const checkReviewPermissionFromBackend = useCallback(
    async (): Promise<{ allowed: boolean; message: string | null }> => {
      if (isAdmin) {
        lastReviewMessageRef.current = null
        return { allowed: true, message: null }
      }

      if (!contentId) {
        const msg = t('content.msg.noTaskPermission.unassigned')
        lastReviewMessageRef.current = msg
        return { allowed: false, message: msg }
      }

      try {
        const result = await checkReviewPermission(contentId)
        if (result.has_permission) {
          lastReviewMessageRef.current = null
          return { allowed: true, message: null }
        } else {
          let msg: string
          if (result.assignee_name) {
            msg = t('content.msg.noTaskPermission', { assignee: result.assignee_name })
          } else {
            msg = t('content.msg.noTaskPermission.unassigned')
          }
          lastReviewMessageRef.current = msg
          return { allowed: false, message: msg }
        }
      } catch {
        const msg = t('content.msg.noTaskPermission.unassigned')
        lastReviewMessageRef.current = msg
        return { allowed: false, message: msg }
      }
    },
    [isAdmin, contentId, t]
  )

  const checkPermissionAsync = useCallback(
    async (nodeKey: string): Promise<{ allowed: boolean; message: string | null }> => {
      if (isAdmin) {
        return { allowed: true, message: null }
      }

      const normalizedKey = nodeKey.toLowerCase()

      if (
        normalizedKey === 'review' ||
        normalizedKey === 'contentreview'
      ) {
        return checkReviewPermissionFromBackend()
      }

      const allowed = checkArrangementPermission()
      let msg: string | null = null
      if (!allowed) {
        const assigneeName = taskAssignees?.arrangement_assignee_name ?? null
        if (!assigneeName) {
          msg = t('content.msg.noTaskPermission.unassigned')
        } else {
          msg = t('content.msg.noTaskPermission', { assignee: assigneeName })
        }
      }
      return { allowed, message: msg }
    },
    [isAdmin, checkArrangementPermission, checkReviewPermissionFromBackend, taskAssignees, t]
  )

  const checkPermission = useCallback(
    (nodeKey: string): boolean => {
      if (isAdmin) {
        return true
      }

      const normalizedKey = nodeKey.toLowerCase()

      if (
        normalizedKey === 'review' ||
        normalizedKey === 'contentreview'
      ) {
        return true
      }

      return checkArrangementPermission()
    },
    [isAdmin, checkArrangementPermission]
  )

  return {
    checkArrangementPermission,
    checkPermissionAsync,
    checkPermission,
    getCurrentUserId,
    getNoPermissionMessage,
  }
}

export function showNoPermissionMessage(messageApi: { error: (content: string, duration?: number) => void }, t: (key: string) => string): void {
  void messageApi.error(t('content.msg.noTaskPermission'), 5)
}
