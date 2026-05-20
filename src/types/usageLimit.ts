// 使用限制（UsageLimit）类型定义

export interface UsageLimitItem {
  id: number
  limit_type: string
  limit_value: number
  current_value: number
  description: string | null
  is_developed: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface UsageLimitsResponse {
  items: UsageLimitItem[]
}

export interface UsageLimitUpdateItem {
  limit_type: string
  limit_value: number
}

export interface UsageLimitsUpdateRequest {
  items: UsageLimitUpdateItem[]
}
