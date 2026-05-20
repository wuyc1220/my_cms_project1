import request from './index'

export interface PictureItem {
  id: number
  entity_type: string
  entity_id: number
  poster_size_id: number
  file_name: string
  file_path: string
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
