import api from './index'
import type {
  ContractListItem,
  ContractCreatePayload,
  ContractUpdatePayload,
  ContractSimpleItem,
  ContractQueryParams,
  ContractAttachmentItem,
  ContractHistoryItem,
  LicenseSimpleItem,
  BatchDeletePayload,
} from '../types/trade'
import type { PaginatedResponse } from '../types/basic'

export const getContracts = (params: ContractQueryParams) =>
  api.get<PaginatedResponse<ContractListItem>>('/contracts/', { params }).then((r) => r.data)

export const getContract = (id: number) =>
  api.get<ContractListItem>(`/contracts/${id}`).then((r) => r.data)

export const createContract = (data: ContractCreatePayload) =>
  api.post<ContractListItem>('/contracts/', data).then((r) => r.data)

export const updateContract = (id: number, data: ContractUpdatePayload) =>
  api.put<ContractListItem>(`/contracts/${id}`, data).then((r) => r.data)

export const deleteContract = (id: number) =>
  api.delete(`/contracts/${id}`).then((r) => r.data)

export const batchDeleteContracts = (data: BatchDeletePayload) =>
  api.delete('/contracts/batch', { data }).then((r) => r.data)

export const getContractsSimple = () =>
  api.get<ContractSimpleItem[]>('/contracts/simple').then((r) => r.data)

export const getWithoutLicenseCount = () =>
  api.get<{ count: number }>('/contracts/without-license-count').then((r) => r.data)

export const getContractLicenses = (contractId: number, name?: string) =>
  api.get<LicenseSimpleItem[]>(`/contracts/${contractId}/licenses`, { params: { name } }).then((r) => r.data)

export const getContractAttachments = (contractId: number) =>
  api.get<ContractAttachmentItem[]>(`/contracts/${contractId}/attachments`).then((r) => r.data)

export const deleteContractAttachment = (contractId: number, attachmentId: number) =>
  api.delete(`/contracts/${contractId}/attachments/${attachmentId}`).then((r) => r.data)

export const uploadContractAttachment = (contractId: number, formData: FormData) =>
  api
    .post<ContractAttachmentItem>(`/contracts/${contractId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data)

export const downloadContractAttachment = (contractId: number, attachmentId: number) =>
  api
    .get(`/contracts/${contractId}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    })
    .then((r) => r.data as Blob)

export const getContractHistory = (contractId: number, limit = 100) =>
  api
    .get<ContractHistoryItem[]>(`/contracts/${contractId}/history`, { params: { limit } })
    .then((r) => r.data)
