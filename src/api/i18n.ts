import axios from 'axios'
import type { LanguageConfigResponse, LanguageOption } from '../types/i18n'
import { getUiLanguageSync } from '../i18n/getMsg'

// A bare axios instance with no auth header injection and no 401 redirect,
// used only for public bootstrap calls before the user logs in.
const publicRequest = axios.create({
  baseURL: '/api/v1',
  timeout: 5000,
})

// 按已保存的 UI 语言设置 Accept-Language（首次拉取语言配置前用 localStorage 兜底）。
publicRequest.interceptors.request.use((config) => {
  config.headers['Accept-Language'] = getUiLanguageSync() === 'en' ? 'en-US' : 'zh-CN'
  return config
})

export const getUiLanguage = async (): Promise<LanguageConfigResponse> => {
  const response = await publicRequest.get<LanguageConfigResponse>('/configs/ui-language')
  return response.data
}

export const getMultiLanguageOptions = async (): Promise<LanguageOption[]> => {
  const response = await publicRequest.get<LanguageOption[]>('/dicts/multi-languages/options')
  return response.data
}
