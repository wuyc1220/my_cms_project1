import request from './index'
import type {
  CastRoleMapItem,
  CastRoleMapCreatePayload,
  CastRoleMapUpdatePayload,
  CastRoleMapQueryParams,
  CastRoleMapListResponse,
  EntityFieldValueItem,
  EntityFieldValuesPayload,
} from '../types/basic'

export const getCastRoleMaps = async (params: CastRoleMapQueryParams): Promise<CastRoleMapListResponse> => {
  const response = await request.get<CastRoleMapListResponse>('/cast-role-maps/', { params })
  return response.data
}

export const getCastRoleMap = async (mapId: number): Promise<CastRoleMapItem> => {
  const response = await request.get<CastRoleMapItem>(`/cast-role-maps/${mapId}`)
  return response.data
}

export const createCastRoleMap = async (payload: CastRoleMapCreatePayload): Promise<CastRoleMapItem> => {
  const response = await request.post<CastRoleMapItem>('/cast-role-maps/', payload)
  return response.data
}

export const batchCreateCastRoleMaps = async (payloads: CastRoleMapCreatePayload[]): Promise<CastRoleMapItem[]> => {
  const response = await request.post<CastRoleMapItem[]>('/cast-role-maps/batch', payloads)
  return response.data
}

export const updateCastRoleMap = async (mapId: number, payload: CastRoleMapUpdatePayload): Promise<CastRoleMapItem> => {
  const response = await request.put<CastRoleMapItem>(`/cast-role-maps/${mapId}`, payload)
  return response.data
}

export const deleteCastRoleMap = async (mapId: number): Promise<void> => {
  await request.delete(`/cast-role-maps/${mapId}`)
}

export const batchDeleteCastRoleMaps = async (mapIds: number[]): Promise<void> => {
  await request.post('/cast-role-maps/batch-delete', { map_ids: mapIds })
}

export const getCastRoleMapFieldValues = async (mapId: number): Promise<EntityFieldValueItem[]> => {
  const response = await request.get<EntityFieldValueItem[]>(`/cast-role-maps/${mapId}/field-values`)
  return response.data
}

export const saveCastRoleMapFieldValues = async (
  mapId: number,
  payload: EntityFieldValuesPayload,
): Promise<EntityFieldValueItem[]> => {
  const response = await request.put<EntityFieldValueItem[]>(`/cast-role-maps/${mapId}/field-values`, payload)
  return response.data
}
