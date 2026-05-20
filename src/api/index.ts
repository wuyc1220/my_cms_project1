import axios from 'axios'
import { message } from 'antd'

let isRedirecting = false

const request = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  paramsSerializer: (params) => {
    const parts: string[] = []
    for (const key of Object.keys(params)) {
      const val = params[key]
      if (val === undefined || val === null) continue
      if (Array.isArray(val)) {
        val.forEach((v) => parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`))
      } else {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
      }
    }
    return parts.join('&')
  },
})

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const data = error.response?.data

    let detail = ''
    if (Array.isArray(data?.detail)) {
      detail = data.detail
        .map((d: unknown) => (typeof d === 'string' ? d : (d as Record<string, unknown>)?.msg || JSON.stringify(d)))
        .join('; ')
    } else if (typeof data?.detail === 'string') {
      detail = data.detail
    } else if (typeof data?.message === 'string') {
      detail = data.message
    }

    // 标记错误已被全局拦截器处理过，页面组件可据此避免重复提示
    error._handled = true

    if (status === 401) {
      if (!isRedirecting && window.location.pathname !== '/login') {
        isRedirecting = true
        localStorage.removeItem('token')
        message.warning(detail || '登录已过期，请重新登录', 2, () => {
          window.location.href = '/login'
        })
      } else if (window.location.pathname === '/login') {
        message.error(detail || '用户名或密码错误')
      }
    } else if (status === 403) {
      // 403 错误由业务组件自己处理，不在全局显示
      // 保留 detail 在 error 对象中供组件使用
      error._handled = false
    } else if (status === 404) {
      message.error(detail || '资源不存在')
    } else if (detail) {
      message.error(detail)
    }

    return Promise.reject(error)
  },
)

/**
 * 判断错误是否已被全局拦截器处理（已弹出 message 提示）。
 * 组件 catch 块中可用此函数避免重复弹窗：
 *
 *   catch (err) {
 *     if (isHandledError(err)) return
 *     message.error('自定义提示')
 *   }
 */
export function isHandledError(err: unknown): boolean {
  return Boolean((err as { _handled?: boolean })._handled)
}

export default request
