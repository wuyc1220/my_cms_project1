import request from './index'
import type {
  BatchDeletePayload,
  CustomTagCreatePayload,
  CustomTagListItem,
  CustomTagQueryParams,
  CustomTagUpdatePayload,
  PaginatedResponse,
} from '../types/basic'

export const getCustomTags = async (params: CustomTagQueryParams): Promise<PaginatedResponse<CustomTagListItem>> => {
  const query: Record<string, unknown> = {
    page: params.page,
    page_size: params.page_size,
    name: params.name || undefined,
    sort_by: params.sort_by || undefined,
    sort_order: params.sort_order || undefined,
  }
  if (params.languages?.length) {
    query.languages = params.languages.join(',')
  }
  const response = await request.get<PaginatedResponse<CustomTagListItem>>('/custom-tags/', { params: query })
  return response.data
}

export const getCustomTag = async (id: number): Promise<CustomTagListItem> => {
  const response = await request.get<CustomTagListItem>(`/custom-tags/${id}`)
  return response.data
}

export const createCustomTag = async (payload: CustomTagCreatePayload): Promise<CustomTagListItem> => {
  const response = await request.post<CustomTagListItem>('/custom-tags/', payload)
  return response.data
}

export const updateCustomTag = async (id: number, payload: CustomTagUpdatePayload): Promise<CustomTagListItem> => {
  const response = await request.put<CustomTagListItem>(`/custom-tags/${id}`, payload)
  return response.data
}

export const deleteCustomTag = async (id: number): Promise<void> => {
  await request.delete(`/custom-tags/${id}`)
}

export const batchDeleteCustomTags = async (payload: BatchDeletePayload): Promise<void> => {
  await request.delete('/custom-tags/batch', { data: payload })
}
