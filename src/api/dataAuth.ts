import request from './index'
import type { PaginatedResponse } from '../types/pagination'
import type {
  ContentAuthAuthorizePayload,
  ContentAuthClearPayload,
  ContentAuthListItem,
  ContentAuthQueryParams,
  RoleSimpleItem,
  UserSimpleItem,
} from '../types/dataAuth'

// 获取内容列表（带授权信息）
export const getAuthContents = async (params: ContentAuthQueryParams): Promise<PaginatedResponse<ContentAuthListItem>> => {
  // 后端多选参数用逗号分隔字符串
  const query: Record<string, unknown> = {
    page: params.page,
    page_size: params.page_size,
    content_name: params.content_name || undefined,
    content_types: params.content_types?.length ? params.content_types.join(',') : undefined,
    ingest_statuses: params.ingest_statuses?.length ? params.ingest_statuses.join(',') : undefined,
    authorized_user: params.authorized_user || undefined,
    authorized_role: params.authorized_role || undefined,
    sort_by: params.sort_by || undefined,
    sort_order: params.sort_order || undefined,
  }
  const response = await request.get<PaginatedResponse<ContentAuthListItem>>('/data-authorization/contents', { params: query })
  return response.data
}

// 授权
export const authorizeContents = async (payload: ContentAuthAuthorizePayload): Promise<void> => {
  await request.post('/data-authorization/authorize', payload)
}

// 清除授权
export const clearAuth = async (payload: ContentAuthClearPayload): Promise<void> => {
  await request.post('/data-authorization/clear', payload)
}

// 批量授权
export const batchAuthorize = async (payload: ContentAuthAuthorizePayload): Promise<void> => {
  await request.post('/data-authorization/batch-authorize', payload)
}

// 批量清除
export const batchClear = async (payload: ContentAuthClearPayload): Promise<void> => {
  await request.post('/data-authorization/batch-clear', payload)
}

// 角色下拉列表
export const getAuthRoles = async (): Promise<RoleSimpleItem[]> => {
  const response = await request.get<RoleSimpleItem[]>('/data-authorization/roles')
  return response.data
}

// 用户下拉列表
export const getAuthUsers = async (): Promise<UserSimpleItem[]> => {
  const response = await request.get<UserSimpleItem[]>('/data-authorization/users')
  return response.data
}
