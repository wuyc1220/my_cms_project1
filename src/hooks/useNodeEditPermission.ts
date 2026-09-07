/**
 * useNodeEditPermission - 节点级编辑权限判断 Hook
 * 
 * 用于详情页判断每个节点（Posters、Metadata、ContentReview等）是否可编辑
 * 
 * 权限规则（新逻辑："只要审批结束就可以修改，只要修改就要重新审批"）：
 * 1. forceReadOnly → 所有节点只读（包括Admin）
 * 2. ADMIN 用户 → 所有节点可编辑
 * 3. 无任务分配信息 → 所有节点只读
 * 4. 有 Pending 的 review 任务 → 所有节点只读（审核进行中，防止并发修改）
 * 5. arrangement 节点 → 当前用户是 arrangement 分配人即可编辑
 * 6. review 节点 → 当前用户是对应 level 的 review 分配人且状态为 Pending
 */

import { useCallback } from 'react'
import type { ContentTaskAssignees } from '../types/content'

export interface UseNodeEditPermissionOptions {
  taskAssignees: ContentTaskAssignees | null
  isAdmin: boolean
  currentUserId: number | null
  forceReadOnly?: boolean
}

export interface UseNodeEditPermissionReturn {
  canEditNode: (nodeCode: string) => boolean
  isNodeReadOnly: (nodeCode: string) => boolean
  getReadOnlyReason: (nodeCode: string) => string | null
}

const ARRANGEMENT_NODES = new Set([
  'Posters',
  'Metadata',
  'Package',
  'Category',
  'CastRoleMap',
  'Materials',
  'Trailer',
  'MusicEffects',
  'InjectSubContent',
  'PhysicalChannel',
  'PublishPlan',
  'ApplicationReview',
])

const REVIEW_NODES = new Set([
  'ContentReview',
  'Review',
])

export function useNodeEditPermission(
  options: UseNodeEditPermissionOptions
): UseNodeEditPermissionReturn {
  const { taskAssignees, isAdmin, currentUserId, forceReadOnly = false } = options

  const canEditNode = useCallback(
    (nodeCode: string): boolean => {
      if (forceReadOnly) {
        return false
      }

      if (isAdmin) {
        return true
      }

      if (!taskAssignees) {
        return false
      }

      const normalizedNodeCode = nodeCode.toLowerCase()
      const isReviewNode = REVIEW_NODES.has(nodeCode) || normalizedNodeCode === 'contentreview' || normalizedNodeCode === 'review'
      const isArrangementNode = ARRANGEMENT_NODES.has(nodeCode)

      const isReviewPending =
        taskAssignees.review_l1_task_status === 'Pending' ||
        taskAssignees.review_l2_task_status === 'Pending' ||
        taskAssignees.review_l3_task_status === 'Pending'

      if (isReviewNode) {
        if (isReviewPending) {
          const hasReviewL1Permission =
            taskAssignees.review_l1_assignee_id === currentUserId &&
            taskAssignees.review_l1_task_status === 'Pending'
          const hasReviewL2Permission =
            taskAssignees.review_l2_assignee_id === currentUserId &&
            taskAssignees.review_l2_task_status === 'Pending'
          const hasReviewL3Permission =
            taskAssignees.review_l3_assignee_id === currentUserId &&
            taskAssignees.review_l3_task_status === 'Pending'
          return hasReviewL1Permission || hasReviewL2Permission || hasReviewL3Permission
        }
        return false
      }

      if (isArrangementNode) {
        if (isReviewPending) {
          return false
        }
        return taskAssignees.arrangement_assignee_id === currentUserId
      }

      return false
    },
    [forceReadOnly, isAdmin, taskAssignees, currentUserId]
  )

  const isNodeReadOnly = useCallback(
    (nodeCode: string): boolean => {
      return !canEditNode(nodeCode)
    },
    [canEditNode]
  )

  const getReadOnlyReason = useCallback(
    (nodeCode: string): string | null => {
      if (canEditNode(nodeCode)) {
        return null
      }
      return null
    },
    [canEditNode]
  )

  return {
    canEditNode,
    isNodeReadOnly,
    getReadOnlyReason,
  }
}
