import { useCallback } from 'react'
import { message } from 'antd'
import { checkSensitiveWords } from '../api/sensitiveWords'
import { useI18n } from '../i18n/useI18n'

/**
 * 敏感词预校验 Hook。
 *
 * 在表单提交前调用 `checkSensitive(data)`，若命中敏感词则弹出提示并返回 false；
 * 未命中则返回 true，可继续后续保存逻辑。
 *
 * @example
 * ```tsx
 * const { checkSensitive } = useSensitiveCheck()
 * const ok = await checkSensitive(payload)
 * if (!ok) return
 * await createProvider(payload)
 * ```
 */
export function useSensitiveCheck() {
  const { t } = useI18n()

  const checkSensitive = useCallback(
    async (data: Record<string, unknown>): Promise<boolean> => {
      try {
        const result = await checkSensitiveWords(data)
        if (result.has_sensitive) {
          void message.error(t('common.sensitiveWordDetected'), 5)
          return false
        }
        return true
      } catch {
        // 预校验接口异常时不阻塞提交，后端中间件仍会兜底拦截
        return true
      }
    },
    [t],
  )

  return { checkSensitive }
}
