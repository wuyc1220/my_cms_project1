import request from './index'
import type {
  BatchDeletePayload,
  CustomFieldCreatePayload,
  CustomFieldListItem,
  CustomFieldQueryParams,
  CustomFieldUpdatePayload,
  PaginatedResponse,
} from '../types/basic'

export const getCustomFields = async (params: CustomFieldQueryParams): Promise<PaginatedResponse<CustomFieldListItem>> => {
  const response = await request.get<PaginatedResponse<CustomFieldListItem>>('/custom-fields/', { params })
  return response.data
}

export const getCustomField = async (id: number): Promise<CustomFieldListItem> => {
  const response = await request.get<CustomFieldListItem>(`/custom-fields/${id}`)
  return response.data
}

export const createCustomField = async (payload: CustomFieldCreatePayload): Promise<CustomFieldListItem> => {
  const response = await request.post<CustomFieldListItem>('/custom-fields/', payload)
  return response.data
}

export const updateCustomField = async (id: number, payload: CustomFieldUpdatePayload): Promise<CustomFieldListItem> => {
  const response = await request.put<CustomFieldListItem>(`/custom-fields/${id}`, payload)
  return response.data
}

export const deleteCustomField = async (id: number): Promise<void> => {
  await request.delete(`/custom-fields/${id}`)
}

export const batchDeleteCustomFields = async (payload: BatchDeletePayload): Promise<void> => {
  await request.delete('/custom-fields/batch', { data: payload })
}
