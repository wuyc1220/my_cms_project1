import api from './index'
import type {
  ContentListItem,
  ContentCreatePayload,
  ContentUpdatePayload,
  ContentSimpleItem,
  ContentLicenseRef,
  AdjacentContentResponse,
  ContentQueryParams,
  ContentDetailResponse,
  BatchImportRequest,
  BatchImportResponse,
} from '../types/content'
import type { EntityFieldValueItem, EntityFieldValuesPayload, EntityI18nItem, EntityI18nPayload, PaginatedResponse } from '../types/basic'

/** 查询内容列表（分页）*/
export const getContents = (params: ContentQueryParams) =>
  api
    .get<PaginatedResponse<ContentListItem>>('/contents/', { params })
    .then((r) => r.data)

/** 查询单个内容详情（含任务指派人信息）*/
export const getContent = (id: number) =>
  api.get<ContentDetailResponse>(`/contents/${id}`).then((r) => r.data)

/** 新建内容（含 SERIES/SEASON 子节点自动创建）*/
export const createContent = (data: ContentCreatePayload) =>
  api.post<ContentListItem>('/contents/', data).then((r) => r.data)

/** 编辑内容基本信息（skipMetadataProcess: 元数据弹窗链路传 true，跳过补写 Metadata 流程记录，避免 Pending 中间条） */
export const updateContent = (id: number, data: ContentUpdatePayload, skipMetadataProcess = false) =>
  api.put<ContentListItem>(`/contents/${id}`, data, {
    params: skipMetadataProcess ? { skip_metadata_process: true } : undefined,
  }).then((r) => r.data)

/** 软删除内容（级联删除子节点）*/
export const deleteContent = (id: number) =>
  api.delete(`/contents/${id}`).then((r) => r.data)

/** 批量软删除内容 */
export const batchDeleteContents = (ids: number[]) =>
  api.post<{ deleted: number }>('/contents/batch-delete', { ids }).then((r) => r.data)

/** 统计无许可证内容数量 */
export const getWithoutLicenseContentCount = () =>
  api.get<{ count: number }>('/contents/without-license-count').then((r) => r.data)

/** 获取 SERIES 简要列表（EPISODE 父级下拉）*/
export const getSeriesSimple = () =>
  api.get<ContentSimpleItem[]>('/contents/series-simple').then((r) => r.data)

/** 获取 SEASON 简要列表（SEASON_SERIES 父级下拉）*/
export const getSeasonsSimple = () =>
  api.get<ContentSimpleItem[]>('/contents/seasons-simple').then((r) => r.data)

/** 获取 CHANNEL 简要列表（SCHEDULE 频道下拉）*/
export const getChannelsSimple = () =>
  api.get<ContentSimpleItem[]>('/contents/channels-simple').then((r) => r.data)

/** 查询内容已关联的许可证列表 */
export const getContentLicenses = (contentId: number) =>
  api.get<ContentLicenseRef[]>(`/contents/${contentId}/licenses`).then((r) => r.data)

/** 查询相邻内容 ID（上一条/下一条）
 * @param contentId 当前内容ID
 * @param contentTypes 内容类型数组（可选，如果传入则只返回指定类型的相邻内容）
 * @param isArchived 是否只查询归档内容（可选，Archive Management 使用）
 */
export const getAdjacentContent = (contentId: number, contentTypes?: string[], isArchived?: boolean) => {
  const params: Record<string, any> = {}
  if (contentTypes && contentTypes.length > 0) {
    params.content_types = contentTypes.join(',')
  }
  if (isArchived !== undefined) {
    params.is_archived = isArchived
  }
  return api.get<AdjacentContentResponse>(`/contents/${contentId}/adjacent`, { params }).then((r) => r.data)
}

/** 查询内容的自定义字段值 */
export const getContentFieldValues = (contentId: number) =>
  api.get<EntityFieldValueItem[]>(`/contents/${contentId}/field-values`).then((r) => r.data)

/** 保存内容的自定义字段值 */
export const saveContentFieldValues = (contentId: number, payload: EntityFieldValuesPayload) =>
  api.put<EntityFieldValueItem[]>(`/contents/${contentId}/field-values`, payload).then((r) => r.data)

/** 查询内容的多语言值 */
export const getContentI18n = (contentId: number) =>
  api.get<EntityI18nItem[]>(`/contents/${contentId}/i18n`).then((r) => r.data)

/** 保存内容的多语言值（按语言） */
export const saveContentI18n = (contentId: number, payload: EntityI18nPayload) =>
  api.put<EntityI18nItem[]>(`/contents/${contentId}/i18n`, payload).then((r) => r.data)

/** 查询子内容列表（根据 parent_id） */
export const getContentChildren = (parentId: number, contentType: string) =>
  api
    .get<PaginatedResponse<ContentListItem>>('/contents/', {
      params: { parent_id: parentId, content_types: [contentType], page_size: 999 },
    })
    .then((r) => r.data)

/** 批量导入子内容（EPISODE/SERIES），单个事务 */
export const batchImportContents = (data: BatchImportRequest) =>
  api.post<BatchImportResponse>('/contents/batch', data).then((r) => r.data)

/** 下载导入模板（EPISODE/SERIES） */
export const downloadImportTemplate = async (contentType: 'EPISODE' | 'SERIES', filename: string) => {
  const response = await api.get(`/contents/template/${contentType}`, {
    responseType: 'blob',
  })
  const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/** 解析 Excel 导入文件（EPISODE/SERIES/SEASON_SERIES） */
export interface ParseExcelItem {
  row: number
  title: string
  sequence?: number
  series_ordinal?: number
  assignee?: string
}

export interface ParseExcelResponse {
  items: ParseExcelItem[]
}

export const parseExcelFile = (contentType: 'EPISODE' | 'SERIES' | 'SEASON_SERIES', file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post<ParseExcelResponse>(`/contents/parse-excel?content_type=${contentType}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data)
}

export interface NodeStatus {
  completed: boolean
  warning: boolean
  detail: string
}

export const getNodeStatus = (contentId: number) =>
  api.get<Record<string, NodeStatus>>(`/contents/${contentId}/node-status`).then((r) => r.data)
