import request from './index'
import type {
  BatchDeletePayload,
  PaginatedResponse,
  TagCreatePayload,
  TagListItem,
  TagQueryParams,
  TagUpdatePayload,
} from '../types/basic'

export const getTags = async (params: TagQueryParams): Promise<PaginatedResponse<TagListItem>> => {
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
  const response = await request.get<PaginatedResponse<TagListItem>>('/tags/', { params: query })
  return response.data
}

export const getTag = async (id: number): Promise<TagListItem> => {
  const response = await request.get<TagListItem>(`/tags/${id}`)
  return response.data
}

export const createTag = async (payload: TagCreatePayload): Promise<TagListItem> => {
  const response = await request.post<TagListItem>('/tags/', payload)
  return response.data
}

export const updateTag = async (id: number, payload: TagUpdatePayload): Promise<TagListItem> => {
  const response = await request.put<TagListItem>(`/tags/${id}`, payload)
  return response.data
}

export const deleteTag = async (id: number): Promise<void> => {
  await request.delete(`/tags/${id}`)
}

export const batchDeleteTags = async (payload: BatchDeletePayload): Promise<void> => {
  await request.delete('/tags/batch', { data: payload })
}
