import request from './index'
import type {
  UsageLimitsResponse,
  UsageLimitsUpdateRequest,
} from '../types/usageLimit'

export const getUsageLimits = async (): Promise<UsageLimitsResponse> => {
  const response = await request.get<UsageLimitsResponse>('/usage-limits/')
  return response.data
}

export const updateUsageLimits = async (
  payload: UsageLimitsUpdateRequest,
): Promise<UsageLimitsResponse> => {
  const response = await request.put<UsageLimitsResponse>('/usage-limits/', payload)
  return response.data
}
