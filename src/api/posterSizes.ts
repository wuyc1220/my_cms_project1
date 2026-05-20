import request from './index'
import type {
  BatchDeletePayload,
  EntityFieldValueItem,
  EntityFieldValuesPayload,
  PaginatedResponse,
  PosterSizeCreatePayload,
  PosterSizeListItem,
  PosterSizeQueryParams,
  PosterSizeUpdatePayload,
} from '../types/basic'

export const getPosterSizes = async (params: PosterSizeQueryParams): Promise<PaginatedResponse<PosterSizeListItem>> => {
  const response = await request.get<PaginatedResponse<PosterSizeListItem>>('/poster-sizes/', { params })
  return response.data
}

export const getPosterSize = async (id: number): Promise<PosterSizeListItem> => {
  const response = await request.get<PosterSizeListItem>(`/poster-sizes/${id}`)
  return response.data
}

export const createPosterSize = async (payload: PosterSizeCreatePayload): Promise<PosterSizeListItem> => {
  const response = await request.post<PosterSizeListItem>('/poster-sizes/', payload)
  return response.data
}

export const updatePosterSize = async (id: number, payload: PosterSizeUpdatePayload): Promise<PosterSizeListItem> => {
  const response = await request.put<PosterSizeListItem>(`/poster-sizes/${id}`, payload)
  return response.data
}

export const deletePosterSize = async (id: number): Promise<void> => {
  await request.delete(`/poster-sizes/${id}`)
}

export const batchDeletePosterSizes = async (payload: BatchDeletePayload): Promise<void> => {
  await request.delete('/poster-sizes/batch', { data: payload })
}

export const getPosterSizeFieldValues = async (id: number): Promise<EntityFieldValueItem[]> => {
  const response = await request.get<EntityFieldValueItem[]>(`/poster-sizes/${id}/field-values`)
  return response.data
}

export const savePosterSizeFieldValues = async (id: number, payload: EntityFieldValuesPayload): Promise<EntityFieldValueItem[]> => {
  const response = await request.put<EntityFieldValueItem[]>(`/poster-sizes/${id}/field-values`, payload)
  return response.data
}
