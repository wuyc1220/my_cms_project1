import request from './index'
import type {
  BatchDeletePayload,
  ContentSimpleItem,
  PackageContentAddPayload,
  PackageCreatePayload,
  PackageListItem,
  PackageQueryParams,
  PackageUpdatePayload,
  PaginatedResponse,
} from '../types/package'
import type { EntityFieldValueItem, EntityFieldValuesPayload, EntityI18nItem, EntityI18nPayload } from '../types/basic'

// ─── Package CRUD ─────────────────────────────────────────────────────

export const getPackages = async (params: PackageQueryParams): Promise<PaginatedResponse<PackageListItem>> => {
  const response = await request.get<PaginatedResponse<PackageListItem>>('/packages/', { params })
  return response.data
}

export const getPackage = async (id: number): Promise<PackageListItem> => {
  const response = await request.get<PackageListItem>(`/packages/${id}`)
  return response.data
}

export const createPackage = async (payload: PackageCreatePayload): Promise<PackageListItem> => {
  const response = await request.post<PackageListItem>('/packages/', payload)
  return response.data
}

export const updatePackage = async (id: number, payload: PackageUpdatePayload): Promise<PackageListItem> => {
  const response = await request.put<PackageListItem>(`/packages/${id}`, payload)
  return response.data
}

export const deletePackage = async (id: number): Promise<void> => {
  await request.delete(`/packages/${id}`)
}

export const batchDeletePackages = async (payload: BatchDeletePayload): Promise<{ success: boolean; deleted: number }> => {
  const response = await request.delete<{ success: boolean; deleted: number }>('/packages/batch', { data: payload })
  return response.data
}

// ─── Package↔Content 关联 ─────────────────────────────────────────────

export const getPackageContents = async (
  packageId: number,
  params: { page?: number; page_size?: number } = {},
): Promise<PaginatedResponse<ContentSimpleItem>> => {
  const response = await request.get<PaginatedResponse<ContentSimpleItem>>(
    `/packages/${packageId}/contents`,
    { params },
  )
  return response.data
}

export const addContentsToPackage = async (packageId: number, payload: PackageContentAddPayload): Promise<ContentSimpleItem[]> => {
  const response = await request.post<ContentSimpleItem[]>(`/packages/${packageId}/contents`, payload)
  return response.data
}

export const removeContentFromPackage = async (packageId: number, contentId: number): Promise<void> => {
  await request.delete(`/packages/${packageId}/contents/${contentId}`)
}

export const getAvailableContents = async (
  packageId: number,
  params: { page?: number; page_size?: number; title?: string; content_types?: string[]; genre_ids?: number[]; custom_tag_ids?: number[] },
): Promise<PaginatedResponse<ContentSimpleItem>> => {
  const query: Record<string, unknown> = {
    page: params.page,
    page_size: params.page_size,
    title: params.title || undefined,
  }
  if (params.content_types?.length) {
    query.content_types = params.content_types
  }
  if (params.genre_ids?.length) {
    query.genre_ids = params.genre_ids
  }
  if (params.custom_tag_ids?.length) {
    query.custom_tag_ids = params.custom_tag_ids
  }
  const response = await request.get<PaginatedResponse<ContentSimpleItem>>(
    `/packages/${packageId}/available-contents`,
    { params: query },
  )
  return response.data
}

// ─── 自定义字段值 ──────────────────────────────────────────────────────

export const getPackageFieldValues = async (id: number): Promise<EntityFieldValueItem[]> => {
  const response = await request.get<EntityFieldValueItem[]>(`/packages/${id}/field-values`)
  return response.data
}

export const savePackageFieldValues = async (
  id: number,
  payload: EntityFieldValuesPayload,
): Promise<EntityFieldValueItem[]> => {
  const response = await request.put<EntityFieldValueItem[]>(`/packages/${id}/field-values`, payload)
  return response.data
}

export const getPackageI18n = async (id: number): Promise<EntityI18nItem[]> => {
  const response = await request.get<EntityI18nItem[]>(`/packages/${id}/i18n`)
  return response.data
}

export const savePackageI18n = async (
  id: number,
  payload: EntityI18nPayload,
): Promise<EntityI18nItem[]> => {
  const response = await request.put<EntityI18nItem[]>(`/packages/${id}/i18n`, payload)
  return response.data
}

// ─── Package Export/Import/Template（导出/导入/模板下载）──────────────────

/** 导出服务包 Excel */
export const exportPackagesExcel = async (ids: number[]): Promise<Blob> => {
  const response = await request.post('/packages/export', { ids }, { responseType: 'blob' })
  return response.data
}

/** 导入结果 */
export interface PackageImportError {
  row: number
  package_name: string
  content_name: string
  error_message: string
}

export interface PackageImportResult {
  total: number
  created: number
  deleted: number
  skipped: number
  errors: PackageImportError[]
}

/** 导入服务包内容关联 */
export const importPackageContentsExcel = async (file: File): Promise<PackageImportResult> => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await request.post<PackageImportResult>('/packages/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

/** 下载导入模板 */
export const downloadPackageImportTemplate = async (): Promise<Blob> => {
  const response = await request.get('/packages/download-template', { responseType: 'blob' })
  return response.data
}

// ─── Package 同步给业务系统 ─────────────────────────────────────

export interface PackageSyncPayload {
  package_ids: number[]
}

export interface PackageSyncResponse {
  success: boolean
  file_path: string
  stats: Record<string, number>
  synced_ids: number[]
  message: string
  correlate_id: string | null
  soap_success: boolean | null
}

export const syncPackages = async (payload: PackageSyncPayload): Promise<PackageSyncResponse> => {
  const response = await request.post<PackageSyncResponse>('/packages/sync', payload)
  return response.data
}

// ─── Package 发布状态检查 ────────────────────────────────────────

export interface PackagePublishCheckResponse {
  can_publish: boolean
  total_count: number
  published_count: number
  unpublished_count: number
  unpublished_packages: Array<{ id: number; name: string; ingest_status: string }>
  message: string
}

export const checkPackagesPublishStatus = async (contentId: number): Promise<PackagePublishCheckResponse> => {
  const response = await request.get<PackagePublishCheckResponse>('/packages/publish-check', {
    params: { content_id: contentId },
  })
  return response.data
}
