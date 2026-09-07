// 内容（Content）域类型定义 — 交易管理视角

/** 许可证平台项 */
export interface LicensePlatformItem {
  platform: string
  ad_rights: boolean
}

/** 内容关联许可证简要信息 */
export interface ContentLicenseRef {
  id: number
  name: string
  contract_id: number
  contract_name: string
  provider_id: number
  provider_name: string
  service_type: string
  service_type_name?: string
  start_date?: string
  end_date?: string
  platforms?: LicensePlatformItem[]
}

/** 相邻内容 ID 响应 */
export interface AdjacentContentResponse {
  prev_id: number | null
  next_id: number | null
}

/** 内容列表项（交易视角）*/
export interface ContentListItem {
  id: number
  content_type: string
  title: string
  status: string
  external_id?: string
  parent_id?: number
  parent_title?: string
  genre_id?: number
  genre_name?: string
  genre_ids?: number[]
  custom_tag_ids?: number[]
  custom_tag_names?: string[]
  sequence?: number
  series_ordinal?: number
  volumn_count?: number
  begin_time?: string
  end_time?: string
  license_count: number
  license_start?: string
  license_end?: string
  created_at?: string
  is_archived?: boolean
  source_schedule_id?: number
  is_discarded?: boolean
  cutv_enable?: boolean
  assignee_name?: string
  /** 内容编排任务（arrangement）的开始/结束时间（子内容列表 Start/End Date Time 列） */
  task_start_time?: string
  task_end_time?: string
}

/** SEASON 明细行（创建 SEASON 时的动态表格）*/
export interface SeasonDetailRow {
  series_ordinal: number
  episode_count: number
}

/** 新建内容请求体 */
export interface ContentCreatePayload {
  title: string
  content_type: string
  genre_ids?: number[]
  custom_tag_ids?: number[]
  // EPISODE
  parent_id?: number   // 父 SERIES（EPISODE）/ 父 SEASON（SEASON_SERIES）/ 父 CHANNEL（SCHEDULE）
  sequence?: number
  // SERIES / SEASON_SERIES
  series_type?: number  // 1=SERIES，2=SEASON_SERIES，3=SEASON
  volumn_count?: number
  series_ordinal?: number
  // SEASON
  season_details?: SeasonDetailRow[]
  // SCHEDULE
  begin_time?: string
  end_time?: string
  // Assign To
  assignee_id?: number
}

/** 批量导入条目 */
export interface BatchImportItem {
  title: string
  content_type: 'SERIES' | 'SEASON_SERIES' | 'EPISODE'
  series_ordinal?: number | null
  sequence?: number | null
  series_type?: number
  assignee_id?: number | null
}

/** 批量导入请求 */
export interface BatchImportRequest {
  parent_id: number
  items: BatchImportItem[]
}

/** 批量导入单条结果 */
export interface BatchImportResultItem {
  title: string
  content_id?: number | null
  success: boolean
  error?: string | null
}

/** 批量导入响应 */
export interface BatchImportResponse {
  success_count: number
  failed_count: number
  details: BatchImportResultItem[]
}

/** 编辑内容请求体 */
export interface ContentUpdatePayload {
  title?: string
  genre_ids?: number[]
  custom_tag_ids?: number[]
  parent_id?: number
  sequence?: number
  begin_time?: string
  end_time?: string
  cutv_enable?: boolean
  is_archived?: boolean
}

/** 内容简要信息（父级下拉） */
export interface ContentSimpleItem {
  id: number
  content_type: string
  title: string
}

/** VOD 内容列表项（点播管理视角）*/
export interface VodContentListItem {
  id: number
  content_type: string
  title: string
  status: string
  genre_id?: number
  genre_name?: string
  genre_ids?: number[]
  type_name?: string
  category_name?: string
  custom_tag_names?: string[]
  unpublish_date?: string
  publish_date?: string
  poster_url?: string
  package_names: string[]
  provider_names: string[]
  license_start?: string
  license_end?: string
  created_at?: string
  is_discarded?: boolean
}

/** VOD 内容查询参数 */
export interface VodContentQueryParams {
  page?: number
  page_size?: number
  title?: string
  content_types?: string[]
  statuses?: string[]
  genre_ids?: number[]
  custom_tag_ids?: number[]
  deleted?: string
  type_ids?: number[]
  category_name?: string
  package_ids?: number[]
  provider_ids?: number[]
  license_start_from?: string
  license_start_to?: string
  license_end_from?: string
  license_end_to?: string
  unpublish_from?: string
  unpublish_to?: string
  publish_from?: string
  publish_to?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

/** 内容列表查询参数 */
export interface ContentQueryParams {
  page?: number
  page_size?: number
  content_id?: number
  external_id?: string
  title?: string
  content_types?: string[]
  statuses?: string[]
  genre_ids?: number[]
  custom_tag_ids?: number[]
  parent_id?: number
  created_from?: string
  created_to?: string
  without_license?: boolean
  license_start_from?: string
  license_start_to?: string
  license_end_from?: string
  license_end_to?: string
  is_discarded?: boolean
}

/** 任务指派人信息（详情页权限校验用）*/
export interface ContentTaskAssignees {
  arrangement_assignee_id: number | null
  arrangement_assignee_name: string | null
  arrangement_task_status: string | null
  review_l1_assignee_id: number | null
  review_l1_assignee_name: string | null
  review_l1_task_status: string | null
  review_l2_assignee_id: number | null
  review_l2_assignee_name: string | null
  review_l2_task_status: string | null
  review_l3_assignee_id: number | null
  review_l3_assignee_name: string | null
  review_l3_task_status: string | null
}

/** 内容详情响应（含任务指派人信息）*/
export interface ContentDetailResponse {
  content: ContentListItem
  task_assignees: ContentTaskAssignees
}
