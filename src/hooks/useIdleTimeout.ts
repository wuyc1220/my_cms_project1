/**
 * 空闲超时检测 Hook
 *
 * 检测用户空闲时间，超过配置时间无操作则自动退出
 */

import { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout as logoutApi } from '../api/auth'
import { useAuthStore } from '../stores/authStore'
import { message } from 'antd'
import { useI18n } from '../i18n/useI18n'

interface UseIdleTimeoutOptions {
  timeoutMinutes: number // 空闲超时时间（分钟）
  enabled?: boolean // 是否启用
  onTimeout?: () => void // 超时回调
}

export function useIdleTimeout(options: UseIdleTimeoutOptions) {
  const { timeoutMinutes, enabled = true, onTimeout } = options
  const navigate = useNavigate()
  const { logout, isLoggedIn } = useAuthStore()
  const { t } = useI18n()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const handleLogout = useCallback(async () => {
    try {
      await logoutApi()
    } catch {
      // ignore
    }
    logout()
    void message.warning(t('common.idleTimeout'))
    navigate('/login', { replace: true })
    onTimeout?.()
  }, [logout, navigate, onTimeout, t])

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now()
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    if (enabled && isLoggedIn && timeoutMinutes > 0) {
      timerRef.current = setTimeout(
        handleLogout,
        timeoutMinutes * 60 * 1000
      )
    }
  }, [enabled, isLoggedIn, timeoutMinutes, handleLogout])

  // 监听用户活动
  useEffect(() => {
    if (!enabled || !isLoggedIn || timeoutMinutes <= 0) {
      return
    }

    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ]

    const handleActivity = () => {
      resetTimer()
    }

    // 添加事件监听
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    // 启动定时器
    resetTimer()

    return () => {
      // 清理事件监听
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity)
      })
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [enabled, isLoggedIn, timeoutMinutes, resetTimer])

  return {
    lastActivity: lastActivityRef.current,
    resetTimer,
  }
}
