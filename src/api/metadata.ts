import request from './index'
import type {
  ContentMetadataItem,
  ContentMetadataCreate,
  ContentMetadataUpdate,
  SeriesMetadataItem,
  SeriesMetadataCreate,
  SeriesMetadataUpdate,
  ChannelMetadataItem,
  ChannelMetadataCreate,
  ChannelMetadataUpdate,
  ScheduleMetadataItem,
  ScheduleMetadataCreate,
  ScheduleMetadataUpdate,
  MetadataDetailItem,
} from '../types/metadata'

/* ── 统一查询 ── */

export const getMetadataDetail = async (contentId: number): Promise<MetadataDetailItem> => {
  const response = await request.get<MetadataDetailItem>(`/metadata/${contentId}`)
  return response.data
}

/* ── Program 元数据 (MOVIE / EPISODE) ── */

export const getProgramMetadata = async (contentId: number): Promise<ContentMetadataItem | null> => {
  const response = await request.get<ContentMetadataItem | null>(`/metadata/${contentId}/program`)
  return response.data
}

export const createProgramMetadata = async (
  contentId: number,
  data: ContentMetadataCreate,
): Promise<ContentMetadataItem> => {
  const response = await request.post<ContentMetadataItem>(`/metadata/${contentId}/program`, data)
  return response.data
}

export const updateProgramMetadata = async (
  contentId: number,
  data: ContentMetadataUpdate,
): Promise<ContentMetadataItem> => {
  const response = await request.put<ContentMetadataItem>(`/metadata/${contentId}/program`, data)
  return response.data
}

export const deleteProgramMetadata = async (contentId: number): Promise<{ success: boolean }> => {
  const response = await request.delete<{ success: boolean }>(`/metadata/${contentId}/program`)
  return response.data
}

/* ── Series 元数据 (SERIES / SEASON) ── */

export const getSeriesMetadata = async (contentId: number): Promise<SeriesMetadataItem | null> => {
  const response = await request.get<SeriesMetadataItem | null>(`/metadata/${contentId}/series`)
  return response.data
}

export const createSeriesMetadata = async (
  contentId: number,
  data: SeriesMetadataCreate,
): Promise<SeriesMetadataItem> => {
  const response = await request.post<SeriesMetadataItem>(`/metadata/${contentId}/series`, data)
  return response.data
}

export const updateSeriesMetadata = async (
  contentId: number,
  data: SeriesMetadataUpdate,
): Promise<SeriesMetadataItem> => {
  const response = await request.put<SeriesMetadataItem>(`/metadata/${contentId}/series`, data)
  return response.data
}

export const deleteSeriesMetadata = async (contentId: number): Promise<{ success: boolean }> => {
  const response = await request.delete<{ success: boolean }>(`/metadata/${contentId}/series`)
  return response.data
}

/* ── Channel 元数据 (CHANNEL) ── */

export const getChannelMetadata = async (contentId: number): Promise<ChannelMetadataItem | null> => {
  const response = await request.get<ChannelMetadataItem | null>(`/metadata/${contentId}/channel`)
  return response.data
}

export const createChannelMetadata = async (
  contentId: number,
  data: ChannelMetadataCreate,
): Promise<ChannelMetadataItem> => {
  const response = await request.post<ChannelMetadataItem>(`/metadata/${contentId}/channel`, data)
  return response.data
}

export const updateChannelMetadata = async (
  contentId: number,
  data: ChannelMetadataUpdate,
): Promise<ChannelMetadataItem> => {
  const response = await request.put<ChannelMetadataItem>(`/metadata/${contentId}/channel`, data)
  return response.data
}

export const deleteChannelMetadata = async (contentId: number): Promise<{ success: boolean }> => {
  const response = await request.delete<{ success: boolean }>(`/metadata/${contentId}/channel`)
  return response.data
}

/* ── Schedule 元数据 (SCHEDULE) ── */

export const getScheduleMetadata = async (contentId: number): Promise<ScheduleMetadataItem | null> => {
  const response = await request.get<ScheduleMetadataItem | null>(`/metadata/${contentId}/schedule`)
  return response.data
}

export const createScheduleMetadata = async (
  contentId: number,
  data: ScheduleMetadataCreate,
): Promise<ScheduleMetadataItem> => {
  const response = await request.post<ScheduleMetadataItem>(`/metadata/${contentId}/schedule`, data)
  return response.data
}

export const updateScheduleMetadata = async (
  contentId: number,
  data: ScheduleMetadataUpdate,
): Promise<ScheduleMetadataItem> => {
  const response = await request.put<ScheduleMetadataItem>(`/metadata/${contentId}/schedule`, data)
  return response.data
}

export const deleteScheduleMetadata = async (contentId: number): Promise<{ success: boolean }> => {
  const response = await request.delete<{ success: boolean }>(`/metadata/${contentId}/schedule`)
  return response.data
}
