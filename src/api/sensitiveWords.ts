import request from './index'
import type {
  BatchDeletePayload,
  BatchStatusPayload,
  ImportResultPayload,
  PaginatedResponse,
  SensitiveWordCreatePayload,
  SensitiveWordListItem,
  SensitiveWordQueryParams,
  SensitiveWordUpdatePayload,
} from '../types/basic'

export const getSensitiveWords = async (params: SensitiveWordQueryParams): Promise<PaginatedResponse<SensitiveWordListItem>> => {
  const response = await request.get<PaginatedResponse<SensitiveWordListItem>>('/sensitive-words/', { params })
  return response.data
}

export const getSensitiveWord = async (id: number): Promise<SensitiveWordListItem> => {
  const response = await request.get<SensitiveWordListItem>(`/sensitive-words/${id}`)
  return response.data
}

export const createSensitiveWord = async (payload: SensitiveWordCreatePayload): Promise<SensitiveWordListItem> => {
  const response = await request.post<SensitiveWordListItem>('/sensitive-words/', payload)
  return response.data
}

export const updateSensitiveWord = async (id: number, payload: SensitiveWordUpdatePayload): Promise<SensitiveWordListItem> => {
  const response = await request.put<SensitiveWordListItem>(`/sensitive-words/${id}`, payload)
  return response.data
}

export const deleteSensitiveWord = async (id: number): Promise<void> => {
  await request.delete(`/sensitive-words/${id}`)
}

export const batchDeleteSensitiveWords = async (payload: BatchDeletePayload): Promise<void> => {
  await request.delete('/sensitive-words/batch', { data: payload })
}

export const toggleSensitiveWordStatus = async (id: number, status: string): Promise<SensitiveWordListItem> => {
  const response = await request.put<SensitiveWordListItem>(`/sensitive-words/${id}/status`, { status })
  return response.data
}

export const batchToggleSensitiveWordStatus = async (payload: BatchStatusPayload): Promise<void> => {
  await request.post('/sensitive-words/batch-status', payload)
}

export const exportSensitiveWordsExcel = async (ids: number[]): Promise<Blob> => {
  const response = await request.post('/sensitive-words/export', { ids }, { responseType: 'blob' })
  return response.data
}

export const importSensitiveWordsExcel = async (file: File): Promise<ImportResultPayload> => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await request.post<ImportResultPayload>('/sensitive-words/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}
