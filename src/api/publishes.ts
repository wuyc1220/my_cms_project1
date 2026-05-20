import api from './index'
import type { PaginatedResponse } from '../types/basic'
import type {
  PublishListItem,
  PublishQueryParams,
  PublishPlanCreate,
  PublishPlanResponse,
  PublishPlanUpdate,
  BatchPublishRequest,
  IngestHistoryItem,
  IngestHistoryQueryParams,
} from '../types/publish'

// 获取发布任务列表
export const getPublishes = (params?: PublishQueryParams) =>
  api.get<PaginatedResponse<PublishListItem>>('/publishes/', { params }).then((r) => r.data)

// 批量发布
export const batchPublish = (data: BatchPublishRequest) =>
  api.post<PublishPlanResponse[]>('/publishes/batch-publish', data).then((r) => r.data)

// 批量下架
export const batchUnpublish = (data: BatchPublishRequest) =>
  api.post<PublishPlanResponse[]>('/publishes/batch-unpublish', data).then((r) => r.data)

// 立即发布
export const publishNow = (entityType: string, entityId: number) =>
  api.post<PublishPlanResponse>(`/publishes/${entityType}/${entityId}/publish`).then((r) => r.data)

// 立即下架
export const unpublishNow = (entityType: string, entityId: number) =>
  api.post<PublishPlanResponse>(`/publishes/${entityType}/${entityId}/unpublish`).then((r) => r.data)

// 设置发布/下架计划
export const createPublishPlan = (entityType: string, entityId: number, data: PublishPlanCreate) =>
  api.post<PublishPlanResponse>(`/publishes/${entityType}/${entityId}/plan`, data).then((r) => r.data)

// 修改发布/下架计划
export const updatePublishPlan = (taskId: number, data: PublishPlanUpdate) =>
  api.put<PublishPlanResponse>(`/publishes/${taskId}/plan`, data).then((r) => r.data)

// 取消发布/下架计划
export const cancelPublishPlan = (taskId: number) =>
  api.delete<{ success: boolean }>(`/publishes/${taskId}/plan`).then((r) => r.data)

// 获取当前发布计划
export const getCurrentPublishPlan = (entityType: string, entityId: number) =>
  api.get(`/publishes/${entityType}/${entityId}/current-plan`).then((r) => r.data)

// 获取注入历史
export const getIngestHistories = (entityType: string, entityId: number, params?: IngestHistoryQueryParams) =>
  api.get<PaginatedResponse<IngestHistoryItem>>(`/publishes/${entityType}/${entityId}/history`, { params }).then((r) => r.data)
