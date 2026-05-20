import request from './index'
import type { LoginResponse, UserInfo } from '../types/auth'

export const login = async (
  username: string,
  password: string,
  captchaId: string,
  captchaCode: string
): Promise<LoginResponse> => {
  const response = await request.post<LoginResponse>('/auth/login', {
    username,
    password,
    captcha_id: captchaId,
    captcha_code: captchaCode,
  })
  return response.data
}

export const logout = async (): Promise<void> => {
  await request.post('/auth/logout')
}

export const getMe = async (): Promise<UserInfo> => {
  const response = await request.get<UserInfo>('/auth/me')
  return response.data
}

export const getCaptcha = async (): Promise<{ captchaId: string; imageBlob: Blob }> => {
  const response = await request.get('/auth/captcha', {
    responseType: 'blob',
  })
  // axios headers 是小写的
  const captchaId = response.headers['captcha-id'] as string || ''
  return { captchaId, imageBlob: response.data }
}

export const getSessionTimeout = async (): Promise<number> => {
  const response = await request.get<{ value: number }>('/auth/session-timeout')
  return response.data.value
}

export interface ChangePasswordRequest {
  old_password: string
  new_password: string
  confirm_password: string
}

export const changePassword = async (data: ChangePasswordRequest): Promise<void> => {
  await request.post('/auth/change-password', data)
}
