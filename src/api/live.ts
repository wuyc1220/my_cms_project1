import api from './index'
import type {
  ChannelListItem,
  ChannelDetailItem,
  ChannelUpdatePayload,
  ChannelQueryParams,
  PhysicalChannelListItem,
  PhysicalChannelCreatePayload,
  PhysicalChannelHistoryItem,
  PhysicalChannelHistoryQueryParams,
  ContentPackageRef,
  ContentCategoryRef,
  ProcessListItem,
  StatusLogListItem,
  ActivityLogListItem,
  ScheduleListItem,
  ScheduleCreatePayload,
  ScheduleQueryParams,
  ArchiveListItem,
  ArchiveQueryParams,
  ArchiveRequestPayload,
  ArchiveResponse,
} from '../types/live'
import type { PaginatedResponse, EntityFieldValueItem, ImportResultPayload } from '../types/basic'
import type { ContentSimpleItem } from '../types/content'

/** 查询频道列表（分页）*/
export const getChannels = (params: ChannelQueryParams) =>
  api.get<PaginatedResponse<ChannelListItem>>('/live/channels', { params }).then((r) => r.data)

/** 查询频道详情 */
export const getChannelDetail = (channelId: number) =>
  api.get<ChannelDetailItem>(`/live/channels/${channelId}`).then((r) => r.data)

/** 编辑频道 */
export const updateChannel = (channelId: number, data: ChannelUpdatePayload) =>
  api.put<ChannelDetailItem>(`/live/channels/${channelId}`, data).then((r) => r.data)

/** 查询物理频道列表 */
export const getPhysicalChannels = (channelId: number, params?: { page?: number; page_size?: number }) =>
  api.get<PaginatedResponse<PhysicalChannelListItem>>(`/live/channels/${channelId}/physical-channels`, { params }).then((r) => r.data)

/** 新增物理频道 */
export const createPhysicalChannel = (channelId: number, data: PhysicalChannelCreatePayload) =>
  api.post<PhysicalChannelListItem>(`/live/channels/${channelId}/physical-channels`, data).then((r) => r.data)

/** 删除物理频道 */
export const deletePhysicalChannel = (channelId: number, pcId: number) =>
  api.delete(`/live/channels/${channelId}/physical-channels/${pcId}`).then((r) => r.data)

/** 查询物理频道操作历史记录 */
export const getPhysicalChannelHistory = (channelId: number, params?: PhysicalChannelHistoryQueryParams) =>
  api.get<PaginatedResponse<PhysicalChannelHistoryItem>>(`/live/channels/${channelId}/physical-channels/history`, { params }).then((r) => r.data)

/** 查询物理频道自定义字段值 */
export const getPhysicalChannelFieldValues = (channelId: number, pcId: number) =>
  api.get<EntityFieldValueItem[]>(`/live/channels/${channelId}/physical-channels/${pcId}/field-values`).then((r) => r.data)

/** 保存物理频道自定义字段值 */
export const savePhysicalChannelFieldValues = (channelId: number, pcId: number, values: EntityFieldValueItem[]) =>
  api.put<EntityFieldValueItem[]>(`/live/channels/${channelId}/physical-channels/${pcId}/field-values`, { values }).then((r) => r.data)

/** 查询内容关联的服务包列表 */
export const getContentPackages = (contentId: number) =>
  api.get<ContentPackageRef[]>(`/live/contents/${contentId}/packages`).then((r) => r.data)

/** 新增内容-服务包关联 */
export const linkContentPackages = (contentId: number, packageIds: number[]) =>
  api.post<ContentPackageRef[]>(`/live/contents/${contentId}/packages`, { package_ids: packageIds }).then((r) => r.data)

/** 删除内容-服务包关联 */
export const unlinkContentPackage = (contentId: number, packageId: number) =>
  api.delete(`/live/contents/${contentId}/packages/${packageId}`).then((r) => r.data)

/** 查询内容关联的栏目列表 */
export const getContentCategories = (contentId: number) =>
  api.get<ContentCategoryRef[]>(`/live/contents/${contentId}/categories`).then((r) => r.data)

/** 新增内容-栏目关联 */
export const linkContentCategories = (contentId: number, categoryIds: number[]) =>
  api.post<ContentCategoryRef[]>(`/live/contents/${contentId}/categories`, { category_ids: categoryIds }).then((r) => r.data)

/** 删除内容-栏目关联 */
export const unlinkContentCategory = (contentId: number, categoryId: number) =>
  api.delete(`/live/contents/${contentId}/categories/${categoryId}`).then((r) => r.data)

/** 查询流程列表 */
export const getProcesses = (contentId: number) =>
  api.get<ProcessListItem[]>(`/live/contents/${contentId}/processes`).then((r) => r.data)

/** 查询状态日志 */
export const getStatusLogs = (contentId: number) =>
  api.get<StatusLogListItem[]>(`/live/contents/${contentId}/status-logs`).then((r) => r.data)

/** 查询活动日志 */
export const getActivityLogs = (contentId: number) =>
  api.get<ActivityLogListItem[]>(`/live/contents/${contentId}/activity-logs`).then((r) => r.data)

/** 查询节目单列表（分页）*/
export const getSchedules = (params: ScheduleQueryParams) =>
  api.get<PaginatedResponse<ScheduleListItem>>('/live/schedules', { params }).then((r) => r.data)

/** 查询节目单详情 */
export const getScheduleDetail = (scheduleId: number) =>
  api.get<ScheduleListItem>(`/live/schedules/${scheduleId}`).then((r) => r.data)

/** 新增节目单 */
export const createSchedule = (data: ScheduleCreatePayload) =>
  api.post<ScheduleListItem>('/live/schedules', data).then((r) => r.data)

/** 软删除节目单 */
export const deleteSchedule = (id: number) =>
  api.delete(`/live/schedules/${id}`).then((r) => r.data)

/** 导出节目单 Excel */
export const exportSchedulesExcel = async (ids: number[]): Promise<Blob> => {
  const response = await api.post('/live/schedules/export', { ids }, { responseType: 'blob' })
  return response.data
}

/** 节目单导入冲突项 */
export interface ScheduleImportConflict {
  row: number
  channel_name?: string | null
  title?: string | null
  begin_time?: string | null
  end_time?: string | null
  conflict_ids: number[]
}

/** 节目单导入结果（含冲突明细） */
export interface ScheduleImportResultPayload extends ImportResultPayload {
  conflicts?: ScheduleImportConflict[]
}

/** 导入节目单 Excel；force=true 时强制覆盖频道+时间段冲突 */
export const importSchedulesExcel = async (
  file: File,
  force = false,
): Promise<ScheduleImportResultPayload> => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post<ScheduleImportResultPayload>('/live/schedules/import', formData, {
    params: { force },
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

/** 查询归档内容列表（分页）*/
export const getArchives = (params: ArchiveQueryParams) =>
  api.get<PaginatedResponse<ArchiveListItem>>('/live/archives', { params }).then((r) => r.data)

/** 获取频道简要列表（节目单新增时的频道下拉）*/
export const getChannelsSimple = () =>
  api.get<ContentSimpleItem[]>('/contents/channels-simple').then((r) => r.data)

/** 审核请求体 */
export interface ReviewPayload {
  review_type: 'approve' | 'reject'
  issue_types?: string[]
  description?: string
  review_level?: 'L1' | 'L2' | 'L3'
}

/** 发起内容审核 */
export const initiateReview = (contentId: number) =>
  api.post(`/live/contents/${contentId}/review/initiate`).then((r) => r.data)

/** 提交内容审核 */
export const submitReview = (contentId: number, data: ReviewPayload) =>
  api.post(`/live/contents/${contentId}/review`, data).then((r) => r.data)

/** 获取内容审核状态 */
export const getReviewStatus = (contentId: number) =>
  api.get(`/live/contents/${contentId}/review/status`).then((r) => r.data)

/** 校验当前用户是否有权限进行内容审核操作 */
export const checkReviewPermission = (contentId: number) =>
  api.get(`/live/contents/${contentId}/review/permission`).then((r) => r.data)

/** 设置内容发布计划 */
export const setPublishPlan = (contentId: number, data: { execution_mode: 'now' | 'plan'; task_type: 'publish' | 'unpublish'; scheduled_time?: string; content_type?: string }) =>
  api.post(`/publishes/Content/${contentId}/plan`, data).then((r) => r.data)

/** 归档节目单：根据 SeriesType 创建 MOVIE/EPISODE/SERIES/SEASON 归档产物 */
export const archiveSchedule = (data: ArchiveRequestPayload) =>
  api.post<ArchiveResponse>('/live/schedules/archive', data).then((r) => r.data)