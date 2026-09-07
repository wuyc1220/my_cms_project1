import axios from 'axios'
import { message } from 'antd'
import { getMsg, getUiLanguageSync } from '../i18n/getMsg'

let isRedirecting = false
let redirectTimeoutId: ReturnType<typeof setTimeout> | null = null

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
  // 按当前 UI 语言设置 Accept-Language，使后端按请求语言返回本地化消息
  config.headers['Accept-Language'] = getUiLanguageSync() === 'en' ? 'en-US' : 'zh-CN'
  return config
})

request.interceptors.response.use(
  (response) => {
    isRedirecting = false
    if (redirectTimeoutId) {
      clearTimeout(redirectTimeoutId)
      redirectTimeoutId = null
    }
    return response
  },
  (error) => {
    const status = error.response?.status
    const data = error.response?.data

    let detail = ''
    if (Array.isArray(data?.detail)) {
      // 保留字段路径（loc），避免只拼接 msg 导致无法定位具体字段
      detail = data.detail
        .map((d: unknown) => {
          if (typeof d === 'string') return d
          const rec = (d ?? {}) as Record<string, unknown>
          const loc = Array.isArray(rec.loc)
            ? (rec.loc as unknown[]).filter((p) => p !== 'body').map(String).join('.')
            : ''
          const msg = typeof rec.msg === 'string' ? rec.msg : JSON.stringify(d)
          return loc ? `${loc}: ${msg}` : msg
        })
        .join('; ')
    } else if (typeof data?.detail === 'string') {
      detail = data.detail
    } else if (typeof data?.message === 'string') {
      detail = data.message
    }

    const errorCode = data?.error_code || ''

    // 标记错误已被全局拦截器处理过，页面组件可据此避免重复提示
    error._handled = true

    if (status === 401) {
      if (!isRedirecting && window.location.pathname !== '/login') {
        isRedirecting = true
        localStorage.removeItem('token')
        // SESSION_INVALID 表示会话被踢出或失效，与 token 过期区分提示
        const msg = errorCode === 'SESSION_INVALID'
          ? (detail || getMsg('common.msg.sessionKickedOut'))
          : (detail || getMsg('common.msg.sessionExpired'))
        message.warning(msg, 2)
        redirectTimeoutId = setTimeout(() => {
          // 再次确认仍在重定向状态且未在登录页，避免覆盖后续成功请求
          if (isRedirecting && window.location.pathname !== '/login') {
            window.location.href = '/login'
          }
          redirectTimeoutId = null
        }, 800)
      } else if (window.location.pathname === '/login') {
        message.error(detail || getMsg('common.msg.loginFailed'))
      }
    } else if (status === 403) {
      // 403 错误由业务组件自己处理，不在全局显示
      // 保留 detail 在 error 对象中供组件使用
      error._handled = false
    } else if (status === 404) {
      message.error(detail || getMsg('common.msg.resourceNotFound'))
    } else if (detail) {
      // 使用 error_code 进行前端翻译兜底（后端可能返回非当前语言的消息）
      const translated = errorCode ? getMsg(errorCode) : ''
      message.error(translated !== errorCode ? translated : detail)
    } else if (!error.response) {
      // 网络层错误（断网/超时/请求未到达服务器），无 HTTP 响应，避免静默失败
      const msg = error.code === 'ECONNABORTED'
        ? getMsg('common.msg.requestTimeout')
        : getMsg('common.msg.networkError')
      message.error(msg)
    } else {
      // 有 HTTP 状态但响应体无可读 detail（如网关返回的非 JSON 错误页 502/413）
      message.error(getMsg('common.msg.requestFailed'))
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
