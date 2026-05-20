import request from './index'
import type {
  DashboardData,
  UserDashboardConfig,
  UserDashboardConfigUpdate,
} from '../types/dashboard'

/**
 * 获取看板综合数据
 */
export const getDashboardData = async (): Promise<DashboardData> => {
  const response = await request.get<DashboardData>('/dashboard/')
  return response.data
}

/**
 * 获取用户看板配置
 */
export const getDashboardConfig = async (): Promise<UserDashboardConfig> => {
  const response = await request.get<UserDashboardConfig>('/dashboard/config')
  return response.data
}

/**
 * 更新用户看板配置
 */
export const updateDashboardConfig = async (
  data: UserDashboardConfigUpdate
): Promise<UserDashboardConfig> => {
  const response = await request.put<UserDashboardConfig>('/dashboard/config', data)
  return response.data
}

/**
 * 重置用户看板配置为默认
 */
export const resetDashboardConfig = async (): Promise<UserDashboardConfig> => {
  const response = await request.post<UserDashboardConfig>('/dashboard/config/reset')
  return response.data
}
