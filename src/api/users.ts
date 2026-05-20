import request from './index'
import type {
  BatchStatusPayload,
  PaginatedResponse,
  UserCreatePayload,
  UserListItem,
  UserUpdatePayload,
} from '../types/user'

export interface UserQueryParams {
  page?: number
  page_size?: number
  username?: string
  display_name?: string
  email?: string
  phone_number?: string
  status?: string
  role_ids?: number[]
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export const getUsers = async (params: UserQueryParams): Promise<PaginatedResponse<UserListItem>> => {
  const response = await request.get<PaginatedResponse<UserListItem>>('/users/', { params })
  return response.data
}

export const getUser = async (id: number): Promise<UserListItem> => {
  const response = await request.get<UserListItem>(`/users/${id}`)
  return response.data
}

export const createUser = async (payload: UserCreatePayload): Promise<UserListItem> => {
  const response = await request.post<UserListItem>('/users/', payload)
  return response.data
}

export const updateUser = async (id: number, payload: UserUpdatePayload): Promise<UserListItem> => {
  const response = await request.put<UserListItem>(`/users/${id}`, payload)
  return response.data
}

export const resetPassword = async (id: number, newPassword: string, confirmPassword: string): Promise<void> => {
  await request.post(`/users/${id}/reset-password`, { new_password: newPassword, confirm_password: confirmPassword })
}

export const toggleUserStatus = async (id: number, status: string): Promise<void> => {
  await request.patch(`/users/${id}/status`, { status })
}

export const deleteUser = async (id: number): Promise<void> => {
  await request.delete(`/users/${id}`)
}

export const batchDeleteUsers = async (ids: number[]): Promise<void> => {
  await request.post('/users/batch-delete', { ids })
}

export const batchUpdateUserStatus = async (payload: BatchStatusPayload): Promise<void> => {
  await request.post('/users/batch-status', payload)
}
