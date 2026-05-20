import api from './index'
import type {
  LicenseListItem,
  LicenseCreatePayload,
  LicenseUpdatePayload,
  LicenseQueryParams,
  ContentForTradeItem,
  ContentAddToLicensePayload,
  BatchDeletePayload,
  LicenseHistoryItem,
} from '../types/trade'
import type { PaginatedResponse } from '../types/basic'

export const getLicenses = (params: LicenseQueryParams) =>
  api.get<PaginatedResponse<LicenseListItem>>('/licenses/', { params }).then((r) => r.data)

export const getLicense = (id: number) =>
  api.get<LicenseListItem>(`/licenses/${id}`).then((r) => r.data)

export const createLicense = (data: LicenseCreatePayload) =>
  api.post<LicenseListItem>('/licenses/', data).then((r) => r.data)

export const updateLicense = (id: number, data: LicenseUpdatePayload) =>
  api.put<LicenseListItem>(`/licenses/${id}`, data).then((r) => r.data)

export const deleteLicense = (id: number) =>
  api.delete(`/licenses/${id}`).then((r) => r.data)

export const batchDeleteLicenses = (data: BatchDeletePayload) =>
  api.delete('/licenses/batch', { data }).then((r) => r.data)

export const getWithoutLicenseContentCount = () =>
  api.get<{ count: number }>('/licenses/without-license-content-count').then((r) => r.data)

export const getLicenseContents = (licenseId: number) =>
  api.get<ContentForTradeItem[]>(`/licenses/${licenseId}/contents`).then((r) => r.data)

export const addContentsToLicense = (licenseId: number, data: ContentAddToLicensePayload) =>
  api.post<ContentForTradeItem[]>(`/licenses/${licenseId}/contents`, data).then((r) => r.data)

export const removeContentFromLicense = (licenseId: number, contentId: number) =>
  api.delete(`/licenses/${licenseId}/contents/${contentId}`).then((r) => r.data)

export const getUnlicensedContents = (params: {
  page?: number
  page_size?: number
  title?: string
  content_types?: string[]
  ingest_statuses?: string[]
  genres?: string[]
}) =>
  api
    .get<PaginatedResponse<ContentForTradeItem>>('/licenses/available-contents/unlicensed', { params })
    .then((r) => r.data)

export const getAvailableContentsForLicense = (
  licenseId: number,
  params: {
    page?: number
    page_size?: number
    title?: string
    content_types?: string[]
    ingest_statuses?: string[]
    genres?: string[]
    without_license?: boolean
  }
) =>
  api
    .get<PaginatedResponse<ContentForTradeItem>>(`/licenses/${licenseId}/available-contents`, { params })
    .then((r) => r.data)

export const getLicenseHistory = (licenseId: number, limit = 100) =>
  api
    .get<LicenseHistoryItem[]>(`/licenses/${licenseId}/history`, { params: { limit } })
    .then((r) => r.data)
