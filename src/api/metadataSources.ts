import request from './index'
import type {
  MetadataSourceListItem,
  MetadataSourceCreatePayload,
  MetadataSourceUpdatePayload,
  MetadataSourceQueryParams,
  BatchStatusPayload,
} from '../types/metadataEnhance'
import type { PaginatedResponse } from '../types/basic'

export const getMetadataSources = async (
  params: MetadataSourceQueryParams,
): Promise<PaginatedResponse<MetadataSourceListItem>> => {
  const response = await request.get<PaginatedResponse<MetadataSourceListItem>>(
    '/metadata-sources/',
    { params },
  )
  return response.data
}

export const createMetadataSource = async (
  payload: MetadataSourceCreatePayload,
): Promise<MetadataSourceListItem> => {
  const response = await request.post<MetadataSourceListItem>('/metadata-sources/', payload)
  return response.data
}

export const updateMetadataSource = async (
  id: number,
  payload: MetadataSourceUpdatePayload,
): Promise<MetadataSourceListItem> => {
  const response = await request.put<MetadataSourceListItem>(`/metadata-sources/${id}`, payload)
  return response.data
}

export const toggleMetadataSourceStatus = async (
  id: number,
  status: string,
): Promise<{ success: boolean; status: string }> => {
  const response = await request.patch(`/metadata-sources/${id}/status`, { status })
  return response.data
}

export const batchEnableSources = async (
  payload: BatchStatusPayload,
): Promise<{ success: boolean; count: number }> => {
  const response = await request.post('/metadata-sources/batch-enable', payload)
  return response.data
}

export const batchDisableSources = async (
  payload: BatchStatusPayload,
): Promise<{ success: boolean; count: number }> => {
  const response = await request.post('/metadata-sources/batch-disable', payload)
  return response.data
}

export const batchDeleteMetadataSources = async (
  ids: number[],
): Promise<{ success: boolean; count: number }> => {
  const response = await request.delete('/metadata-sources/batch', { data: { ids } })
  return response.data
}

export const deleteMetadataSource = async (id: number): Promise<{ success: boolean }> => {
  const response = await request.delete(`/metadata-sources/${id}`)
  return response.data
}
