import request from './index'
import type {
  BatchDeletePayload,
  ContentTypeCreatePayload,
  ContentTypeListItem,
  ContentTypeQueryParams,
  ContentTypeUpdatePayload,
  PaginatedResponse,
} from '../types/basic'

export const getContentTypes = async (params: ContentTypeQueryParams): Promise<PaginatedResponse<ContentTypeListItem>> => {
  const response = await request.get<PaginatedResponse<ContentTypeListItem>>('/content-types/', { params })
  return response.data
}

export const getContentType = async (id: number): Promise<ContentTypeListItem> => {
  const response = await request.get<ContentTypeListItem>(`/content-types/${id}`)
  return response.data
}

export const createContentType = async (payload: ContentTypeCreatePayload): Promise<ContentTypeListItem> => {
  const response = await request.post<ContentTypeListItem>('/content-types/', payload)
  return response.data
}

export const updateContentType = async (id: number, payload: ContentTypeUpdatePayload): Promise<ContentTypeListItem> => {
  const response = await request.put<ContentTypeListItem>(`/content-types/${id}`, payload)
  return response.data
}

export const deleteContentType = async (id: number): Promise<void> => {
  await request.delete(`/content-types/${id}`)
}

export const batchDeleteContentTypes = async (payload: BatchDeletePayload): Promise<void> => {
  await request.delete('/content-types/batch', { data: payload })
}
