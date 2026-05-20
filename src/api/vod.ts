import api from './index'
import type { VodContentListItem, VodContentQueryParams } from '../types/content'
import type { PaginatedResponse } from '../types/basic'

/** 查询 VOD 内容列表（分页）*/
export const getVodContents = (params: VodContentQueryParams) =>
  api
    .get<PaginatedResponse<VodContentListItem>>('/vod/contents', { params })
    .then((r) => r.data)
