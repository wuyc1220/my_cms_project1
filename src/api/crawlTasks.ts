import request from './index'
import type {
  CrawlTaskListItem,
  CrawlTaskDetail,
  CrawlTaskQueryParams,
  CrawlRequestPayload,
  CrawlResponse,
  CrawlConfirmPayload,
  CrawlConfirmResult,
} from '../types/metadataEnhance'
import type { PaginatedResponse } from '../types/basic'

export const getCrawlTasks = async (
  params: CrawlTaskQueryParams,
): Promise<PaginatedResponse<CrawlTaskListItem>> => {
  const response = await request.get<PaginatedResponse<CrawlTaskListItem>>('/crawl-tasks/', {
    params,
  })
  return response.data
}

export const getCrawlTaskDetail = async (id: number): Promise<CrawlTaskDetail> => {
  const response = await request.get<CrawlTaskDetail>(`/crawl-tasks/${id}`)
  return response.data
}

export const triggerCrawl = async (payload: CrawlRequestPayload): Promise<CrawlResponse> => {
  const response = await request.post<CrawlResponse>('/crawl-tasks/crawl', payload)
  return response.data
}

export const retryCrawlTask = async (id: number): Promise<CrawlTaskListItem> => {
  const response = await request.post<CrawlTaskListItem>(`/crawl-tasks/${id}/retry`)
  return response.data
}

export const batchDeleteCrawlTasks = async (
  ids: number[],
): Promise<{ success: boolean; count: number }> => {
  const response = await request.delete('/crawl-tasks/batch', { data: { ids } })
  return response.data
}

export const deleteCrawlTask = async (id: number): Promise<{ success: boolean }> => {
  const response = await request.delete(`/crawl-tasks/${id}`)
  return response.data
}

export const confirmCrawlSelection = async (
  id: number,
  payload: CrawlConfirmPayload,
): Promise<CrawlConfirmResult> => {
  const response = await request.post<CrawlConfirmResult>(`/crawl-tasks/${id}/confirm`, payload)
  return response.data
}
