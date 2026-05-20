export interface RoleListItem {
  id: number
  name: string
  code: string
  status: string
  description: string | null
  is_system: boolean
  created_at?: string | null
}

export interface UserListItem {
  id: number
  username: string
  display_name: string | null
  email: string | null
  phone_number: string | null
  status: string
  roles: RoleListItem[]
  created_at?: string | null
}

export interface PaginatedResponse<T> {
  total: number
  page: number
  page_size: number
  items: T[]
}

export interface UserCreatePayload {
  username: string
  password: string
  display_name?: string | null
  email?: string | null
  phone_number?: string | null
  status: string
  role_ids: number[]
}

export interface UserUpdatePayload {
  display_name?: string | null
  email?: string | null
  phone_number?: string | null
  status?: string
  role_ids?: number[]
}

export interface RoleCreatePayload {
  name: string
  code?: string | null
  status: string
  description?: string | null
}

export interface RoleUpdatePayload {
  name?: string
  status?: string
  description?: string | null
}

export interface BatchStatusPayload {
  ids: number[]
  status: string
}
