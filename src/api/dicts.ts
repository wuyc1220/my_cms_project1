import request from './index'
import type { DictNodeCreatePayload, DictNodeListItem, DictNodeUpdatePayload } from '../types/dict'
import type { LanguageOption } from '../types/i18n'

export interface DictQueryParams {
  name?: string
  code?: string
  remark?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export const getDictTree = async (params?: DictQueryParams): Promise<DictNodeListItem[]> => {
  const response = await request.get<DictNodeListItem[]>('/dicts/', { params })
  return response.data
}

export const getDictNode = async (id: number): Promise<DictNodeListItem> => {
  const response = await request.get<DictNodeListItem>(`/dicts/${id}`)
  return response.data
}

export const createDictNode = async (payload: DictNodeCreatePayload): Promise<DictNodeListItem> => {
  const response = await request.post<DictNodeListItem>('/dicts/', payload)
  return response.data
}

export const updateDictNode = async (id: number, payload: DictNodeUpdatePayload): Promise<DictNodeListItem> => {
  const response = await request.put<DictNodeListItem>(`/dicts/${id}`, payload)
  return response.data
}

export const toggleDictStatus = async (id: number, status: string): Promise<void> => {
  await request.patch(`/dicts/${id}/status`, { status })
}

export const deleteDictNode = async (id: number): Promise<void> => {
  await request.delete(`/dicts/${id}`)
}

export const getDictChildren = async (code: string): Promise<LanguageOption[]> => {
  const response = await request.get<LanguageOption[]>(`/dicts/${code}/children`)
  return response.data
}
