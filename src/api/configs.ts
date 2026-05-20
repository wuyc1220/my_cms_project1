import request from './index'
import type {
  ConfigCreatePayload,
  ConfigListItem,
  ConfigQueryParams,
  ConfigUpdatePayload,
  PaginatedResponse,
} from '../types/config'

export const getConfigs = async (params: ConfigQueryParams): Promise<PaginatedResponse<ConfigListItem>> => {
  const response = await request.get<PaginatedResponse<ConfigListItem>>('/configs/', { params })
  return response.data
}

export const getConfig = async (id: number): Promise<ConfigListItem> => {
  const response = await request.get<ConfigListItem>(`/configs/${id}`)
  return response.data
}

export const createConfig = async (payload: ConfigCreatePayload): Promise<ConfigListItem> => {
  const response = await request.post<ConfigListItem>('/configs/', payload)
  return response.data
}

export const updateConfig = async (id: number, payload: ConfigUpdatePayload): Promise<ConfigListItem> => {
  const response = await request.put<ConfigListItem>(`/configs/${id}`, payload)
  return response.data
}

export const deleteConfig = async (id: number): Promise<void> => {
  await request.delete(`/configs/${id}`)
}

// 公开配置接口（无需认证）
export const getDefaultPageSize = async (): Promise<number> => {
  const response = await request.get<{ value: number }>('/configs/public/default-page-size')
  return response.data.value
}

export const getPasswordMinLength = async (): Promise<number> => {
  const response = await request.get<{ value: number }>('/configs/public/password-min-length')
  return response.data.value
}

export const getPublicConfig = async (key: string): Promise<string | null> => {
  const response = await request.get<{ key: string; value: string | null }>(`/configs/public/${key}`)
  return response.data.value
}
