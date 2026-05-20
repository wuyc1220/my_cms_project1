export type UiLanguage = 'cn' | 'en'

export interface LanguageConfigResponse {
  language: UiLanguage
}

export interface LanguageOption {
  code: string
  name: string
}
