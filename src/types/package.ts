import type { PaginatedResponse } from './basic'

export type { PaginatedResponse }

// ─── Content（内容简要，供 Add Content 弹框使用）─────────────────────

export interface ContentSimpleItem {
  id: number
  content_type: string
  title: string
  genre?: string | null
  custom_tags?: string[]
  status: string
  has_license: boolean
}

// ─── Package ────────────────────────────────────────────────────────

export interface PackageListItem {
  id: number
  name: string
  package_type: string | null
  platforms: string[] | null
  description: string | null
  ingest_status: string
  created_at: string | null
}

export interface PackageCreatePayload {
  name: string
  package_type?: string | null
  platforms?: string[] | null
  description?: string | null
}

export interface PackageUpdatePayload {
  name?: string
  package_type?: string | null
  platforms?: string[] | null
  description?: string | null
  ingest_status?: string
}

export interface PackageQueryParams {
  page?: number
  page_size?: number
  name?: string
  package_type?: string
  platforms?: string[]
  ingest_statuses?: string[]
  description?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface PackageContentAddPayload {
  content_ids: number[]
}

export interface BatchDeletePayload {
  ids: number[]
}
