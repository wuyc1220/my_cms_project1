// 供应链（Trade）域类型定义
// Provider / Contract / License

// ─── Provider ──────────────────────────────────────────────────────────

export interface ProviderListItem {
  id: number
  provider_code?: string
  name: string
  country?: string
  review_level?: string
  l1_assignee_id?: number
  l2_assignee_id?: number
  l3_assignee_id?: number
  l1_assignee_name?: string
  l2_assignee_name?: string
  l3_assignee_name?: string
  notes?: string
  contract_count: number
  created_at?: string
}

export interface ProviderCreatePayload {
  provider_code?: string
  name: string
  country?: string
  review_level?: string
  l1_assignee_id?: number
  l2_assignee_id?: number
  l3_assignee_id?: number
  notes?: string
}

export interface ProviderUpdatePayload {
  provider_code?: string
  name?: string
  country?: string
  review_level?: string
  l1_assignee_id?: number | null
  l2_assignee_id?: number | null
  l3_assignee_id?: number | null
  notes?: string
}

export interface ProviderSimpleItem {
  id: number
  name: string
}

export interface ProviderQueryParams {
  page?: number
  page_size?: number
  provider_code?: string
  name?: string
  country?: string
  notes?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface ProcessedHistoryItem {
  id: number
  processed_at?: string
  processed_by?: string
  processed_type?: string
  entity_type?: string
  details?: string
  previous_value?: string
  updated_value?: string
}

export interface ProviderHistoryItem {
  id: number
  processed_at?: string
  processed_by?: string
  processed_type?: string
  details?: string
  previous_value?: string
  updated_value?: string
}

export interface ContractHistoryItem {
  id: number
  processed_at?: string
  processed_by?: string
  processed_type?: string
  details?: string
  previous_value?: string
  updated_value?: string
}

export interface LicenseHistoryItem {
  id: number
  processed_at?: string
  processed_by?: string
  processed_type?: string
  details?: string
  previous_value?: string
  updated_value?: string
}

// ─── Contract ──────────────────────────────────────────────────────────

export interface ContractPlatformItem {
  platform: string
  commercial_rights: boolean
}

export interface ContractListItem {
  id: number
  name: string
  provider_id: number
  provider_name: string
  platforms: ContractPlatformItem[]
  start_date?: string
  end_date?: string
  notes?: string
  license_count: number
  created_at?: string
}

export interface ContractCreatePayload {
  name: string
  provider_id: number
  platforms?: ContractPlatformItem[]
  start_date?: string
  end_date?: string
  notes?: string
}

export interface ContractUpdatePayload {
  name?: string
  provider_id?: number
  platforms?: ContractPlatformItem[]
  start_date?: string
  end_date?: string
  notes?: string
}

export interface ContractSimpleItem {
  id: number
  name: string
  provider_id: number
  provider_name: string
}

export interface ContractQueryParams {
  page?: number
  page_size?: number
  name?: string
  provider_id?: number
  platforms?: string[]
  start_date_from?: string
  start_date_to?: string
  end_date_from?: string
  end_date_to?: string
  without_license?: boolean
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface ContractAttachmentItem {
  id: number
  contract_id: number
  file_name: string
  file_path: string
  file_size?: number
  uploaded_by?: number
  created_at?: string
}

// ─── License ───────────────────────────────────────────────────────────

export interface LicensePlatformItem {
  platform: string
  ad_rights: boolean
}

export interface LicenseListItem {
  id: number
  name: string
  contract_id: number | null
  contract_name: string
  provider_id: number | null
  provider_name: string
  service_type: string
  platforms: LicensePlatformItem[]
  regions: string[]
  start_date?: string
  end_date?: string
  status: string
  mobile_download: boolean
  download_duration?: number
  mobile_preview: boolean
  preview_begin_time?: string
  preview_end_time?: string
  notes?: string
  content_count: number
  created_at?: string
}

export interface LicenseCreatePayload {
  name: string
  contract_id: number
  service_type: string
  platforms?: LicensePlatformItem[]
  regions?: string[]
  start_date: string
  end_date: string
  mobile_download?: boolean
  download_duration?: number
  mobile_preview?: boolean
  preview_begin_time?: string
  preview_end_time?: string
  notes?: string
}

export interface LicenseUpdatePayload {
  name?: string
  contract_id?: number
  unlink_contract?: boolean
  service_type?: string
  platforms?: LicensePlatformItem[]
  regions?: string[]
  start_date?: string
  end_date?: string
  mobile_download?: boolean
  download_duration?: number
  mobile_preview?: boolean
  preview_begin_time?: string
  preview_end_time?: string
  notes?: string
}

export interface LicenseSimpleItem {
  id: number
  name: string
  contract_id: number | null
  service_type: string
  start_date?: string
  end_date?: string
}

export interface LicenseQueryParams {
  page?: number
  page_size?: number
  name?: string
  service_types?: string[]
  platforms?: string[]
  statuses?: string[]
  start_date_from?: string
  start_date_to?: string
  end_date_from?: string
  end_date_to?: string
  contract_id?: number
  provider_id?: number
  without_content?: boolean
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// ─── Content（交易视角）───────────────────────────────────────────────

export interface ContentForTradeItem {
  id: number
  content_type: string
  title: string
  status: string            // Ingest 状态
  license_names: string[]
  genre?: string            // 题材（内容模块完整实现后填充）
  original_name?: string    // 原始标题（内容模块完整实现后填充）
  release_year?: number     // 发行年份（内容模块完整实现后填充）
}

export interface BatchDeletePayload {
  ids: number[]
}

export interface ContentAddToLicensePayload {
  content_ids: number[]
}
