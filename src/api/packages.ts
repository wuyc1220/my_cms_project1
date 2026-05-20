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

export const batchDeletePackages = async (payload: BatchDeletePayload): Promise<void> => {
  await request.delete('/packages/batch', { data: payload })
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
    query.content_types = params.content_types.join(',')
  }
  if (params.genre_ids?.length) {
    query.genre_ids = params.genre_ids.join(',')
  }
  if (params.custom_tag_ids?.length) {
    query.custom_tag_ids = params.custom_tag_ids.join(',')
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
