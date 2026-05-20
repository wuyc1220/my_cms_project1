import api from './index'
import type {
  ProviderListItem,
  ProviderCreatePayload,
  ProviderUpdatePayload,
  ProviderSimpleItem,
  ProviderQueryParams,
  ProviderHistoryItem,
  ContractListItem,
  BatchDeletePayload,
} from '../types/trade'
import type { PaginatedResponse } from '../types/basic'

export const getProviders = (params: ProviderQueryParams) =>
  api.get<PaginatedResponse<ProviderListItem>>('/providers/', { params }).then((r) => r.data)

export const getProvider = (id: number) =>
  api.get<ProviderListItem>(`/providers/${id}`).then((r) => r.data)

export const createProvider = (data: ProviderCreatePayload) =>
  api.post<ProviderListItem>('/providers/', data).then((r) => r.data)

export const updateProvider = (id: number, data: ProviderUpdatePayload) =>
  api.put<ProviderListItem>(`/providers/${id}`, data).then((r) => r.data)

export const deleteProvider = (id: number) =>
  api.delete(`/providers/${id}`).then((r) => r.data)

export const batchDeleteProviders = (data: BatchDeletePayload) =>
  api.delete('/providers/batch', { data }).then((r) => r.data)

export const getProvidersSimple = () =>
  api.get<ProviderSimpleItem[]>('/providers/simple').then((r) => r.data)

export const getProviderContracts = (providerId: number) =>
  api.get<ContractListItem[]>(`/providers/${providerId}/contracts`).then((r) => r.data)

export const getProviderHistory = (providerId: number, limit = 100) =>
  api
    .get<ProviderHistoryItem[]>(`/providers/${providerId}/history`, { params: { limit } })
    .then((r) => r.data)
