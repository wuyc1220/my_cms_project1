/**
 * 元数据增强模块类型定义
 */

// ─── 数据源 MetadataSource ───────────────────────────────

export interface MetadataSourceListItem {
  id: number
  name: string
  content_type: string
  collect_type: string
  url: string
  api_endpoint: string | null
  auth_type: string | null
  api_key: string | null
  rate_limit: number
  status: string
  page_url_template: string | null
  render_type: string | null
  field_extract_rules: string | null
  created_at: string | null
}

export interface MetadataSourceCreatePayload {
  name: string
  content_type: string
  collect_type?: string
  url: string
  api_endpoint?: string | null
  auth_type?: string | null
  api_key?: string | null
  rate_limit?: number
  status?: string
  page_url_template?: string | null
  render_type?: string | null
  field_extract_rules?: string | null
}

export interface MetadataSourceUpdatePayload {
  name?: string | null
  content_type?: string | null
  collect_type?: string | null
  url?: string | null
  api_endpoint?: string | null
  auth_type?: string | null
  api_key?: string | null
  rate_limit?: number | null
  status?: string | null
  page_url_template?: string | null
  render_type?: string | null
  field_extract_rules?: string | null
}

export interface MetadataSourceQueryParams {
  page?: number
  page_size?: number
  name?: string
  content_types?: string[]
  collect_types?: string[]
  statuses?: string[]
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface BatchStatusPayload {
  ids: number[]
  status: string
}

// ─── 爬取任务 MetadataCrawlTask ─────────────────────────

export interface CrawlTaskListItem {
  id: number
  object_name: string
  object_type: string
  source_id: number | null
  source_name: string | null
  crawl_status: string
  created_at: string | null
  completed_at: string | null
}

export interface CrawlDetailItem {
  id: number
  task_id: number
  field_name: string
  field_code: string
  crawl_data: string | null
  is_used: string
  created_at: string | null
}

export interface CrawlTaskDetail {
  id: number
  object_name: string
  object_type: string
  source_id: number | null
  source_name: string | null
  crawl_status: string
  error_message: string | null
  created_at: string | null
  completed_at: string | null
  details: CrawlDetailItem[]
}

export interface CrawlTaskQueryParams {
  page?: number
  page_size?: number
  source_name?: string
  object_name?: string
  object_types?: string[]
  crawl_statuses?: string[]
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// ─── 爬取请求与结果 ──────────────────────────────────────

export interface CrawlRequestPayload {
  object_name: string
  object_type: string
  field_codes: Array<{ code: string; name: string }>
}

export interface CrawlFieldCandidate {
  detail_id: number
  field_code: string
  field_name: string
  crawl_data: string | null
  source_name: string | null
}

export interface CrawlProgressItem {
  task_id: number
  source_name: string
  crawl_status: string
  progress: number
}

export interface CrawlResponse {
  object_name: string
  object_type: string
  progress_items: CrawlProgressItem[]
  field_candidates: Record<string, CrawlFieldCandidate[]>
}

export interface CrawlConfirmSelection {
  detail_id: number
  is_used: string
}

export interface CrawlConfirmPayload {
  selections: CrawlConfirmSelection[]
}

export interface CrawlConfirmResult {
  success: boolean
  selected_fields: Array<{
    field_code: string
    field_name: string
    crawl_data: string | null
  }>
}
