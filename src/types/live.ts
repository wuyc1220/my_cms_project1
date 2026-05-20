// 直播管理（Live）域类型定义

// ─── 频道管理 ──────────────────────────────────────────────────────────

export interface ChannelListItem {
  id: number
  title: string
  status: string
  genre_id?: number
  genre_name?: string
  channel_number?: number | null
  language?: string[]
  category_names: string[]
  package_names: string[]
  custom_tag_names: string[]
  provider_names: string[]
  license_start?: string
  license_end?: string
  created_at?: string
}

export interface ChannelDetailItem {
  id: number
  title: string
  content_type: string
  status: string
  genre_id?: number
  genre_name?: string
  package_names: string[]
  category_names?: string[]
  provider_names: string[]
  license_start?: string
  license_end?: string
  physical_channel_count: number
  schedule_count: number
  review_status?: string
  created_at?: string
  updated_at?: string
}

export interface ChannelUpdatePayload {
  title?: string
  genre_id?: number
}

export interface ChannelQueryParams {
  page?: number
  page_size?: number
  title?: string
  statuses?: string[]
  genre_id?: number
  genre_ids?: number[]
  provider_id?: number
  provider_ids?: number[]
  package_name?: string
  package_id?: number
  package_ids?: number[]
  category_id?: number
  category_name?: string
  custom_tag_ids?: number[]
  channel_number?: string
  languages?: string[]
  license_start_from?: string
  license_start_to?: string
  license_end_from?: string
  license_end_to?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// ─── 物理频道 ───────────────────────────────────────────────────────────

export interface PhysicalChannelListItem {
  id: number
  channel_id: number
  name?: string
  channel_number?: number
  status: boolean
  mediaservice?: string
  definition?: string
  videoencode?: string
  bitrate?: string
  deeplink_ch_url?: string
  shifttime?: number
  tvod_save_time?: number
  tvod_enable?: boolean
  tstv_enable?: boolean
  cutv_enable?: boolean
  encryption?: boolean
  field_values?: Record<string, string | null>
  created_at?: string
  updated_at?: string
}

export interface PhysicalChannelCreatePayload {
  name?: string
  channel_number?: number
  status?: boolean
  mediaservice?: string
  definition?: string
  videoencode?: string
  bitrate?: string
  deeplink_ch_url?: string
  shifttime?: number
  tvod_save_time?: number
  tvod_enable?: boolean
  tstv_enable?: boolean
  cutv_enable?: boolean
  encryption?: boolean
}

// ─── 物理频道历史记录 ────────────────────────────────────────────────────

export interface PhysicalChannelHistoryItem {
  id: number
  processed_at?: string
  processed_by?: string
  processed_type: string
  mediaservice?: string
  definition?: string
  videoencode?: string
  bitrate?: string
}

export interface PhysicalChannelHistoryQueryParams {
  processed_type?: string
  processed_by?: string
  page?: number
  page_size?: number
}

// ─── 内容关联 ───────────────────────────────────────────────────────────

export interface ContentPackageRef {
  id: number
  name: string
  package_type: string
  allocated_at?: string
}

export interface ContentCategoryRef {
  id: number
  name: string
  platform: string
  parent_name?: string
  allocated_at?: string
}

// ─── 流程/日志 ───────────────────────────────────────────────────────────

export interface ProcessListItem {
  id: number
  name: string
  node_code?: string
  process_type?: string
  status?: string
  start_dt?: string
  end_dt?: string
  assigned?: string
  processed_before?: boolean
  info?: string
}

export interface StatusLogListItem {
  id: number
  processed_at?: string
  processed_by?: string
  before_status?: string
  after_status?: string
}

export interface ActivityLogListItem {
  id: number
  processed_at?: string
  processed_by?: string
  processed_type?: string
  details?: string
  previous_value?: string
  updated_value?: string
  updated_value_json?: string
  entity_type?: string
}

// ─── 节目单管理 ────────────────────────────────────────────────────────

export interface ScheduleListItem {
  id: number
  title: string
  status: string
  content_type?: string
  channel_id?: number
  channel_name?: string
  begin_time?: string
  end_time?: string
  cutv_enable?: boolean
  is_archived?: boolean
  archive_content_id?: number | null
  archive_content_type?: string | null
  archive_published?: boolean
  archive_scheduled_time?: string | null
  review_status?: string
  created_at?: string
}

export interface ScheduleCreatePayload {
  title: string
  parent_id: number
  begin_time: string
  end_time: string
  assign_to?: number | null
}

export interface ScheduleQueryParams {
  page?: number
  page_size?: number
  title?: string
  channel_id?: number
  channel_name?: string
  cutv_enable?: boolean
  cutv_enables?: string[]
  is_archived?: boolean
  begin_from?: string
  begin_to?: string
  end_from?: string
  end_to?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// ─── 归档管理 ──────────────────────────────────────────────────────────

export interface ArchiveListItem {
  id: number
  content_type: string
  title: string
  status: string
  genre_id?: number
  genre_name?: string
  type_name?: string
  channel_name?: string
  begin_time?: string
  end_time?: string
  category_names: string[]
  package_names: string[]
  custom_tag_names: string[]
  provider_names: string[]
  license_start?: string
  license_end?: string
  sequence?: number
  series_ordinal?: number
  created_at?: string
}

export interface ArchiveQueryParams {
  page?: number
  page_size?: number
  title?: string
  content_types?: string[]
  statuses?: string[]
  genre_id?: number
  provider_id?: number
  package_id?: number
  category_id?: number
  custom_tag_ids?: number[]
  channel_name?: string
  program_name?: string
  begin_time_from?: string
  begin_time_to?: string
  end_time_from?: string
  end_time_to?: string
  license_start_from?: string
  license_start_to?: string
  license_end_from?: string
  license_end_to?: string
  source_schedule_id?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// ─── 归档操作 ──────────────────────────────────────────────────────

export interface ArchiveRequestPayload {
  schedule_id: number
  mode?: string
  scheduled_time?: string
}

export interface ArchiveResponse {
  success: boolean
  schedule_id: number
  archive_content_id?: number
  archive_content_type?: string
  message: string
}
