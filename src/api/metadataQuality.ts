import request from './index'
import type { PaginatedResponse } from '../types/pagination'

export interface MetadataQualityCheck {
  id: number
  check_time: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  total_contents: number
  passed_count: number
  failed_count: number
  duration: number | null
}

export interface MetadataQualityIssue {
  id: number
  content_id: number
  content_name: string
  content_type: string
  issue_type: 'missing' | 'format' | 'invalid'
  field_name: string
  severity: 'critical' | 'medium' | 'minor'
  expected_value: string
  actual_value: string
}

export interface MetadataQualityCheckDetail extends MetadataQualityCheck {
  issues: MetadataQualityIssue[]
}

export interface MetadataQualityQueryParams {
  page?: number
  page_size?: number
  time_start?: string
  time_end?: string
  status?: string[]
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export const getMetadataQualityChecks = async (
  params: MetadataQualityQueryParams,
): Promise<PaginatedResponse<MetadataQualityCheck>> => {
  const response = await request.get<PaginatedResponse<MetadataQualityCheck>>(
    '/metadata-quality-checks/',
    { params },
  )
  return response.data
}

export const getMetadataQualityCheck = async (
  id: number,
): Promise<MetadataQualityCheckDetail> => {
  const response = await request.get<MetadataQualityCheckDetail>(`/metadata-quality-checks/${id}`)
  return response.data
}

export interface MetadataQualityIssuesQueryParams {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export const getMetadataQualityIssues = async (
  checkId: number,
  params: MetadataQualityIssuesQueryParams,
): Promise<PaginatedResponse<MetadataQualityIssue>> => {
  const response = await request.get<PaginatedResponse<MetadataQualityIssue>>(
    `/metadata-quality-checks/${checkId}/issues`,
    { params },
  )
  return response.data
}

export const triggerMetadataQualityCheck = async (): Promise<{ id: number }> => {
  const response = await request.post<{ id: number }>('/metadata-quality-checks/trigger')
  return response.data
}

export const deleteMetadataQualityChecks = async (
  ids: number[],
): Promise<{ deleted: number }> => {
  const response = await request.delete<{ deleted: number }>(
    '/metadata-quality-checks/batch',
    { data: { ids } },
  )
  return response.data
}

export const downloadMetadataQualityReport = async (id: number): Promise<void> => {
  const response = await request.get(`/metadata-quality-checks/${id}/report`, {
    responseType: 'blob',
  })
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `metadata_quality_report_${id}.xlsx`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
