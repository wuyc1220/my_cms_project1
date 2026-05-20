export interface ContentAuthListItem {
  id: number
  content_name: string
  content_type: string
  ingest_status: string
  authorized_roles: { id: number; name: string }[]
  authorized_users: { id: number; display_name: string; username: string }[]
}

export interface ContentAuthQueryParams {
  page?: number
  page_size?: number
  content_name?: string
  content_types?: string[]
  ingest_statuses?: string[]
  authorized_user?: string
  authorized_role?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface ContentAuthAuthorizePayload {
  content_ids: number[]
  role_ids: number[] | null
  user_ids: number[] | null
}

export interface ContentAuthClearPayload {
  content_ids: number[]
}

export interface RoleSimpleItem {
  id: number
  name: string
}

export interface UserSimpleItem {
  id: number
  display_name: string
  username: string
}
