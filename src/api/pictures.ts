import request from './index'

export interface PictureItem {
  id: number
  entity_type: string
  entity_id: number
  poster_size_id: number
  file_name: string
  file_path: string
  relative_path?: string
  file_size: number
  width: number | null
  height: number | null
  created_at: string
  url: string
}

/** 创建图片记录的入参（文件已通过通用附件 API 上传） */
export interface PictureCreatePayload {
  entity_type: string
  entity_id: number
  poster_size_id: number
  file_path: string
  file_name: string
  file_size: number
  relative_path?: string
}

export const getPictures = async (entityType: string, entityId: number): Promise<PictureItem[]> => {
  const response = await request.get<PictureItem[]>('/pictures', {
    params: { entity_type: entityType, entity_id: entityId },
  })
  return response.data
}

/** 通过通用附件 API 上传文件后，调用此接口创建图片记录 */
export const createPicture = async (payload: PictureCreatePayload): Promise<PictureItem> => {
  const response = await request.post<PictureItem>('/pictures', payload)
  return response.data
}

/** @deprecated 请使用 uploadAttachment (from attachments.ts) + createPicture 两步调用 */
export const uploadPicture = async (entityType: string, entityId: number, posterSizeId: number, file: File): Promise<PictureItem> => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await request.post<PictureItem>('/pictures/upload', formData, {
    params: { entity_type: entityType, entity_id: entityId, poster_size_id: posterSizeId },
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export const deletePicture = async (pictureId: number): Promise<void> => {
  await request.delete(`/pictures/${pictureId}`)
}

/** 发布海报 */
export interface PicturePublishResponse {
  success: boolean
  message: string
  xml_path?: string
}

export const publishPictures = async (
  entityType: string,
  entityId: number
): Promise<PicturePublishResponse> => {
  const response = await request.post<PicturePublishResponse>('/pictures/publish', {
    entity_type: entityType,
    entity_id: entityId,
  })
  return response.data
}

/** 校验海报是否已发布 */
export interface PicturePublishCheckResponse {
  can_publish: boolean
  total_count: number
  published_count: number
  unpublished_count: number
  unpublished_pictures: { id: number; file_name: string; ingest_status: string; message: string }[]
  message: string
}

export const checkPicturesPublishStatus = async (
  entityType: string,
  entityId: number,
  contentType?: string
): Promise<PicturePublishCheckResponse> => {
  const response = await request.get<PicturePublishCheckResponse>('/pictures/publish-check', {
    params: { entity_type: entityType, entity_id: entityId, content_type: contentType },
  })
  return response.data
}
