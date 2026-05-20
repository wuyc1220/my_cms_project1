import request from './index'
import type { MovieItem, MovieHistoryItem } from '../types/metadata'
import type { PaginatedResponse } from '../types/pagination'
import type { EntityFieldValueItem, EntityFieldValuesPayload, EntityI18nItem, EntityI18nPayload } from '../types/basic'

export const getMoviesByContentId = async (
  contentId: number,
  movieType?: number,
): Promise<PaginatedResponse<MovieItem>> => {
  const response = await request.get<PaginatedResponse<MovieItem>>(`/movies/contents/${contentId}/movies`, {
    params: movieType !== undefined ? { movie_type: movieType } : undefined,
  })
  return response.data
}

export const getMovie = async (movieId: number): Promise<MovieItem> => {
  const response = await request.get<MovieItem>(`/movies/${movieId}`)
  return response.data
}

export const createMovie = async (
  contentId: number,
  data: Omit<MovieItem, 'id' | 'content_id' | 'created_at'>,
): Promise<MovieItem> => {
  const response = await request.post<MovieItem>(`/movies/contents/${contentId}/movies`, {
    ...data,
    content_id: contentId,
  })
  return response.data
}

export const updateMovie = async (
  movieId: number,
  data: Partial<Omit<MovieItem, 'id' | 'content_id' | 'created_at'>>,
): Promise<MovieItem> => {
  const response = await request.put<MovieItem>(`/movies/${movieId}`, data)
  return response.data
}

export const deleteMovie = async (movieId: number): Promise<{ success: boolean }> => {
  const response = await request.delete<{ success: boolean }>(`/movies/${movieId}`)
  return response.data
}

export const getMovieHistoryByContentId = async (
  contentId: number,
): Promise<PaginatedResponse<MovieHistoryItem>> => {
  const response = await request.get<PaginatedResponse<MovieHistoryItem>>(
    `/movies/contents/${contentId}/movies/history`,
  )
  return response.data
}

// ── 自定义字段值 ────────────────────────────────────────

export const getMovieFieldValues = async (movieId: number): Promise<EntityFieldValueItem[]> => {
  const response = await request.get<EntityFieldValueItem[]>(`/movies/${movieId}/field-values`)
  return response.data
}

export const saveMovieFieldValues = async (movieId: number, payload: EntityFieldValuesPayload): Promise<EntityFieldValueItem[]> => {
  const response = await request.put<EntityFieldValueItem[]>(`/movies/${movieId}/field-values`, payload)
  return response.data
}

// ── 多语言值 ────────────────────────────────────────────

export const getMovieI18n = async (movieId: number): Promise<EntityI18nItem[]> => {
  const response = await request.get<EntityI18nItem[]>(`/movies/${movieId}/i18n`)
  return response.data
}

export const saveMovieI18n = async (movieId: number, payload: EntityI18nPayload): Promise<EntityI18nItem[]> => {
  const response = await request.put<EntityI18nItem[]>(`/movies/${movieId}/i18n`, payload)
  return response.data
}
