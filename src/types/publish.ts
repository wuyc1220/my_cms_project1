/**
 * 发布管理相关类型定义
 */

// 发布列表项
export interface PublishListItem {
  id: number
  entity_type: string
  entity_id: number
  entity_name?: string
  content_type?: string
  ingest_status?: string
  publish_status: string
  task_type?: 'publish' | 'unpublish'
  publish_time?: string
  unpublish_time?: string
  scheduled_time?: string
  execution_mode?: string
}

// 发布列表查询参数
export interface PublishQueryParams {
  page?: number
  page_size?: number
  content_name?: string
  content_types?: string[]
  ingest_statuses?: string[]
  publish_statuses?: string[]
  publish_time_from?: string
  publish_time_to?: string
  unpublish_time_from?: string
  unpublish_time_to?: string
}

// 发布计划创建
export interface PublishPlanCreate {
  entity_type?: string
  entity_id?: number
  entity_name?: string
  content_type?: string
  task_type: 'publish' | 'unpublish'
  execution_mode: 'now' | 'plan'
  scheduled_time?: string
}

// 发布计划更新
export interface PublishPlanUpdate {
  execution_mode: 'now' | 'plan'
  scheduled_time?: string
}

// 发布计划响应
export interface PublishPlanResponse {
  id: number
  entity_type: string
  entity_id: number
  entity_name?: string
  task_type: string
  execution_mode: string
  scheduled_time?: string
  status: string
  publish_status: string
  created_at: string
}

// 批量发布请求
export interface BatchPublishRequest {
  entity_ids: number[]
  entity_type: string
  task_type: 'publish' | 'unpublish'
  execution_mode: 'now' | 'plan'
  scheduled_time?: string
}

// 注入历史项
export interface IngestHistoryItem {
  id: number
  entity_type: string
  entity_id: number
  entity_name?: string
  action: 'REGIST' | 'UPDATE' | 'DELETE' | 'SKIP'
  status: 'success' | 'failure'
  create_date: string
  send_date?: string
  end_date?: string
  ingest_xml_path?: string
  result_xml_path?: string
  ingest_xml_url?: string
  result_xml_url?: string
}

// 注入历史查询参数
export interface IngestHistoryQueryParams {
  page?: number
  page_size?: number
  entity_type?: string
  entity_id?: number
  action?: string
  status?: string
}
