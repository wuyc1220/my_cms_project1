import { createContext, useContext, useCallback, useMemo } from 'react'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import type { ReactNode } from 'react'
import { messages, type MessageKey } from './messages'
import type { LanguageOption, UiLanguage } from '../types/i18n'

interface I18nContextValue {
  language: UiLanguage
  options: LanguageOption[]
}

const I18nContext = createContext<I18nContextValue>({
  language: 'cn',
  options: [],
})

export function I18nProvider({
  language,
  options,
  children,
}: {
  language: UiLanguage
  options: LanguageOption[]
  children: ReactNode
}) {
  return <I18nContext.Provider value={{ language, options }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const { language, options } = useContext(I18nContext)

  const t = useCallback((key: MessageKey, vars?: Record<string, string | number>): string => {
    let text: string = (messages[language] as Record<string, string>)[key] ?? key
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      })
    }
    return text
  }, [language])

  const antLocale = useMemo(() => language === 'en' ? enUS : zhCN, [language])

  return {
    language,
    options,
    t,
    antLocale,
  }
}
