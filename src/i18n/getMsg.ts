import { messages } from './messages'
import type { UiLanguage } from '../types/i18n'

const SUPPORTED: UiLanguage[] = ['cn', 'en']

/**
 * 读取当前 UI 语言（供 React 之外的模块使用，如 axios 拦截器）。
 * 语言由 main.tsx bootstrap 阶段同步写入 localStorage('ui_language')。
 * 缺失或非法时回退 'cn'。
 */
export function getUiLanguageSync(): UiLanguage {
  const lang = (typeof localStorage !== 'undefined'
    ? localStorage.getItem('ui_language')
    : null) as UiLanguage | null
  return lang && SUPPORTED.includes(lang) ? lang : 'cn'
}

/**
 * 独立的消息翻译函数，供 React 组件之外（axios 拦截器等）使用。
 * 从 localStorage 读取语言 + 直接查 messages 对象，无 React 依赖、无循环依赖。
 * key 不存在时返回 fallback（若提供）或 key 本身。
 */
export function getMsg(key: string, fallback?: string): string {
  const lang = getUiLanguageSync()
  const dict = messages[lang] as Record<string, string>
  return dict[key] ?? fallback ?? key
}
