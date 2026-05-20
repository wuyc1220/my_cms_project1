import { useState, useCallback } from 'react'
import { PAGINATION_CONFIG } from '../constants/pagination'
import type { PaginatedResponse } from '../types/pagination'

interface UsePaginationOptions {
  /** 自定义默认每页条数，默认使用全局配置 */
  defaultPageSize?: number
}

interface PaginationState {
  current: number
  pageSize: number
  total: number
}

export function usePagination(options: UsePaginationOptions = {}) {
  const { defaultPageSize = PAGINATION_CONFIG.defaultPageSize } = options

  const [pagination, setPagination] = useState<PaginationState>({
    current: 1,
    pageSize: defaultPageSize,
    total: 0,
  })

  /** 更新分页状态（通常在接口返回后调用） */
  const updatePagination = useCallback((response: PaginatedResponse<unknown>) => {
    setPagination({
      current: response.page,
      pageSize: response.page_size,
      total: response.total,
    })
  }, [])

  /** 重置到第一页 */
  const resetPagination = useCallback(() => {
    setPagination((prev) => ({ ...prev, current: 1 }))
  }, [])

  /** 获取请求参数 */
  const getParams = useCallback(() => ({ page: pagination.current, page_size: pagination.pageSize }), [pagination.current, pagination.pageSize])

  return {
    pagination,
    setPagination,
    updatePagination,
    resetPagination,
    getParams,
  }
}
