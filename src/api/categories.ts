import request from './index'
import type {
  BatchDeletePayload,
  CategoryCreatePayload,
  CategoryListItem,
  CategoryQueryParams,
  CategoryUpdatePayload,
  EntityFieldValueItem,
  EntityFieldValuesPayload,
  EntityI18nItem,
  EntityI18nPayload,
} from '../types/basic'

export const getCategoryTree = async (params?: CategoryQueryParams): Promise<CategoryListItem[]> => {
  const response = await request.get<CategoryListItem[]>('/categories/', { params })
  return response.data
}

export const getCategory = async (id: number): Promise<CategoryListItem> => {
  const response = await request.get<CategoryListItem>(`/categories/${id}`)
  return response.data
}

export const createCategory = async (payload: CategoryCreatePayload): Promise<CategoryListItem> => {
  const response = await request.post<CategoryListItem>('/categories/', payload)
  return response.data
}

export const updateCategory = async (id: number, payload: CategoryUpdatePayload): Promise<CategoryListItem> => {
  const response = await request.put<CategoryListItem>(`/categories/${id}`, payload)
  return response.data
}

export const deleteCategory = async (id: number): Promise<void> => {
  await request.delete(`/categories/${id}`)
}

export const batchDeleteCategories = async (payload: BatchDeletePayload): Promise<void> => {
  await request.delete('/categories/batch', { data: payload })
}

export const getCategoryFieldValues = async (id: number): Promise<EntityFieldValueItem[]> => {
  const response = await request.get<EntityFieldValueItem[]>(`/categories/${id}/field-values`)
  return response.data
}

export const saveCategoryFieldValues = async (id: number, payload: EntityFieldValuesPayload): Promise<EntityFieldValueItem[]> => {
  const response = await request.put<EntityFieldValueItem[]>(`/categories/${id}/field-values`, payload)
  return response.data
}

export const getCategoryI18n = async (id: number): Promise<EntityI18nItem[]> => {
  const response = await request.get<EntityI18nItem[]>(`/categories/${id}/i18n`)
  return response.data
}

export const saveCategoryI18n = async (id: number, payload: EntityI18nPayload): Promise<EntityI18nItem[]> => {
  const response = await request.put<EntityI18nItem[]>(`/categories/${id}/i18n`, payload)
  return response.data
}

export interface CategoryContentRow {
  id: number
  sequence: number
  content_name: string
  content_type: string
  genre: string
  status: string
}

export const getCategoryContents = async (id: number): Promise<CategoryContentRow[]> => {
  const response = await request.get<CategoryContentRow[]>(`/categories/${id}/contents`)
  return response.data
}

export const reorderCategoryContents = async (id: number, contentIds: number[]): Promise<void> => {
  await request.put(`/categories/${id}/contents/order`, { content_ids: contentIds })
}

export const removeCategoryContent = async (categoryId: number, contentId: number): Promise<void> => {
  await request.delete(`/categories/${categoryId}/contents/${contentId}`)
}

