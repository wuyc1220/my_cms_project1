import api from './index'

export interface EpisodeHistoryItem {
  id: number
  parent_id: number
  content_id: number
  content_name: string
  content_type: string
  processed_by: string | null
  processed_type: string
  created_at: string
}

export interface EpisodeHistoryListResponse {
  items: EpisodeHistoryItem[]
  total: number
}

export interface EpisodeHistoryQueryParams {
  content_name?: string
  processed_type?: string
  processed_by?: string
}

export const getEpisodeHistory = async (
  parentId: number,
  params?: EpisodeHistoryQueryParams,
): Promise<EpisodeHistoryListResponse> => {
  const response = await api.get<EpisodeHistoryListResponse>(`/contents/${parentId}/episodes/history`, {
    params,
  })
  return response.data
}
