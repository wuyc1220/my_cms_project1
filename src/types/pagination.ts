/** 分页请求参数 */
export interface PaginationParams {
  page: number
  page_size: number
}

/** 分页响应结构 */
export interface PaginatedResponse<T> {
  total: number
  page: number
  page_size: number
  items: T[]
}
