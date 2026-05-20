import request from './index'
import type { PaginatedResponse } from '../types/pagination'

export interface ScheduledTask {
  id: number
  task_type: string
  description: string
  schedule_status: 'enabled' | 'disabled'
  execution_status: 'idle' | 'running'
  cron_expression: string
  last_execution_time: string | null
  next_execution_time: string | null
  created_at: string
  modified_at: string
  execution_timeout: number
  retry_count: number
}

export interface ExecutionLog {
  id: number
  execution_time: string
  trigger_type: 'scheduled' | 'manual'
  execution_status: 'success' | 'failed' | 'running'
  duration: number | null
  result: string
}

export interface ScheduledTaskDetail extends ScheduledTask {
  execution_logs: ExecutionLog[]
}

export interface ScheduledTaskQueryParams {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export const getScheduledTasks = async (
  params: ScheduledTaskQueryParams,
): Promise<PaginatedResponse<ScheduledTask>> => {
  const response = await request.get<PaginatedResponse<ScheduledTask>>('/scheduled-tasks/', { params })
  return response.data
}

export const getScheduledTask = async (id: number): Promise<ScheduledTaskDetail> => {
  const response = await request.get<ScheduledTaskDetail>(`/scheduled-tasks/${id}`)
  return response.data
}

export const getScheduledTaskLogs = async (
  taskId: number,
  page: number = 1,
  pageSize: number = 10,
): Promise<PaginatedResponse<ExecutionLog>> => {
  const response = await request.get<PaginatedResponse<ExecutionLog>>(
    `/scheduled-tasks/${taskId}/logs`,
    { params: { page, page_size: pageSize } },
  )
  return response.data
}

export const triggerScheduledTasks = async (
  ids: number[],
): Promise<{ success: boolean; triggered: number }> => {
  try {
    const response = await request.post<{ success: boolean; triggered: number }>(
      '/scheduled-tasks/trigger',
      { ids },
    )
    return response.data
  } catch (err: unknown) {
    // 将后端返回的 BLOCKED_RUNNING / BLOCKED_DISABLED detail 作为 Error.message 抛出，
    // 供页面层按前缀分别提示。
    const resp = (err as { response?: { data?: { detail?: string } } })?.response
    const detail = resp?.data?.detail
    if (detail && (detail.startsWith('BLOCKED_RUNNING') || detail.startsWith('BLOCKED_DISABLED'))) {
      throw new Error(detail)
    }
    throw err
  }
}
