import { useState, useCallback, useMemo } from 'react'
import { Form } from 'antd'
import type { UseSearchFormReturn, UseSearchFormOptions } from '../types/searchForm'

/**
 * 查询表单 Hook
 *
 * @example
 * ```tsx
 * const { form, filters, handleSearch, handleReset, expanded, showExpand, setExpanded } = useSearchForm<UserQueryParams>({
 *   onSearch: (values) => loadList(1, values),
 *   onReset: () => loadList(1, {}),
 *   fieldsCount: 6,
 * })
 * ```
 */
export function useSearchForm<T extends object = Record<string, unknown>>(
  options: UseSearchFormOptions<T> = {}
): UseSearchFormReturn<T> {
  const { defaultValues, onSearch, onReset, fieldsCount = 0, defaultExpanded = false } = options

  const [form] = Form.useForm()
  const [filters, setFilters] = useState<T>((defaultValues || {}) as T)
  const [expanded, setExpanded] = useState(defaultExpanded)

  // 超过 4 个字段显示展开按钮
  const showExpand = useMemo(() => fieldsCount > 4, [fieldsCount])

  // 处理查询
  const handleSearch = useCallback(async () => {
    const values = await form.validateFields()

    // 统一处理字符串参数的 trim()（Bug 31427）
    const trimmedValues = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        typeof value === 'string' ? (value.trim() || undefined) : value
      ])
    ) as T

    setFilters(trimmedValues)
    await onSearch?.(trimmedValues)
  }, [form, onSearch])

  // 处理重置
  const handleReset = useCallback(() => {
    form.resetFields()
    if (defaultValues) {
      form.setFieldsValue(defaultValues)
      setFilters(defaultValues as T)
    } else {
      setFilters({} as T)
    }
    onReset?.()
  }, [form, defaultValues, onReset])

  // 带回调的重置
  const handleResetWithCallback = useCallback(
    (callback?: () => void) => {
      handleReset()
      callback?.()
    },
    [handleReset]
  )

  return {
    form,
    filters,
    setFilters,
    expanded,
    setExpanded,
    showExpand,
    handleSearch,
    handleReset,
    handleResetWithCallback,
  }
}
