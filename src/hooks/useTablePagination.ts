import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { TableProps } from 'antd'
import { PAGINATION_CONFIG } from '../constants/pagination'
import { useI18n } from '../i18n/useI18n'

// ─── 类型 ──────────────────────────────────────────────────────────────────────

interface PaginationState {
  current: number
  pageSize: number
  total: number
}

interface UseTablePaginationOptions {
  /** 自定义默认每页条数，默认使用全局配置 */
  defaultPageSize?: number
  /** 表格变化时的回调，统一处理分页+排序 */
  onChange: (params: {
    page: number
    pageSize: number
    sortField: string | null
    sortOrder: 'ascend' | 'descend' | null
  }) => void
  /** 是否显示总数，默认 false */
  showTotal?: boolean
}

export interface UseTablePaginationReturn {
  /** 分页状态 */
  pagination: PaginationState
  /** 更新分页状态（接口返回后调用） */
  updatePagination: (response: { total: number; page: number; page_size: number }) => void
  /** 排序字段 */
  sortField: string | null
  /** 排序方向 */
  sortOrder: 'ascend' | 'descend' | null
  /** 重置排序 */
  resetSort: () => void
  /** 重置到第一页 */
  resetPagination: () => void
  /** 直接传给 Table 的 pagination 属性 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tablePaginationProps: any
  /** 直接传给 Table 的 onChange */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleTableChange: any
  /** 获取当前分页+排序参数（用于接口调用） */
  getParams: () => {
    page: number
    page_size: number
    sort_field: string | undefined
    sort_order: 'asc' | 'desc' | undefined
  }
}

// ─── 辅助类型 ────────────────────────────────────────────────────────────────

type TableOnChange = TableProps<Record<string, unknown>>['onChange']
type TableOnChangeParams = Parameters<NonNullable<TableOnChange>>

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useTablePagination(options: UseTablePaginationOptions): UseTablePaginationReturn {
  const { defaultPageSize = PAGINATION_CONFIG.defaultPageSize, onChange, showTotal = true } = options
  const { t } = useI18n()

  const [pagination, setPagination] = useState<PaginationState>({
    current: 1,
    pageSize: defaultPageSize,
    total: 0,
  })

  const [sortField, setSortField] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend' | null>(null)

  // 使用 ref 保存最新的 onChange 回调，避免闭包问题
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // ─── 分页操作 ──────────────────────────────────────────────────────────────

  const updatePagination = useCallback((response: { total: number; page: number; page_size: number }) => {
    setPagination({
      current: response.page,
      pageSize: response.page_size,
      total: response.total,
    })
  }, [])

  const resetPagination = useCallback(() => {
    setPagination((prev) => ({ ...prev, current: 1 }))
  }, [])

  const resetSort = useCallback(() => {
    setSortField(null)
    setSortOrder(null)
  }, [])

  // ─── handleTableChange ─────────────────────────────────────────────────────

  const handleTableChange = useCallback(
    (...args: TableOnChangeParams) => {
      const [paginationInfo, , sorter] = args
      console.log('handleTableChange called:', { paginationInfo, sorter })
      // 处理排序
      let newSortField: string | null = null
      let newSortOrder: 'ascend' | 'descend' | null = null
      if (!Array.isArray(sorter) && sorter.field) {
        newSortField = sorter.field as string
        newSortOrder = sorter.order as 'ascend' | 'descend' | null
      }
      console.log('Parsed sort:', { newSortField, newSortOrder })
      setSortField(newSortOrder ? newSortField : null)
      setSortOrder(newSortOrder)

      // 分页变化时，如果 pageSize 变化则重置到第一页
      const newPage = paginationInfo.pageSize !== pagination.pageSize ? 1 : paginationInfo.current ?? 1

      const params = {
        page: newPage,
        pageSize: paginationInfo.pageSize ?? PAGINATION_CONFIG.defaultPageSize,
        sortField: newSortOrder ? newSortField : null,
        sortOrder: newSortOrder,
      }
      console.log('Calling onChangeRef.current with:', params)
      onChangeRef.current(params)
    },
    [pagination.pageSize],
  )

  // ─── tablePaginationProps ──────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tablePaginationProps: any = useMemo(
    () => ({
      current: pagination.current,
      pageSize: pagination.pageSize,
      total: pagination.total,
      showSizeChanger: true,
      showQuickJumper: true,
      pageSizeOptions: PAGINATION_CONFIG.pageSizeOptions.map(String),
      style: { textAlign: 'right' },
      position: ['bottomCenter'] as const,
      ...(showTotal
        ? { showTotal: (n: number) => t('pagination.total', { n }) }
        : {}),
    }),
    [pagination.current, pagination.pageSize, pagination.total, showTotal, t],
  )

  // ─── getParams ─────────────────────────────────────────────────────────────

  const getParams = useCallback(() => {
    const sort_order: 'asc' | 'desc' | undefined =
      sortOrder === 'ascend' ? 'asc' : sortOrder === 'descend' ? 'desc' : undefined
    return {
      page: pagination.current,
      page_size: pagination.pageSize,
      sort_field: sortField ?? undefined,
      sort_order,
    }
  }, [pagination.current, pagination.pageSize, sortField, sortOrder])

  return {
    pagination,
    updatePagination,
    sortField,
    sortOrder,
    resetSort,
    resetPagination,
    tablePaginationProps,
    handleTableChange,
    getParams,
  }
}
