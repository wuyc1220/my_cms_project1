import type { PaginatedResponse } from './pagination'

export type { PaginatedResponse }

// ─── 任务列表项 ───────────────────────────────────────────────────────

export interface TaskListItem {
  id: number
  content_id: number
  content_name: string
  content_type: string
  ingest_status: string
  task_type: string
  assignee_id: number | null
  assignee_name: string | null
  task_status: string
  start_time: string | null
  end_time: string | null
  created_at: string | null
  has_children: boolean
}

// ─── 任务详情 ─────────────────────────────────────────────────────────

export interface TaskDetail {
  id: number
  content_id: number
  content_name: string
  content_type: string
  task_type: string
  assignee_id: number | null
  assignee_name: string | null
  task_status: string
  start_time: string | null
  end_time: string | null
  created_at: string | null
  updated_at: string | null
  has_children: boolean
}

// ─── 操作历史 ─────────────────────────────────────────────────────────

export interface TaskHistoryItem {
  id: number
  task_id: number
  processed_type: string
  processed_by: string | null
  processed_at: string
  previous_value: string | null
  updated_value: string | null
}

// ─── 查询参数 ─────────────────────────────────────────────────────────

export interface TaskQueryParams {
  page?: number
  page_size?: number
  task_types?: string[]
  task_statuses?: string[]
  assignee_keyword?: string
  assignee_id?: number
  assignee_is_null?: boolean
  content_name?: string
  content_id?: number
  content_types?: string[]
  time_start?: string
  time_end?: string
  end_time_start?: string
  end_time_end?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  sort_mode?: string
}

// ─── 请求体 ───────────────────────────────────────────────────────────

export interface TaskAssignPayload {
  assignee_id: number
  update_childs: boolean
}

export interface BatchAssignPayload {
  task_ids: number[]
  assignee_id: number
  update_childs: boolean
}
