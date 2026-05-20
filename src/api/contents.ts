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

/** 编辑内容基本信息 */
export const updateContent = (id: number, data: ContentUpdatePayload) =>
  api.put<ContentListItem>(`/contents/${id}`, data).then((r) => r.data)

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

/** 获取 CHANNEL 简要列表（SCHEDULE 频道下拉）*/
export const getChannelsSimple = () =>
  api.get<ContentSimpleItem[]>('/contents/channels-simple').then((r) => r.data)

/** 查询内容已关联的许可证列表 */
export const getContentLicenses = (contentId: number) =>
  api.get<ContentLicenseRef[]>(`/contents/${contentId}/licenses`).then((r) => r.data)

/** 查询相邻内容 ID（上一条/下一条） */
export const getAdjacentContent = (contentId: number) =>
  api.get<AdjacentContentResponse>(`/contents/${contentId}/adjacent`).then((r) => r.data)

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
