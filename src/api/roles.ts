import request from './index'
import type {
  BatchStatusPayload,
  PaginatedResponse,
  RoleCreatePayload,
  RoleListItem,
  RoleUpdatePayload,
} from '../types/user'

export interface RoleQueryParams {
  page?: number
  page_size?: number
  code?: string
  name?: string
  description?: string
  status?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export const getRoles = async (params: RoleQueryParams): Promise<PaginatedResponse<RoleListItem>> => {
  const response = await request.get<PaginatedResponse<RoleListItem>>('/roles/', { params })
  return response.data
}

export const getAllRoles = async (): Promise<RoleListItem[]> => {
  const response = await request.get<RoleListItem[]>('/roles/all')
  return response.data
}

export const getRole = async (id: number): Promise<RoleListItem> => {
  const response = await request.get<RoleListItem>(`/roles/${id}`)
  return response.data
}

export const createRole = async (payload: RoleCreatePayload): Promise<RoleListItem> => {
  const response = await request.post<RoleListItem>('/roles/', payload)
  return response.data
}

export const updateRole = async (id: number, payload: RoleUpdatePayload): Promise<RoleListItem> => {
  const response = await request.put<RoleListItem>(`/roles/${id}`, payload)
  return response.data
}

export const deleteRole = async (id: number): Promise<void> => {
  await request.delete(`/roles/${id}`)
}

export const toggleRoleStatus = async (id: number, status: string): Promise<void> => {
  await request.patch(`/roles/${id}/status`, { status })
}

export const batchUpdateRoleStatus = async (payload: BatchStatusPayload): Promise<void> => {
  await request.post('/roles/batch-status', payload)
}

export const batchDeleteRoles = async (ids: number[]): Promise<void> => {
  await request.post('/roles/batch-delete', { ids })
}
