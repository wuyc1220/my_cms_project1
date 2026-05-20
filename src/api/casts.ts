import request from './index'
import type {
  BatchDeletePayload,
  CastCreatePayload,
  CastListItem,
  CastQueryParams,
  CastUpdatePayload,
  EntityFieldValueItem,
  EntityFieldValuesPayload,
  EntityI18nItem,
  EntityI18nPayload,
  PaginatedResponse,
} from '../types/basic'

export const getCasts = async (params: CastQueryParams): Promise<PaginatedResponse<CastListItem>> => {
  const response = await request.get<PaginatedResponse<CastListItem>>('/casts/', { params })
  return response.data
}

export const getCast = async (id: number): Promise<CastListItem> => {
  const response = await request.get<CastListItem>(`/casts/${id}`)
  return response.data
}

export const createCast = async (payload: CastCreatePayload): Promise<CastListItem> => {
  const response = await request.post<CastListItem>('/casts/', payload)
  return response.data
}

export const updateCast = async (id: number, payload: CastUpdatePayload): Promise<CastListItem> => {
  const response = await request.put<CastListItem>(`/casts/${id}`, payload)
  return response.data
}

export const deleteCast = async (id: number): Promise<void> => {
  await request.delete(`/casts/${id}`)
}

export const batchDeleteCasts = async (payload: BatchDeletePayload): Promise<void> => {
  await request.delete('/casts/batch', { data: payload })
}

export const getCastFieldValues = async (id: number): Promise<EntityFieldValueItem[]> => {
  const response = await request.get<EntityFieldValueItem[]>(`/casts/${id}/field-values`)
  return response.data
}

export const saveCastFieldValues = async (
  id: number,
  payload: EntityFieldValuesPayload,
): Promise<EntityFieldValueItem[]> => {
  const response = await request.put<EntityFieldValueItem[]>(`/casts/${id}/field-values`, payload)
  return response.data
}

export const getCastI18n = async (id: number): Promise<EntityI18nItem[]> => {
  const response = await request.get<EntityI18nItem[]>(`/casts/${id}/i18n`)
  return response.data
}

export const saveCastI18n = async (id: number, payload: EntityI18nPayload): Promise<EntityI18nItem[]> => {
  const response = await request.put<EntityI18nItem[]>(`/casts/${id}/i18n`, payload)
  return response.data
}
