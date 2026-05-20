import request from './index'
import type { ProcessedHistoryItem } from '../types/trade'

export interface OperationLogItem {
  id: number
  user_id: number | null
  user_name: string | null
  operation_type: string | null
  operation_object: string | null
  operation_content: string | null
  content_id: number | null
  entity_type: string | null
  entity_id: number | null
  previous_value: string | null
  updated_value: string | null
  updated_value_json: string | null
  operation_time: string
  ip_address: string | null
  result: string
  error_message: string | null
}

export interface OperationLogQueryParams {
  page?: number
  page_size?: number
  user_name?: string
  operation_type?: string
  operation_object?: string
  time_start?: string
  time_end?: string
  result?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  total: number
  page: number
  page_size: number
  items: T[]
}

export interface ClearLogsPayload {
  start: string
  end: string
}

export const getOperationLogs = async (
  params: OperationLogQueryParams,
): Promise<PaginatedResponse<OperationLogItem>> => {
  const response = await request.get<PaginatedResponse<OperationLogItem>>('/operation-logs/', { params })
  return response.data
}

export const getOperationLog = async (id: number): Promise<OperationLogItem> => {
  const response = await request.get<OperationLogItem>(`/operation-logs/${id}`)
  return response.data
}

export const exportOperationLogs = async (params: Omit<OperationLogQueryParams, 'page' | 'page_size'>): Promise<void> => {
  const response = await request.get('/operation-logs/export', {
    params,
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'operation_logs.xlsx')
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export const clearOperationLogs = async (payload: ClearLogsPayload): Promise<{ deleted: number }> => {
  const response = await request.delete<{ success: boolean; deleted: number }>('/operation-logs/clear', {
    data: payload,
  })
  return response.data
}

export const getProcessedHistory = async (params: {
  entity_type: string
  entity_id: number
  limit?: number
}): Promise<ProcessedHistoryItem[]> => {
  const response = await request.get<ProcessedHistoryItem[]>('/operation-logs/history', { params })
  return response.data
}

export const getContentHistory = async (params: {
  content_id: number
  limit?: number
}): Promise<ProcessedHistoryItem[]> => {
  const response = await request.get<ProcessedHistoryItem[]>('/operation-logs/content-history', { params })
  return response.data
}
