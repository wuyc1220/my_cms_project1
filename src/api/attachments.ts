import api from './index'
import type { AttachmentUploadResult } from '../types/basic'

/**
 * 通用附件上传
 * @param file 文件对象
 * @param category 文件分类目录，如 'contracts'、'pictures'、'general'，默认 'general'
 */
export const uploadAttachment = (file: File, category?: string): Promise<AttachmentUploadResult> => {
  const formData = new FormData()
  formData.append('file', file)
  return api
    .post<AttachmentUploadResult>('/attachments/upload', formData, {
      params: category ? { category } : undefined,
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // 5分钟超时，支持大文件上传
    })
    .then((r) => r.data)
}

/**
 * 通用附件下载（通过 query 参数传递路径，避免特殊字符编码问题）
 * @param filePath upload 接口返回的 file_path
 */
export const downloadAttachment = (filePath: string): Promise<Blob> => {
  return api
    .get('/attachments/download', {
      params: { path: filePath },
      responseType: 'blob',
    })
    .then((r) => r.data as Blob)
}

/**
 * 获取附件可直接访问的 URL
 * @param filePath upload 接口返回的 file_path
 */
export const getAttachmentUrl = (filePath: string): string => {
  return `/api/v1/attachments/download?path=${encodeURIComponent(filePath)}&inline=1`
}
