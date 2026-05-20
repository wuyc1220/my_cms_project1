import api from './index'
import type {
  WorkflowConfigListItem,
  WorkflowConfigDetail,
  WorkflowConfigCreatePayload,
  WorkflowConfigUpdatePayload,
  AvailableNode,
  WorkflowConfigQueryParams,
} from '../types/workflow'
import type { PaginatedResponse } from '../types/basic'

export const getWorkflowConfigs = (params: WorkflowConfigQueryParams) =>
  api.get<PaginatedResponse<WorkflowConfigListItem>>('/workflow/configs', { params }).then((r) => r.data)

export const getWorkflowConfigDetail = (configId: number) =>
  api.get<WorkflowConfigDetail>(`/workflow/configs/${configId}`).then((r) => r.data)

export const createWorkflowConfig = (data: WorkflowConfigCreatePayload) =>
  api.post<WorkflowConfigDetail>('/workflow/configs', data).then((r) => r.data)

export const updateWorkflowConfig = (configId: number, data: WorkflowConfigUpdatePayload) =>
  api.put<WorkflowConfigDetail>(`/workflow/configs/${configId}`, data).then((r) => r.data)

export const deleteWorkflowConfig = (configId: number) =>
  api.delete(`/workflow/configs/${configId}`).then((r) => r.data)

export const publishWorkflowConfig = (configId: number) =>
  api.post<WorkflowConfigDetail>(`/workflow/configs/${configId}/publish`).then((r) => r.data)

export const unpublishWorkflowConfig = (configId: number) =>
  api.post<WorkflowConfigDetail>(`/workflow/configs/${configId}/unpublish`).then((r) => r.data)

export const batchPublishWorkflowConfigs = (configIds: number[]) =>
  api.post<WorkflowConfigDetail[]>('/workflow/configs/batch-publish', configIds).then((r) => r.data)

export const getAvailableNodes = () =>
  api.get<AvailableNode[]>('/workflow/available-nodes').then((r) => r.data)

export const getPublishedWorkflow = (belonging: string) =>
  api.get<WorkflowConfigDetail | null>(`/workflow/published/${belonging}`).then((r) => r.data)

export const createNewVersion = (configId: number) =>
  api.post<WorkflowConfigDetail>(`/workflow/configs/${configId}/new-version`).then((r) => r.data)

export const getVersionHistory = (configId: number) =>
  api.get<Array<{
    id: number
    version: number
    status: string
    published_version: number | null
    created_at: string | null
    updated_at: string | null
    created_by: number | null
  }>>(`/workflow/configs/${configId}/versions`).then((r) => r.data)
