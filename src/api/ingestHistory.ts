import api from './index'
import type { PaginatedResponse } from '../types/basic'
import type { IngestHistoryItem, IngestHistoryDetailItem, IngestHistoryQueryParams, IngestHistoryDetailQueryParams } from '../types/ingestHistory'

export const getIngestHistories = (params?: IngestHistoryQueryParams) =>
  api.get<PaginatedResponse<IngestHistoryItem>>('/ingest-histories/', { params }).then((r) => r.data)

export const getIngestHistoryDetails = (params: IngestHistoryDetailQueryParams) =>
  api.get<PaginatedResponse<IngestHistoryDetailItem>>('/ingest-histories/details/', { params }).then((r) => r.data)
