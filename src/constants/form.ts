export const FORM_MAX_LENGTH = {
  INPUT: 100,
  TEXT_AREA: 500,
  DEEPLINK: 500,
  // 物理频道 DeeplinkChURL：后端 schema max_length=200，前后端保持一致
  DEEPLINK_CH_URL: 200,
} as const

// PostgreSQL Integer（4 字节有符号）最大值，用于数值字段范围校验，防止超出数据库列范围
export const INT32_MAX = 2147483647
