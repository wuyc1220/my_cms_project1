import request from './index'
import type {
  BatchAssignPayload,
  PaginatedResponse,
  TaskAssignPayload,
  TaskDetail,
  TaskHistoryItem,
  TaskListItem,
  TaskQueryParams,
} from '../types/task'

// ─── Task 查询 ────────────────────────────────────────────────────────

export const getTasks = async (
  params: TaskQueryParams,
): Promise<PaginatedResponse<TaskListItem>> => {
  const query: Record<string, unknown> = {
    page: params.page,
    page_size: params.page_size,
    assignee_keyword: params.assignee_keyword || undefined,
    assignee_id: params.assignee_id || undefined,
    assignee_is_null: params.assignee_is_null || undefined,
    content_name: params.content_name || undefined,
    content_id: params.content_id || undefined,
    sort_by: params.sort_by || undefined,
    sort_order: params.sort_order || undefined,
    sort_mode: params.sort_mode || undefined,
    time_start: params.time_start || undefined,
    time_end: params.time_end || undefined,
    end_time_start: params.end_time_start || undefined,
    end_time_end: params.end_time_end || undefined,
  }
  if (params.task_types?.length) {
    query.task_types = params.task_types.join(',')
  }
  if (params.task_statuses?.length) {
    query.task_statuses = params.task_statuses.join(',')
  }
  if (params.content_types?.length) {
    query.content_types = params.content_types.join(',')
  }
  const response = await request.get<PaginatedResponse<TaskListItem>>('/tasks/', {
    params: query,
  })
  return response.data
}

export const getTask = async (id: number): Promise<TaskDetail> => {
  const response = await request.get<TaskDetail>(`/tasks/${id}`)
  return response.data
}

export const assignTask = async (
  id: number,
  payload: TaskAssignPayload,
): Promise<TaskDetail> => {
  const response = await request.put<TaskDetail>(`/tasks/${id}/assign`, payload)
  return response.data
}

export const batchAssignTasks = async (
  payload: BatchAssignPayload,
): Promise<{ success: boolean; assigned_count: number }> => {
  const response = await request.put<{ success: boolean; assigned_count: number }>(
    '/tasks/batch-assign',
    payload,
  )
  return response.data
}

export const getTaskHistory = async (id: number): Promise<TaskHistoryItem[]> => {
  const response = await request.get<TaskHistoryItem[]>(`/tasks/${id}/history`)
  return response.data
}
