import api from './index'
import type { VodContentListItem, VodContentQueryParams } from '../types/content'
import type { PaginatedResponse } from '../types/basic'

/** 查询 VOD 内容列表（分页）*/
export const getVodContents = (params: VodContentQueryParams) =>
  api
    .get<PaginatedResponse<VodContentListItem>>('/vod/contents', { params })
    .then((r) => r.data)

/** 导出 VOD 内容 Excel */
export const exportVodContentsExcel = async (ids: number[]): Promise<Blob> => {
  const response = await api.post('/vod/contents/export', { ids }, { responseType: 'blob' })
  return response.data
}

/** VOD 导入错误项 */
export interface VodImportError {
  row: number
  errors: string[]
}

/** VOD 导入结果 */
export interface VodImportResultPayload {
  total: number
  created: number
  updated: number
  skipped: number
  errors: VodImportError[]
}

/** 导入 VOD 内容 Excel */
export const importVodContentsExcel = async (file: File): Promise<VodImportResultPayload> => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post<VodImportResultPayload>('/vod/contents/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

/** 下载 VOD 内容导入模板 */
export const downloadVodTemplate = async (): Promise<Blob> => {
  const response = await api.get('/vod/contents/template', { responseType: 'blob' })
  return response.data
}
