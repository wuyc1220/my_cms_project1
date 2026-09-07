import dayjs from 'dayjs'
import { FORM_MAX_LENGTH } from '../constants/form'
import type { MessageKey } from '../i18n/messages'
import type { CustomFieldListItem } from '../types/basic'

export function getFieldOptionLabel(
  field: CustomFieldListItem,
  optionCode: string,
  preferredLanguage?: string,
  languageOrder?: string[],
): string {
  const option = field.options.find((item) => item.code === optionCode)
  if (!option) return optionCode
  const currentLabel = option.names[preferredLanguage ?? '']
  if (currentLabel) return currentLabel
  if (languageOrder) {
    for (const lang of languageOrder) {
      if (lang === preferredLanguage) continue
      const label = option.names[lang]
      if (label) return label
    }
  }
  return Object.values(option.names)[0] ?? option.code
}

export function getOptionLabel(
  names: Record<string, string>,
  preferredLanguage: string,
  languageOrder?: string[],
): string {
  const currentLabel = names[preferredLanguage]
  if (currentLabel) return currentLabel
  if (languageOrder) {
    for (const lang of languageOrder) {
      if (lang === preferredLanguage) continue
      const label = names[lang]
      if (label) return label
    }
  }
  return Object.values(names)[0] ?? ''
}

export const isMultiSelectField = (fieldType: string) =>
  fieldType === 'DropList_multiple' || fieldType === 'multi_select'

export const isSelectField = (fieldType: string) =>
  fieldType === 'DropList' || fieldType === 'DropList_multiple' || fieldType === 'multi_select'

export const isLongTextField = (fieldType: string) => fieldType === 'LongText'

export const isNumberField = (fieldType: string) =>
  fieldType === 'Integer' || fieldType === 'Decimal'

export const isDateField = (fieldType: string) => fieldType === 'Date'

export const isTimeField = (fieldType: string) => fieldType === 'Time'

export const isDateTimeField = (fieldType: string) => fieldType === 'Date+Time'

export function parseApiValue(fieldType: string, raw: unknown): unknown {
  if (raw == null || raw === '') return null

  if (isMultiSelectField(fieldType)) {
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') {
      if (raw.includes(',')) return raw.split(',').map(v => v.trim()).filter(Boolean)
      return [raw]
    }
    return null
  }

  if (isNumberField(fieldType)) {
    if (typeof raw === 'number') return raw
    if (typeof raw === 'string') {
      const n = Number(raw)
      return isNaN(n) ? null : n
    }
    return null
  }

  if (isDateField(fieldType) || isDateTimeField(fieldType)) {
    if (dayjs.isDayjs(raw)) return raw
    if (typeof raw === 'string') {
      const parsed = dayjs(raw)
      if (!parsed.isValid()) return null
      return parsed
    }
    return null
  }

  if (isTimeField(fieldType)) {
    if (dayjs.isDayjs(raw)) return raw
    if (typeof raw === 'string') {
      const parsed = dayjs(raw)
      if (parsed.isValid()) {
        return dayjs(parsed.format('HH:mm:ss'), 'HH:mm:ss')
      }
      const timeMatch = raw.match(/(\d{2}):(\d{2}):(\d{2})/)
      if (timeMatch) {
        return dayjs(`${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`, 'HH:mm:ss')
      }
    }
    return null
  }

  return raw
}

export function formatApiValue(fieldType: string, value: unknown): string {
  if (value == null) return ''

  if (isMultiSelectField(fieldType)) {
    return Array.isArray(value) ? value.join(',') : String(value)
  }

  if (isNumberField(fieldType)) {
    return value == null ? '' : String(value)
  }

  if (isDateField(fieldType)) {
    if (dayjs.isDayjs(value)) return value.format('YYYY-MM-DD')
    return String(value)
  }

  if (isTimeField(fieldType)) {
    if (dayjs.isDayjs(value)) return value.format('HH:mm:ss')
    return String(value)
  }

  if (isDateTimeField(fieldType)) {
    if (dayjs.isDayjs(value)) return value.format('YYYY-MM-DD HH:mm:ss')
    return String(value)
  }

  return String(value)
}

export const createIntegerRule = (errorMessage: string) => ({
  validator: (_: unknown, value: unknown) =>
    value == null || value === '' || Number.isInteger(value)
      ? Promise.resolve()
      : Promise.reject(new Error(errorMessage)),
})

export const getCustomFieldRules = (
  field: CustomFieldListItem,
  integerMessage: string,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
) => {
  const rules: Array<Record<string, unknown>> = []
  if (field.mandatory) {
    const isSelect = isSelectField(field.field_type) || isDateField(field.field_type) || isTimeField(field.field_type) || isDateTimeField(field.field_type)
    const message = isSelect
      ? t('customField.placeholder.selectField', { name: field.field_name })
      : t('customField.placeholder.enterField', { name: field.field_name })
    rules.push({ required: true, message })
  }
  if (field.field_type === 'Integer') {
    rules.push(createIntegerRule(integerMessage))
  }
  if (field.field_type === 'Text') {
    rules.push({
      validator: (_: unknown, value: unknown) => {
        if (value == null || value === '') return Promise.resolve()
        const length = typeof value === 'string' ? value.length : 0
        if (length > FORM_MAX_LENGTH.INPUT) {
          return Promise.reject(new Error(t('customField.validation.maxLength', { exceeded: length - FORM_MAX_LENGTH.INPUT, max: FORM_MAX_LENGTH.INPUT })))
        }
        return Promise.resolve()
      },
    })
  }
  if (field.field_type === 'LongText') {
    rules.push({
      validator: (_: unknown, value: unknown) => {
        if (value == null || value === '') return Promise.resolve()
        const length = typeof value === 'string' ? value.length : 0
        if (length > FORM_MAX_LENGTH.TEXT_AREA) {
          return Promise.reject(new Error(t('customField.validation.maxLength', { exceeded: length - FORM_MAX_LENGTH.TEXT_AREA, max: FORM_MAX_LENGTH.TEXT_AREA })))
        }
        return Promise.resolve()
      },
    })
  }
  return rules.length ? rules : undefined
}

export const validateInputLength = (
  value: unknown,
  max: number,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
): string | undefined => {
  if (value == null || value === '') return undefined
  const length = typeof value === 'string' ? value.length : 0
  if (length > max) {
    return t('common.validation.maxLength', { exceeded: length - max, max })
  }
  return undefined
}

export const getCustomFieldPlaceholder = (
  field: CustomFieldListItem,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
) => {
  if (field.tip) return field.tip
  const isSelect = isSelectField(field.field_type) || isDateField(field.field_type) || isTimeField(field.field_type) || isDateTimeField(field.field_type)
  return isSelect
    ? t('customField.placeholder.selectField', { name: field.field_name })
    : t('customField.placeholder.enterField', { name: field.field_name })
}

export const validateCustomFields = (
  customFieldItems: CustomFieldListItem[],
  fieldValues: Record<number, string>,
  i18nValues: Record<string, Record<string, string>>,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
  defaultLang: string,
): Record<number, Record<string, string>> => {
  const errors: Record<number, Record<string, string>> = {}
  for (const field of customFieldItems) {
    if (field.mandatory) {
      if (field.multi_language) {
        const val = i18nValues[defaultLang]?.[field.field_code]
        if (!(val ?? '').trim()) {
          if (!errors[field.id]) errors[field.id] = {}
          errors[field.id][defaultLang] = getCustomFieldPlaceholder(field, t)
        }
      } else {
        if (!(fieldValues[field.id] ?? '').trim()) {
          if (!errors[field.id]) errors[field.id] = {}
          errors[field.id]['_main'] = getCustomFieldPlaceholder(field, t)
        }
      }
    }
    if (field.field_type === 'Integer') {
      if (field.multi_language) {
        const val = i18nValues[defaultLang]?.[field.field_code]
        if (val != null && val !== '' && !Number.isInteger(Number(val))) {
          if (!errors[field.id]) errors[field.id] = {}
          errors[field.id][defaultLang] = t('customField.validation.integerOnly')
        }
      } else {
        const val = fieldValues[field.id]
        if (val != null && val !== '' && !Number.isInteger(Number(val))) {
          if (!errors[field.id]) errors[field.id] = {}
          errors[field.id]['_main'] = t('customField.validation.integerOnly')
        }
      }
    }
    if (field.field_type === 'Text') {
      const maxLen = FORM_MAX_LENGTH.INPUT
      if (field.multi_language) {
        const val = i18nValues[defaultLang]?.[field.field_code]
        if (val != null && val !== '' && val.length > maxLen) {
          if (!errors[field.id]) errors[field.id] = {}
          errors[field.id][defaultLang] = t('customField.validation.maxLength', { exceeded: val.length - maxLen, max: maxLen })
        }
      } else {
        const val = fieldValues[field.id]
        if (val != null && val !== '' && val.length > maxLen) {
          if (!errors[field.id]) errors[field.id] = {}
          errors[field.id]['_main'] = t('customField.validation.maxLength', { exceeded: val.length - maxLen, max: maxLen })
        }
      }
    }
    if (field.field_type === 'LongText') {
      const maxLen = FORM_MAX_LENGTH.TEXT_AREA
      if (field.multi_language) {
        const val = i18nValues[defaultLang]?.[field.field_code]
        if (val != null && val !== '' && val.length > maxLen) {
          if (!errors[field.id]) errors[field.id] = {}
          errors[field.id][defaultLang] = t('customField.validation.maxLength', { exceeded: val.length - maxLen, max: maxLen })
        }
      } else {
        const val = fieldValues[field.id]
        if (val != null && val !== '' && val.length > maxLen) {
          if (!errors[field.id]) errors[field.id] = {}
          errors[field.id]['_main'] = t('customField.validation.maxLength', { exceeded: val.length - maxLen, max: maxLen })
        }
      }
    }
  }
  return errors
}

export const clearFieldError = (
  prev: Record<number, Record<string, string>>,
  fieldId: number,
  langKey: string,
): Record<number, Record<string, string>> => {
  const fieldErrors = prev[fieldId] ? { ...prev[fieldId] } : {}
  delete fieldErrors[langKey]
  if (Object.keys(fieldErrors).length === 0) {
    const next = { ...prev }
    delete next[fieldId]
    return next
  }
  return { ...prev, [fieldId]: fieldErrors }
}
