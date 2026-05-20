/**
 * 分页配置
 */

import { getDefaultPageSize } from '../api/configs'

let cachedDefaultPageSize = 10

export const pageSizeOptions = [10, 20, 50, 100] as const

export type PageSizeOption = (typeof pageSizeOptions)[number]

export const getDefaultPageSizeConfig = async (): Promise<number> => {
  try {
    cachedDefaultPageSize = await getDefaultPageSize()
    return cachedDefaultPageSize
  } catch {
    return cachedDefaultPageSize
  }
}

export const getCachedDefaultPageSize = (): number => {
  return cachedDefaultPageSize
}

export const setDefaultPageSize = (size: number): void => {
  cachedDefaultPageSize = size
}

export const PAGINATION_CONFIG = {
  get defaultPageSize() {
    return cachedDefaultPageSize
  },
  pageSizeOptions,
} as const

import type { TablePaginationPosition } from 'antd/es/table/interface'

type ShowTotalFn = (n: number) => string

export function getClientPaginationProps(showTotal: ShowTotalFn) {
  return {
    defaultPageSize: PAGINATION_CONFIG.defaultPageSize,
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: PAGINATION_CONFIG.pageSizeOptions.map(String),
    position: ['bottomCenter'] as TablePaginationPosition[],
    showTotal,
  }
}
