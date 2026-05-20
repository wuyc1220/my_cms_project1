export interface PaginatedResponse<T> {
  total: number
  page: number
  page_size: number
  items: T[]
}

export interface ConfigListItem {
  id: number
  config_key: string
  config_name: string
  config_value: string | null
  description: string | null
  is_system: boolean
  created_at?: string | null
}

export interface ConfigQueryParams {
  page?: number
  page_size?: number
  config_key?: string
  config_name?: string
  description?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface ConfigCreatePayload {
  config_key: string
  config_name: string
  config_value?: string | null
  description?: string | null
}

export interface ConfigUpdatePayload {
  config_name?: string
  config_value?: string | null
  description?: string | null
}
