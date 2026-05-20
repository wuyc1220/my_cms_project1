import type { UiLanguage } from '../types/i18n'

import { cnCommon, enCommon } from './modules/common'
import { cnLogin, enLogin } from './modules/login'
import { cnDashboard, enDashboard } from './modules/dashboard'
import { cnContent, enContent } from './modules/content'
import { cnTrade, enTrade } from './modules/trade'
import { cnLive, enLive } from './modules/live'
import { cnVod, enVod } from './modules/vod'
import { cnBasic, enBasic } from './modules/basic'
import { cnBusiness, enBusiness } from './modules/business'
import { cnSystem, enSystem } from './modules/system'
import { cnOps, enOps } from './modules/ops'
import { cnMetadataEnhance, enMetadataEnhance } from './modules/metadataEnhance'

export const messages = {
  cn: {
    ...cnCommon,
    ...cnLogin,
    ...cnDashboard,
    ...cnContent,
    ...cnTrade,
    ...cnLive,
    ...cnVod,
    ...cnBasic,
    ...cnBusiness,
    ...cnSystem,
    ...cnOps,
    ...cnMetadataEnhance,
  },
  en: {
    ...enCommon,
    ...enLogin,
    ...enDashboard,
    ...enContent,
    ...enTrade,
    ...enLive,
    ...enVod,
    ...enBasic,
    ...enBusiness,
    ...enSystem,
    ...enOps,
    ...enMetadataEnhance,
  },
} as const satisfies Record<UiLanguage, Record<string, string>>

export type MessageKey = keyof typeof messages.cn
