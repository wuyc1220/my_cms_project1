import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Spin } from 'antd'
import './index.css'
import App from './App.tsx'
import { getMultiLanguageOptions, getUiLanguage } from './api/i18n'
import { I18nProvider } from './i18n/useI18n'
import { useAuthStore } from './stores/authStore'
import type { LanguageOption, UiLanguage } from './types/i18n'

function BootstrapApp() {
  const [language, setLanguage] = useState<UiLanguage>('cn')
  const [options, setOptions] = useState<LanguageOption[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [languageResponse, optionResponse] = await Promise.all([
          getUiLanguage(),
          getMultiLanguageOptions(),
        ])
        const nextLanguage = languageResponse.language === 'en' ? 'en' : 'cn'
        setLanguage(nextLanguage)
        setOptions(optionResponse)
        // 有 token 时异步加载用户信息（含角色权限），不阻塞页面渲染
        if (localStorage.getItem('token')) {
          void useAuthStore.getState().loadCurrentUser()
        }
      } catch (err) {
        setLanguage('cn')
        setOptions([])
      } finally {
        setReady(true)
      }
    }

    void bootstrap()
  }, [])

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <I18nProvider language={language} options={options}>
      <App />
    </I18nProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BootstrapApp />
  </StrictMode>,
)
