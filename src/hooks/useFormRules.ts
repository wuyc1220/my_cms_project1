import { useMemo } from 'react'
import { useI18n } from '../i18n/useI18n'
import type { Rule } from 'antd/es/form'

export const useFormRules = () => {
  const { t } = useI18n()

  const maxLengthRule = useMemo(() => {
    return (max: number): Rule => ({
      validator: (_, value) => {
        if (!value) return Promise.resolve()
        const length = typeof value === 'string' ? value.length : 0
        if (length > max) {
          const exceeded = length - max
          return Promise.reject(new Error(t('common.validation.maxLength', { exceeded, max })))
        }
        return Promise.resolve()
      },
    })
  }, [t])

  return {
    maxLength: maxLengthRule,
  }
}
