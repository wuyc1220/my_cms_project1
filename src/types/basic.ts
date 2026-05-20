export interface PaginatedResponse<T> {
  total: number
  page: number
  page_size: number
  items: T[]
}

// ---------- Tag ----------

export interface TagListItem {
  id: number
  name: string
  language: string
  created_at?: string | null
}

export interface TagCreatePayload {
  name: string
  language: string
}

export interface TagUpdatePayload {
  name?: string
  language?: string
}

export interface TagQueryParams {
  page?: number
  page_size?: number
  name?: string
  languages?: string[]
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// ---------- CustomTag ----------

export interface CustomTagListItem {
  id: number
  name: string
  language: string
  is_deleted?: boolean
  created_at?: string | null
}

export interface CustomTagCreatePayload {
  name: string
}

export interface CustomTagUpdatePayload {
  name?: string
}

export interface CustomTagQueryParams {
  page?: number
  page_size?: number
  name?: string
  languages?: string[]
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// ---------- Genre ----------

export interface GenreListItem {
  id: number
  name: string
  language: string
  created_at?: string | null
}

export interface GenreCreatePayload {
  name: string
  language: string
}

export interface GenreUpdatePayload {
  name?: string
  language?: string
}

export interface GenreQueryParams {
  page?: number
  page_size?: number
  name?: string
  languages?: string[]
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// ---------- ContentType ----------

export interface ContentTypeListItem {
  id: number
  name: string
  created_at?: string | null
}

export interface ContentTypeCreatePayload {
  name: string
}

export interface ContentTypeUpdatePayload {
  name?: string
}

export interface ContentTypeQueryParams {
  page?: number
  page_size?: number
  name?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// ---------- PosterSize ----------

export interface PosterSizeListItem {
  id: number
  name: string
  belongings: string[]
  extensions: string[]
  width: number
  height: number
  max_file_size_kb: number
  mapping_type: number | null
  mandatory: boolean
  aspect_ratio?: string | null
  created_at?: string | null
}

export interface PosterSizeCreatePayload {
  name: string
  belongings: string[]
  extensions: string[]
  width: number
  height: number
  max_file_size_kb: number
  mapping_type: number
  mandatory: boolean
}

export interface PosterSizeUpdatePayload {
  name?: string
  belongings?: string[]
  extensions?: string[]
  width?: number
  height?: number
  max_file_size_kb?: number
  mapping_type?: number
  mandatory?: boolean
}

export interface PosterSizeQueryParams {
  page?: number
  page_size?: number
  name?: string
  belongings?: string[]
  mandatory?: boolean
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// ---------- Category ----------

export interface CategoryListItem {
  id: number
  parent_id: number | null
  platform: string
  name: string
  sequence: number
  category_type: string | null
  vod_count: number
  description: string | null
  jump_category_code: string | null
  status: number
  ingest_status: string
  children: CategoryListItem[]
  created_at?: string | null
}

export interface CategoryCreatePayload {
  parent_id?: number | null
  platform: string
  name: string
  sequence?: number
  category_type?: string | null
  vod_count?: number
  description?: string | null
  jump_category_code?: string | null
  status?: number
}

export interface CategoryUpdatePayload {
  platform?: string
  name?: string
  sequence?: number
  category_type?: string | null
  vod_count?: number
  description?: string | null
  jump_category_code?: string | null
  status?: number
  ingest_status?: string | null
}

export interface CategoryQueryParams {
  name?: string
  platforms?: string[]
  category_types?: string[]
  ingest_statuses?: string[]
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface CategoryContentItem {
  id: number
  sequence: number
  content_name: string
  content_type: string
  genre: string
  status: string
}

// ---------- EntityFieldValue / EntityI18n ----------

export interface EntityFieldValueItem {
  custom_field_id: number
  value?: string | null
}

export interface EntityFieldValuesPayload {
  values: EntityFieldValueItem[]
}

export interface EntityI18nItem {
  language: string
  field_name: string
  value?: string | null
}

export interface EntityI18nPayload {
  language: string
  fields: Record<string, string | null>
}

// ---------- CustomField ----------

export interface CustomFieldOptionItem {
  id?: number
  code: string
  names: Record<string, string>
  sort_order?: number
}

export interface CustomFieldListItem {
  id: number
  field_name: string
  field_code: string
  field_type: string
  mandatory: boolean
  multi_language: boolean
  tip?: string | null
  belongings: string[]
  options: CustomFieldOptionItem[]
  created_at?: string | null
}

export interface CustomFieldCreatePayload {
  field_name: string
  field_type: string
  belongings: string[]
  mandatory?: boolean
  multi_language?: boolean
  tip?: string | null
  options?: CustomFieldOptionItem[]
}

export interface CustomFieldUpdatePayload {
  field_name?: string
  field_type?: string
  belongings?: string[]
  mandatory?: boolean
  multi_language?: boolean
  tip?: string | null
  options?: CustomFieldOptionItem[]
}

export interface CustomFieldQueryParams {
  page?: number
  page_size?: number
  field_name?: string
  field_type?: string
  belongings?: string[]
  mandatory?: boolean
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// ---------- Cast ----------

export interface CastListItem {
  id: number
  name: string
  description?: string | null
  ingest_status: string
  status: number
  poster_url?: string | null
  created_at?: string | null
}

export interface CastCreatePayload {
  name: string
  description?: string | null
  status?: number
}

export interface CastUpdatePayload {
  name?: string | null
  description?: string | null
  ingest_status?: string | null
  status?: number | null
}

export interface CastQueryParams {
  page?: number
  page_size?: number
  cast_id?: number | null
  name?: string
  description?: string
  ingest_statuses?: string[]
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// ---------- SensitiveWord ----------

export interface SensitiveWordListItem {
  id: number
  keyword: string
  type_code: string
  status: string
  is_deleted?: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface SensitiveWordCreatePayload {
  keyword: string
  type_code: string
  status?: string
}

export interface SensitiveWordUpdatePayload {
  keyword?: string
  type_code?: string
  status?: string
}

export interface SensitiveWordQueryParams {
  page?: number
  page_size?: number
  keyword?: string
  type_codes?: string[]
  status?: string
  created_start?: string
  created_end?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface BatchStatusPayload {
  ids: number[]
  status: string
}

export interface ImportResultPayload {
  total: number
  created: number
  updated: number
}

// ---------- Shared ----------

export interface BatchDeletePayload {
  ids: number[]
}

// ---------- CastRoleMap ----------

export interface CastRoleMapItem {
  map_id: number
  program_id?: number | null
  movie_id?: number | null
  content_id?: number | null
  cast_id: number
  cast_name?: string | null
  cast_poster_url?: string | null
  role_name?: string | null
  role_code?: string | null
  is_deleted?: number | null
  created_at?: string | null
  updated_at?: string | null
}

export interface CastRoleMapCreatePayload {
  content_id?: number | null
  program_id?: number | null
  movie_id?: number | null
  cast_id: number
  role_name?: string | null
  role_code?: string | null
}

export interface CastRoleMapUpdatePayload {
  role_name?: string | null
  role_code?: string | null
}

export interface CastRoleMapQueryParams {
  program_id?: number | null
  movie_id?: number | null
  cast_id?: number | null
  content_id?: number | null
  page?: number
  page_size?: number
}

export interface CastRoleMapListResponse {
  items: CastRoleMapItem[]
  total: number
}

// ---------- Attachment ----------

export interface AttachmentUploadResult {
  file_path: string
  file_name: string
  file_size: number
  file_url: string
}
