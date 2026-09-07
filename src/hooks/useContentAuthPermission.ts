/**
 * useContentAuthPermission - 内容数据权限校验 Hook
 * 
 * 用于在点击跳转到内容详情前校验用户是否有数据权限
 * 
 * 使用示例：
 * ```tsx
 * const { checkAndNavigate, isChecking } = useContentAuthPermission()
 * 
 * // 在点击事件中
 * onClick={() => checkAndNavigate(record.id, '/contents/${record.id}')}
 * ```
 */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { checkContentAuthPermission } from '../api/dataAuth'
import { useI18n } from '../i18n/useI18n'

export function useContentAuthPermission() {
  const navigate = useNavigate()
  const [isChecking, setIsChecking] = useState(false)
  const { t } = useI18n()

  /**
   * 检查权限并跳转
   * @param contentId 内容ID
   * @param targetPath 目标路径（有权限时跳转）
   * @param fallbackPath 无权限时的回退路径（可选）
   */
  const checkAndNavigate = useCallback(
    async (contentId: number, targetPath: string, fallbackPath?: string) => {
      if (isChecking) return // 防止重复点击

      try {
        setIsChecking(true)
        const result = await checkContentAuthPermission(contentId)
        
        if (!result.has_permission) {
          message.warning(t('content.msg.noDataPermission'))
          if (fallbackPath) {
            navigate(fallbackPath)
          }
          return
        }

        // 有权限，执行跳转
        navigate(targetPath)
      } catch (error) {
        console.error('检查数据权限失败:', error)
        message.error(t('content.msg.loadDetailFailed'))
      } finally {
        setIsChecking(false)
      }
    },
    [navigate, isChecking]
  )

  /**
   * 仅检查权限（不跳转）
   * @param contentId 内容ID
   * @returns Promise<boolean> 是否有权限
   */
  const checkPermission = useCallback(
    async (contentId: number): Promise<boolean> => {
      try {
        const result = await checkContentAuthPermission(contentId)
        return result.has_permission
      } catch (error) {
        console.error('检查数据权限失败:', error)
        return false
      }
    },
    []
  )

  return {
    checkAndNavigate,
    checkPermission,
    isChecking,
  }
}
