import axios from 'axios'
import type { LanguageConfigResponse, LanguageOption } from '../types/i18n'

// A bare axios instance with no auth header injection and no 401 redirect,
// used only for public bootstrap calls before the user logs in.
const publicRequest = axios.create({
  baseURL: '/api/v1',
  timeout: 5000,
})

export const getUiLanguage = async (): Promise<LanguageConfigResponse> => {
  const response = await publicRequest.get<LanguageConfigResponse>('/configs/ui-language')
  return response.data
}

export const getMultiLanguageOptions = async (): Promise<LanguageOption[]> => {
  const response = await publicRequest.get<LanguageOption[]>('/dicts/multi-languages/options')
  return response.data
}
