import request from './index'
import type {
  BatchDeletePayload,
  GenreCreatePayload,
  GenreListItem,
  GenreQueryParams,
  GenreUpdatePayload,
  PaginatedResponse,
} from '../types/basic'

export const getGenres = async (params: GenreQueryParams): Promise<PaginatedResponse<GenreListItem>> => {
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
  const response = await request.get<PaginatedResponse<GenreListItem>>('/genres/', { params: query })
  return response.data
}

export const getGenre = async (id: number): Promise<GenreListItem> => {
  const response = await request.get<GenreListItem>(`/genres/${id}`)
  return response.data
}

export const createGenre = async (payload: GenreCreatePayload): Promise<GenreListItem> => {
  const response = await request.post<GenreListItem>('/genres/', payload)
  return response.data
}

export const updateGenre = async (id: number, payload: GenreUpdatePayload): Promise<GenreListItem> => {
  const response = await request.put<GenreListItem>(`/genres/${id}`, payload)
  return response.data
}

export const deleteGenre = async (id: number): Promise<void> => {
  await request.delete(`/genres/${id}`)
}

export const batchDeleteGenres = async (payload: BatchDeletePayload): Promise<void> => {
  await request.delete('/genres/batch', { data: payload })
}
