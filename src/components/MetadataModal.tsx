import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AutoComplete, Button, Col, DatePicker, Form, InputNumber, Modal, Row, Select, Space, Spin, Switch, Tabs, message,
} from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getProgramMetadata, createProgramMetadata, updateProgramMetadata,
  getSeriesMetadata, createSeriesMetadata, updateSeriesMetadata,
  getChannelMetadata, createChannelMetadata, updateChannelMetadata,
  getScheduleMetadata, createScheduleMetadata, updateScheduleMetadata,
} from '../api/metadata'
import { getDictTree } from '../api/dicts'
import { getGenres } from '../api/genres'
import { getTags } from '../api/tags'
import { getCustomTags } from '../api/customTags'
import { getContentTypes } from '../api/contentTypes'
import { getCustomFields } from '../api/customFields'
import { getContents, getContent, updateContent, getContentI18n, saveContentI18n, getContentFieldValues, saveContentFieldValues } from '../api/contents'
import { getMultiLanguageOptions } from '../api/i18n'
import { getPackages } from '../api/packages'
import { useI18n } from '../i18n/useI18n'
import TrimInput from './TrimInput'
import { FORM_MAX_LENGTH } from '../constants/form'
import { useFormRules } from '../hooks/useFormRules'
import type { EntityI18nItem, EntityFieldValueItem } from '../types/basic'
import type {
  ContentMetadataItem, ContentMetadataCreate, ContentMetadataUpdate,
  SeriesMetadataItem, SeriesMetadataCreate, SeriesMetadataUpdate,
  ChannelMetadataItem, ChannelMetadataCreate, ChannelMetadataUpdate,
  ScheduleMetadataItem, ScheduleMetadataCreate, ScheduleMetadataUpdate,
} from '../types/metadata'
import type { GenreListItem, TagListItem, CustomTagListItem, ContentTypeListItem, CustomFieldListItem } from '../types/basic'
import type { LanguageOption } from '../types/i18n'
import type { DictNodeListItem } from '../types/dict'
import type { PackageListItem } from '../types/package'
import { isHandledError } from '../api'


/* ═══════════════════════════════════════════════════════════ */
/*  Props & Types                                              */
/* ═══════════════════════════════════════════════════════════ */

interface MetadataModalProps {
  open: boolean
  contentId: number
  contentType: string
  contentName: string
  onClose: () => void
  onSuccess?: () => void
  readOnly?: boolean
  /** 初始开始时间（用于 Schedule 类型，从节目单详情传入） */
  initialBeginTime?: string
  /** 初始结束时间（用于 Schedule 类型，从节目单详情传入） */
  initialEndTime?: string
  /** 来源节目单ID（用于归档后的 MOVIE/EPISODE，从节目单继承元数据） */
  sourceScheduleId?: number
}

type MetadataKind = 'program' | 'series' | 'channel' | 'schedule'

type MetadataState =
  | { kind: 'program'; data: ContentMetadataItem | null }
  | { kind: 'series'; data: SeriesMetadataItem | null }
  | { kind: 'channel'; data: ChannelMetadataItem | null }
  | { kind: 'schedule'; data: ScheduleMetadataItem | null }

/* 数据字典子项扁平化类型 */
interface DictOption {
  value: string
  label: string
}

/* ═══════════════════════════════════════════════════════════ */
/*  主组件                                                     */
/* ═══════════════════════════════════════════════════════════ */

export default function MetadataModal({
  open, contentId, contentType, contentName, onClose, onSuccess, readOnly = false,
  initialBeginTime, initialEndTime, sourceScheduleId,
}: MetadataModalProps) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [metadata, setMetadata] = useState<MetadataState | null>(null)
  const [form] = Form.useForm()
  const [updateChildsMain, setUpdateChildsMain] = useState(false)
  const [updateChildsCustomFields, setUpdateChildsCustomFields] = useState(false)
  const [updateChildsI18n, setUpdateChildsI18n] = useState(false)

  // ── 数据源 ────────────────────────────────────────────────
  const [genres, setGenres] = useState<GenreListItem[]>([])
  const [tags, setTags] = useState<TagListItem[]>([])
  const [customTags, setCustomTags] = useState<CustomTagListItem[]>([])
  const [contentTypes, setContentTypes] = useState<ContentTypeListItem[]>([])
  const [dictOptions, setDictOptions] = useState<Record<string, DictOption[]>>({})
  const [customFields, setCustomFields] = useState<CustomFieldListItem[]>([])
  const [packages, setPackages] = useState<PackageListItem[]>([])
  const [defaultLanguage, setDefaultLanguage] = useState<string>('')
  const [currentLanguage, setCurrentLanguage] = useState<string>('')

  const kind = useMemo<MetadataKind>(() => {
    if (contentType === 'MOVIE' || contentType === 'EPISODE') return 'program'
    if (contentType === 'SERIES' || contentType === 'SEASON') return 'series'
    if (contentType === 'CHANNEL') return 'channel'
    return 'schedule'
  }, [contentType])

  // ── 加载数据源 ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const loadData = async () => {
      // 先获取默认主语言、字典树和自定义字段
      const [langs, dictTree, cfRes] = await Promise.all([
        getMultiLanguageOptions().catch(() => [] as LanguageOption[]),
        getDictTree().catch(() => [] as DictNodeListItem[]),
        // Custom Fields 按 belonging 过滤
        getCustomFields({
          page: 1, page_size: 500,
          belongings: kind === 'program' ? ['ALL', 'Program']
            : kind === 'series' ? ['ALL', 'Series']
              : kind === 'channel' ? ['ALL', 'Channel']
                : ['ALL', 'Schedule'],
        }).catch(() => ({ items: [], total: 0 })),
      ])

      const defaultLang = langs[0]?.code ?? ''
      setDefaultLanguage(defaultLang)
      setCurrentLanguage(defaultLang)
      setCustomFields(cfRes.items ?? [])

      // 解析字典树为扁平选项
      const opts: Record<string, DictOption[]> = {}
      const flattenDict = (nodes: DictNodeListItem[]) => {
        for (const node of nodes) {
          if (node.children?.length) {
            opts[node.code] = node.children.map(c => ({ value: c.code, label: c.name }))
            flattenDict(node.children)
          }
        }
      }
      flattenDict(dictTree)
      setDictOptions(opts)
      console.log('[MetadataModal] dictTree:', dictTree)
      console.log('[MetadataModal] SeriesType opts:', opts['SeriesType'])

      // 再获取基础数据
      // 注意：genres / tags 需要保留全量供 MultiLanguagesTab 按不同语言过滤
      const [genresRes, tagsRes, customTagsRes, ctRes, pkgRes] = await Promise.all([
        getGenres({ page: 1, page_size: 500 }).catch(() => ({ items: [], total: 0 })),
        getTags({ page: 1, page_size: 500 }).catch(() => ({ items: [], total: 0 })),
        getCustomTags({ page: 1, page_size: 500 }).catch(() => ({ items: [], total: 0 })),
        getContentTypes({ page: 1, page_size: 500 }).catch(() => ({ items: [], total: 0 })),
        getPackages({ page: 1, page_size: 500 }).catch(() => ({ items: [], total: 0 })),
      ])

      setGenres(genresRes.items ?? [])
      setTags(tagsRes.items ?? [])
      setCustomTags(customTagsRes.items ?? [])
      setContentTypes(ctRes.items ?? [])
      setPackages(pkgRes.items ?? [])
    }

    void loadData()
  }, [open, kind])

  // ── 加载元数据 ─────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!contentId) return
    setLoading(true)
    try {
      let state: MetadataState
      switch (kind) {
        case 'program':
          state = { kind, data: await getProgramMetadata(contentId) }
          break
        case 'series':
          state = { kind, data: await getSeriesMetadata(contentId) }
          break
        case 'channel':
          state = { kind, data: await getChannelMetadata(contentId) }
          break
        case 'schedule':
          state = { kind, data: await getScheduleMetadata(contentId) }
          break
      }
      
      // ✅ 获取主表数据（包含 custom_tag_ids 和 genre_id）
      const contentDetail = await getContent(contentId).catch(() => null)
      
      setMetadata(state)

      // 并行加载 i18n 和自定义字段值
      const [i18nItems, fieldValueItems] = await Promise.all([
        getContentI18n(contentId).catch(() => [] as EntityI18nItem[]),
        getContentFieldValues(contentId).catch(() => [] as EntityFieldValueItem[]),
      ])

      // 构建 custom_field_values（按 field_code 索引）
      const customFieldValues: Record<string, unknown> = {}
      for (const fv of fieldValueItems) {
        const field = customFields.find(f => f.id === fv.custom_field_id)
        if (field && !field.multi_language) {
          let val: unknown = fv.value
          if (field.field_type === 'multi_select' || field.field_type === 'DropList_multiple') {
            if (typeof val === 'string' && val.includes(',')) {
              val = val.split(',').map(v => v.trim()).filter(Boolean)
            } else if (typeof val === 'string' && val) {
              val = [val]
            }
          } else if (field.field_type === 'Integer' || field.field_type === 'Decimal') {
            if (typeof val === 'string' && val) {
              const n = Number(val)
              if (!isNaN(n)) val = n
            }
          }
          customFieldValues[field.field_code] = val
        }
      }

      // 构建 i18n values
      const i18nValues: Record<string, Record<string, unknown>> = {}
      for (const item of i18nItems) {
        if (!i18nValues[item.language]) i18nValues[item.language] = {}
        let val: unknown = item.value
        if (item.field_name === 'genre_ids' || item.field_name === 'tag_ids') {
          if (typeof val === 'string' && val.includes(',')) {
            val = val.split(',').map(v => Number(v.trim())).filter(v => !isNaN(v))
          } else if (typeof val === 'string' && val) {
            const n = Number(val)
            if (!isNaN(n)) val = [n]
          }
        } else if (item.field_name.startsWith('cf_')) {
          const fieldCode = item.field_name.slice(3)
          const field = customFields.find(f => f.field_code === fieldCode && f.multi_language)
          if (field) {
            if (field.field_type === 'DropList_multiple' || field.field_type === 'multi_select') {
              if (typeof val === 'string' && val.includes(',')) {
                val = val.split(',').map(v => v.trim()).filter(Boolean)
              } else if (typeof val === 'string' && val) {
                val = [val]
              }
            } else if (field.field_type === 'Integer' || field.field_type === 'Decimal') {
              if (typeof val === 'string' && val) {
                const n = Number(val)
                if (!isNaN(n)) val = n
              }
            }
          }
        }
        i18nValues[item.language][item.field_name] = val
      }

      if (state.data) {
        const values = { ...state.data } as Record<string, unknown>
        
        // ✅ 从主表获取 genre_id、custom_tag_ids、begin_time、end_time
        const contentGenreId = contentDetail?.content?.genre_id
        const contentCustomTagIds = contentDetail?.content?.custom_tag_ids
        const contentBeginTime = contentDetail?.content?.begin_time
        const contentEndTime = contentDetail?.content?.end_time
        
        if (contentGenreId !== undefined) {
          values.genre_id = contentGenreId
        }
        if (contentCustomTagIds !== undefined) {
          values.custom_tag_ids = contentCustomTagIds
        }
        // ✅ 将 release_year 从数字转换为 dayjs 对象
        if (values.release_year && typeof values.release_year === 'number') {
          values.release_year = dayjs(String(values.release_year), 'YYYY')
        }
        // ✅ begin_time / end_time 从主表获取（Schedule 类型）
        if (kind === 'schedule') {
          if (contentBeginTime) {
            values.begin_time = dayjs(contentBeginTime)
          } else {
            delete values.begin_time
          }
          if (contentEndTime) {
            values.end_time = dayjs(contentEndTime)
          } else {
            delete values.end_time
          }
        }
        
        values.i18n = i18nValues
        values.custom_field_values = customFieldValues
        form.setFieldsValue(values)
      } else {
        // 新建：name 默认同 contentName，如果有初始时间则使用
        form.resetFields()
        
        // ✅ 从主表获取 genre_id、custom_tag_ids、begin_time、end_time
        const contentGenreId = contentDetail?.content?.genre_id
        const contentCustomTagIds = contentDetail?.content?.custom_tag_ids
        const contentBeginTime = contentDetail?.content?.begin_time
        const contentEndTime = contentDetail?.content?.end_time
        
        const initialValues: Record<string, unknown> = {
          name: contentName,
          i18n: i18nValues,
          custom_field_values: customFieldValues,
        }
        
        // ✅ 如果主表有值，使用主表的值
        if (contentGenreId !== undefined) {
          initialValues.genre_id = contentGenreId
        }
        if (contentCustomTagIds?.length) {
          initialValues.custom_tag_ids = contentCustomTagIds
        }
        
        // ✅ Schedule 类型：begin_time / end_time 从主表获取
        if (kind === 'schedule') {
          if (contentBeginTime) {
            initialValues.begin_time = dayjs(contentBeginTime)
          } else if (initialBeginTime) {
            initialValues.begin_time = dayjs(initialBeginTime)
          }
          if (contentEndTime) {
            initialValues.end_time = dayjs(contentEndTime)
          } else if (initialEndTime) {
            initialValues.end_time = dayjs(initialEndTime)
          }
        }

        // 如果是归档产物（MOVIE/EPISODE）且有来源节目单ID，从Schedule获取元数据作为初始值
        if (kind === 'program' && sourceScheduleId) {
          try {
            const scheduleMeta = await getScheduleMetadata(sourceScheduleId)
            if (scheduleMeta) {
              const scheduleValues: Record<string, unknown> = { ...scheduleMeta }
              // 删除Schedule专属字段和审计字段，保留与Program共有的通用字段
              delete scheduleValues.id
              delete scheduleValues.content_id
              delete scheduleValues.is_deleted
              delete scheduleValues.is_discarded
              delete scheduleValues.created_at
              delete scheduleValues.updated_at
              delete scheduleValues.created_by
              delete scheduleValues.updated_by
              delete scheduleValues.cutv_enable
              delete scheduleValues.program_id
              delete scheduleValues.broadcast_type
              delete scheduleValues.tstv_enable
              delete scheduleValues.tstv_mode
              delete scheduleValues.npvr_enable
              delete scheduleValues.ppv_enable
              delete scheduleValues.package_ids
              delete scheduleValues.pre_buffer
              delete scheduleValues.post_buffer
              delete scheduleValues.purchase_begin_time
              delete scheduleValues.purchase_end_time
              delete scheduleValues.series_type
              delete scheduleValues.series_id
              delete scheduleValues.series_name
              delete scheduleValues.sequence
              delete scheduleValues.show_id
              delete scheduleValues.show_name
              // begin_time / end_time 已从 schedule_metadata 移除，不再从此继承

              // 合并初始值（优先使用传入的初始时间）
              Object.assign(initialValues, scheduleValues)
              if (initialBeginTime) {
                initialValues.begin_time = dayjs(initialBeginTime)
              }
              if (initialEndTime) {
                initialValues.end_time = dayjs(initialEndTime)
              }
            }
          } catch {
            // 获取Schedule元数据失败时忽略，使用默认初始值
          }
        }

        form.setFieldsValue(initialValues)
      }
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('content.metadata.loadFailed'), 5)
    } finally {
      setLoading(false)
    }
  }, [contentId, kind, form, contentName, customFields, initialBeginTime, initialEndTime, sourceScheduleId])

  useEffect(() => {
    if (open && contentId) void load()
  }, [open, contentId, load])

  // ── Main tab 字段同步到 Multi Languages 默认语言 ──────────
  const watchedName = Form.useWatch('name', form)
  const watchedGenreId = Form.useWatch('genre_id', form)
  const watchedTagIds = Form.useWatch('tag_ids', form)
  const watchedDescription = Form.useWatch('description', form)
  const watchedSortName = Form.useWatch('sort_name', form)
  const watchedShortTitle = Form.useWatch('short_title', form)
  const watchedOriginalName = Form.useWatch('original_name', form)

  useEffect(() => {
    if (!defaultLanguage || loading) return
    const currentI18n = form.getFieldValue('i18n') as Record<string, Record<string, unknown>> | undefined
    if (!currentI18n) return
    const defaultLangI18n = { ...(currentI18n[defaultLanguage] ?? {}) }
    let changed = false

    if (watchedName !== undefined && watchedName !== null) {
      defaultLangI18n['name'] = watchedName
      changed = true
    }
    if (watchedGenreId !== undefined && watchedGenreId !== null) {
      defaultLangI18n['genre_ids'] = Array.isArray(watchedGenreId) ? watchedGenreId : [watchedGenreId]
      changed = true
    }
    if (watchedTagIds !== undefined && watchedTagIds !== null) {
      defaultLangI18n['tag_ids'] = watchedTagIds
      changed = true
    }
    if (watchedDescription !== undefined && watchedDescription !== null) {
      defaultLangI18n['description'] = watchedDescription
      changed = true
    }
    if (watchedSortName !== undefined && watchedSortName !== null) {
      defaultLangI18n['sort_name'] = watchedSortName
      changed = true
    }
    if (watchedShortTitle !== undefined && watchedShortTitle !== null) {
      defaultLangI18n['short_title'] = watchedShortTitle
      changed = true
    }
    if (watchedOriginalName !== undefined && watchedOriginalName !== null) {
      defaultLangI18n['original_name'] = watchedOriginalName
      changed = true
    }

    if (changed) {
      form.setFieldsValue({ i18n: { ...currentI18n, [defaultLanguage]: defaultLangI18n } })
    }
  }, [watchedName, watchedGenreId, watchedTagIds, watchedDescription, watchedSortName, watchedShortTitle, watchedOriginalName, defaultLanguage, loading, form])

  // ── 保存 ───────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('main')

  useEffect(() => {
    if (!open) setActiveTab('main')
  }, [open])

  const getFieldTab = (namePath: (string | number)[]): string => {
    if (namePath[0] === 'custom_field_values') return 'customFields'
    if (namePath[0] === 'i18n') {
      const fieldName = namePath[2]?.toString() ?? ''
      if (fieldName.startsWith('cf_')) return 'customFields'
      if (namePath[1] === defaultLanguage) return 'main'
      return 'multiLanguages'
    }
    return 'main'
  }

  const handleSave = async () => {
    if (readOnly) return

    const validateCurrentTab = async (): Promise<boolean> => {
      try {
        await form.validateFields()
        return true
      } catch (error) {
        const errorFields = (error as { errorFields?: Array<{ name: (string | number)[] }> })?.errorFields
        if (!errorFields || errorFields.length === 0) return true
        const hasCurrentTabError = errorFields.some(ef => getFieldTab(ef.name) === activeTab)
        if (hasCurrentTabError) {
          message.warning(t('content.metadata.requiredCheck'), 3)
          return false
        }
        return true
      }
    }

    const validateOtherTabs = async (): Promise<string | null> => {
      try {
        await form.validateFields()
        return null
      } catch (error) {
        const errorFields = (error as { errorFields?: Array<{ name: (string | number)[] }> })?.errorFields
        if (!errorFields || errorFields.length === 0) return null
        const otherError = errorFields.find(ef => getFieldTab(ef.name) !== activeTab)
        if (otherError) {
          const targetTab = getFieldTab(otherError.name)
          setActiveTab(targetTab)
          message.warning(t('content.metadata.requiredCheck'), 3)
          return targetTab
        }
        return null
      }
    }

    const currentOk = await validateCurrentTab()
    if (!currentOk) return

    const otherTabError = await validateOtherTabs()
    if (otherTabError) return

    let values: Record<string, unknown> | null = null
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    if (!values || !metadata) return

    setSaving(true)
    try {
      // Series: 附加 update_childs 控制开关
      if (kind === 'series') {
        values.update_childs_main = updateChildsMain
        values.update_childs_custom_fields = updateChildsCustomFields
        values.update_childs_i18n = updateChildsI18n
        console.log('[MetadataModal] updateChilds controls:', {
          main: updateChildsMain,
          customFields: updateChildsCustomFields,
          i18n: updateChildsI18n,
        })
      }

      // 清理 keywords 字段，过滤掉 null 值
      if (values.keywords && Array.isArray(values.keywords)) {
        values.keywords = values.keywords.filter(k => k !== null && k !== undefined && k !== '')
      }
      
      // ✅ 将 release_year 从 dayjs 对象转换为年份数字
      if (values.release_year && dayjs.isDayjs(values.release_year)) {
        values.release_year = values.release_year.year()
      }

      // 分离 i18n 数据
      const i18nData = values.i18n as Record<string, Record<string, unknown>> | undefined
      delete values.i18n

      // 分离 custom_field_values 数据
      const customFieldValues = values.custom_field_values as Record<string, unknown> | undefined
      delete values.custom_field_values
      
      // ✅ 分离 custom_tag_ids、genre_id、begin_time、end_time
      // 注意：genre_id 需要传给后端用于校验，但不保存到元数据表
      const { custom_tag_ids, begin_time, end_time, ...metadataValues } = values
      
      // 调试日志
      if (kind === 'series') {
        console.log('[MetadataModal] metadataValues to be sent:', metadataValues)
        console.log('[MetadataModal] metadataValues.update_childs:', metadataValues.update_childs)
      }

      // ✅ 先保存自定义字段和i18n，再保存元数据（触发sync时需要最新的DB数据）
      // 更新主表的 genre_id、custom_tag_ids、begin_time、end_time
      const contentUpdate: Record<string, unknown> = {
        genre_id: (values as Record<string, unknown>).genre_id as number | undefined,
        custom_tag_ids: (custom_tag_ids as number[] | undefined)?.length ? custom_tag_ids as number[] : undefined,
      }
      // ✅ Schedule 类型：begin_time / end_time 写入主表
      if (kind === 'schedule') {
        contentUpdate.begin_time = begin_time && dayjs.isDayjs(begin_time) ? begin_time.toISOString() : undefined
        contentUpdate.end_time = end_time && dayjs.isDayjs(end_time) ? end_time.toISOString() : undefined
      }
      await updateContent(contentId, contentUpdate)

      // 保存 i18n 数据（按语言分别保存，默认语言只保存 cf_ 自定义字段，其余已在主表保存）
      if (i18nData && contentId) {
        for (const [lang, fields] of Object.entries(i18nData)) {
          const payloadFields: Record<string, string | null> = {}
          for (const [fieldName, fieldValue] of Object.entries(fields)) {
            if (lang === defaultLanguage && !fieldName.startsWith('cf_')) continue
            if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
              payloadFields[fieldName] = null
            } else if (Array.isArray(fieldValue)) {
              payloadFields[fieldName] = fieldValue.join(',')
            } else {
              payloadFields[fieldName] = String(fieldValue)
            }
          }
          if (Object.keys(payloadFields).length > 0) {
            await saveContentI18n(contentId, { language: lang, fields: payloadFields })
          }
        }
      }

      // 保存自定义字段值
      if (customFieldValues && contentId && customFields.length > 0) {
        const payloadValues = Object.entries(customFieldValues)
          .map(([fieldCode, value]) => {
            const field = customFields.find(f => f.field_code === fieldCode)
            if (!field) return null
            let strValue: string | null = null
            if (value !== undefined && value !== null && value !== '') {
              strValue = Array.isArray(value) ? value.join(',') : String(value)
            }
            return { custom_field_id: field.id, value: strValue }
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
        await saveContentFieldValues(contentId, { values: payloadValues })
      }

      // 最后保存元数据（触发sync时能从DB读到最新的自定义字段和i18n值）
      if (metadata.data) {
        switch (kind) {
          case 'program':
            await updateProgramMetadata(contentId, metadataValues as ContentMetadataUpdate)
            break
          case 'series':
            await updateSeriesMetadata(contentId, metadataValues as SeriesMetadataUpdate)
            break
          case 'channel':
            await updateChannelMetadata(contentId, metadataValues as ChannelMetadataUpdate)
            break
          case 'schedule':
            await updateScheduleMetadata(contentId, metadataValues as ScheduleMetadataUpdate)
            break
        }
      } else {
        const createData = { ...metadataValues, content_id: contentId }
        switch (kind) {
          case 'program':
            await createProgramMetadata(contentId, createData as ContentMetadataCreate)
            break
          case 'series':
            // 先创建元数据
            await createSeriesMetadata(contentId, createData as SeriesMetadataCreate)
            // 如果开启了 Update Childs，立即触发更新以同步到子级
            if (updateChildsMain || updateChildsCustomFields || updateChildsI18n) {
              await updateSeriesMetadata(contentId, metadataValues as SeriesMetadataUpdate)
            }
            break
          case 'channel':
            await createChannelMetadata(contentId, createData as ChannelMetadataCreate)
            break
          case 'schedule':
            await createScheduleMetadata(contentId, createData as ScheduleMetadataCreate)
            break
        }
      }

      message.success(t('content.metadata.save'), 3)
      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      message.error(detail ?? '保存失败', 5)
    } finally {
      setSaving(false)
    }
  }

  // ── 标题 ───────────────────────────────────────────────────
  const titleMap: Record<string, string> = {
    program: t('content.metadata.title.program'),
    series: t('content.metadata.title.series'),
    channel: t('content.metadata.title.channel'),
    schedule: t('content.metadata.title.schedule'),
  }

  // ── 字典选项辅助 ──────────────────────────────────────────
  const dictOpts = (code: string): DictOption[] => dictOptions[code] ?? []
  const genreOpts = genres.filter(g => !defaultLanguage || g.language === defaultLanguage).map(g => ({ value: g.id, label: g.name }))
  const tagOpts = tags.filter(tg => !defaultLanguage || tg.language === defaultLanguage).map(tg => ({ value: tg.id, label: tg.name }))
  const customTagOpts = customTags.map(ct => ({ value: ct.id, label: ct.name }))
  const typeOpts = contentTypes.map(ct => ({ value: ct.id, label: ct.name }))
  const packageOpts = packages.map(p => ({ value: p.id, label: p.name }))

  // ── 渲染 ───────────────────────────────────────────────────
  return (
    <Modal
      title={titleMap[kind] ?? 'Metadata'}
      open={open}
      onCancel={onClose}
      width={1100}
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div></div>
          <Space>
            <Button onClick={onClose}>{t('content.metadata.cancel')}</Button>
            {!readOnly && (
              <Button type="primary" loading={saving} onClick={() => void handleSave()}>
                {t('content.metadata.save')}
              </Button>
            )}
          </Space>
        </div>
      }
    >
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" disabled={readOnly}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key)
            if (key === 'multiLanguages' && currentLanguage === defaultLanguage) {
              const otherLangs = (dictOptions['Multi_Languages'] ?? []).filter(l => l.value !== defaultLanguage)
              if (otherLangs.length > 0) {
                setCurrentLanguage(otherLangs[0].value)
              }
            }
          }}
          items={[
            {
              key: 'main',
              label: t('content.metadata.tab.main'),
              forceRender: true,
              children: (
                <>
                  {kind === 'program' && <ProgramMainForm contentName={contentName} contentType={contentType} genreOpts={genreOpts} tagOpts={tagOpts} customTagOpts={customTagOpts} typeOpts={typeOpts} dictOpts={dictOpts} />}
                  {kind === 'series' && (
                    <>
                      <SeriesMainForm contentName={contentName} contentType={contentType} genreOpts={genreOpts} tagOpts={tagOpts} customTagOpts={customTagOpts} typeOpts={typeOpts} dictOpts={dictOpts} />
                      {!readOnly && (
                        <div style={{ marginTop: 16 }}>
                          <Space>
                            <span>{t('content.metadata.updateChilds')} (Main)</span>
                            <Switch checked={updateChildsMain} onChange={setUpdateChildsMain} />
                          </Space>
                        </div>
                      )}
                    </>
                  )}
                  {kind === 'channel' && <ChannelMainForm contentName={contentName} contentType={contentType} genreOpts={genreOpts} customTagOpts={customTagOpts} dictOpts={dictOpts} />}
                  {kind === 'schedule' && <ScheduleMainForm contentName={contentName} contentType={contentType} genreOpts={genreOpts} tagOpts={tagOpts} customTagOpts={customTagOpts} typeOpts={typeOpts} dictOpts={dictOpts} packageOpts={packageOpts} />}
                </>
              ),
            },
            {
              key: 'customFields',
              label: t('content.metadata.tab.customFields'),
              forceRender: true,
              children: (
                <>
                  <CustomFieldsTab customFields={customFields} defaultLanguage={defaultLanguage} readOnly={readOnly} />
                  {kind === 'series' && !readOnly && (
                    <div style={{ marginTop: 16 }}>
                      <Space>
                        <span>{t('content.metadata.updateChilds')} (Custom Fields)</span>
                        <Switch checked={updateChildsCustomFields} onChange={setUpdateChildsCustomFields} />
                      </Space>
                    </div>
                  )}
                </>
              ),
            },
            {
              key: 'multiLanguages',
              label: t('content.metadata.tab.multiLanguages'),
              forceRender: true,
              children: (
                <>
                  <MultiLanguagesTab kind={kind} customFields={customFields} genres={genres} tags={tags} dictOpts={dictOpts} currentLanguage={currentLanguage} onLanguageChange={setCurrentLanguage} readOnly={readOnly} defaultLanguage={defaultLanguage} />
                  {kind === 'series' && !readOnly && (
                    <div style={{ marginTop: 16 }}>
                      <Space>
                        <span>{t('content.metadata.updateChilds')} (Multi Languages)</span>
                        <Switch checked={updateChildsI18n} onChange={setUpdateChildsI18n} />
                      </Space>
                    </div>
                  )}
                </>
              ),
            },
          ]}
        />
        </Form>
      </Spin>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════════════════ */
/*  共用只读字段组件                                            */
/* ═══════════════════════════════════════════════════════════ */

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <Form.Item label={label}>
      <TrimInput value={value} disabled style={{ background: '#f5f5f5' }} />
    </Form.Item>
  )
}

/* ═══════════════════════════════════════════════════════════ */
/*  Program Main 标签页 (MOVIE / EPISODE)                      */
/* ═══════════════════════════════════════════════════════════ */

interface MainFormProps {
  contentName: string
  contentType: string
  genreOpts: { value: number; label: string }[]
  tagOpts: { value: number; label: string }[]
  customTagOpts: { value: number; label: string }[]
  typeOpts: { value: number; label: string }[]
  dictOpts: (code: string) => DictOption[]
  packageOpts?: { value: number; label: string }[]
}

function ProgramMainForm({ contentName, contentType, genreOpts, tagOpts, customTagOpts, typeOpts, dictOpts }: MainFormProps) {
  const { t } = useI18n()
  return (
    <Row gutter={16}>
      {/* 第 1 列 */}
      <Col span={8}>
        <Form.Item name="name" label={t('content.metadata.name')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <TrimInput />
        </Form.Item>
      </Col>
      <Col span={8}>
        <ReadOnlyField label={t('content.metadata.contentName')} value={contentName} />
      </Col>
      <Col span={8}>
        <ReadOnlyField label={t('content.metadata.contentType')} value={contentType} />
      </Col>

      <Col span={8}>
        <Form.Item name="type_id" label={t('content.metadata.type')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={typeOpts} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="vod_type" label={t('content.metadata.vodType')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={dictOpts('VodType')} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="status_flag" label={t('content.metadata.status')} valuePropName="checked" initialValue={true}>
          <Switch checkedChildren={t('content.metadata.yes')} unCheckedChildren={t('content.metadata.no')} />
        </Form.Item>
      </Col>

      <Col span={8}>
        <Form.Item name="original_name" label={t('content.metadata.originalName')}>
          <TrimInput />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="original_country" label={t('content.metadata.originalCountry')}>
          <TrimInput />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="language" label={t('content.metadata.language')}>
          <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={dictOpts('Language')} />
        </Form.Item>
      </Col>

      <Col span={8}>
        <Form.Item name="genre_id" label={t('content.metadata.genre')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <Select allowClear placeholder="Please select" showSearch optionFilterProp="label" options={genreOpts} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="sort_name" label={t('content.metadata.sortName')}>
          <TrimInput />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="short_title" label={t('content.metadata.shortTitle')}>
          <TrimInput />
        </Form.Item>
      </Col>

      <Col span={8}>
        <Form.Item name="release_year" label={t('content.metadata.releaseYear')}>
          <DatePicker picker="year" style={{ width: '100%' }} placeholder="请选择年份" />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="custom_tag_ids" label={t('content.metadata.customTags')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={customTagOpts} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="tag_ids" label={t('content.metadata.tags')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={tagOpts} fieldNames={{ value: 'value' }} />
        </Form.Item>
      </Col>

      <Col span={8}>
        <Form.Item name="rating_level" label={t('content.metadata.ratingLevel')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={dictOpts('RatingLevel')} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="advice" label={t('content.metadata.advice')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={dictOpts('Advice')} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="rating" label={t('content.metadata.rating')}>
          <TrimInput />
        </Form.Item>
      </Col>

      <Col span={8}>
        <Form.Item name="audio_lang" label={t('content.metadata.audioLang')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={dictOpts('Language')} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="subtitle_lang" label={t('content.metadata.subtitleLang')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={dictOpts('Language')} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="studio" label={t('content.metadata.studio')}>
          <TrimInput />
        </Form.Item>
      </Col>

      <Col span={8}>
        <Form.Item name="cdr_id" label={t('content.metadata.cdrId')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <TrimInput />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="begin_duration" label={t('content.metadata.beginDuration')}>
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="end_duration" label={t('content.metadata.endDuration')}>
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>
      </Col>

      {/* Keywords: 双下拉 */}
      <Col span={8}>
        <Form.Item label={t('content.metadata.keywords')}>
          <TrimInput.Group compact>
            <Form.Item name={['keywords', 0]} noStyle>
              <Select showSearch optionFilterProp="label" style={{ width: '50%' }} allowClear placeholder={t('content.metadata.keywords.exclusive')}
                options={[
                  { value: '0', label: 'Non-platform exclusive' },
                  { value: '1', label: 'Only Tivibu' },
                ]}
              />
            </Form.Item>
            <Form.Item name={['keywords', 1]} noStyle>
              <Select showSearch optionFilterProp="label" style={{ width: '50%' }} allowClear placeholder={t('content.metadata.keywords.hdr')}
                options={[
                  { value: '0', label: 'Non-HDR content' },
                  { value: '1', label: 'HDR content' },
                ]}
              />
            </Form.Item>
          </TrimInput.Group>
        </Form.Item>
      </Col>

      <Col span={8}>
        <Form.Item name="metalayout" label={t('content.metadata.metalayout')} initialValue="0" rules={[{ required: true, message: t('content.metadata.required') }]}>
          <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={dictOpts('Metalayout')} />
        </Form.Item>
      </Col>

      {/* Description */}
      <Col span={8}>
        <Form.Item name="description" label={t('content.metadata.description')}>
          <TrimInput.TextArea rows={3} />
        </Form.Item>
      </Col>

      {/* SectionsInfo 动态字段区 */}
      <Col span={24}>
        <SectionsInfoEditor />
      </Col>
    </Row>
  )
}

/* ═══════════════════════════════════════════════════════════ */
/*  Series Main 标签页 (SERIES / SEASON)                       */
/* ═══════════════════════════════════════════════════════════ */

function SeriesMainForm({ contentName, contentType, genreOpts, tagOpts, customTagOpts, typeOpts, dictOpts }: MainFormProps) {
  const { t } = useI18n()
  const formRules = useFormRules()
  return (
    <Row gutter={16}>
      <Col span={8}>
        <Form.Item name="name" label={t('content.metadata.name')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <TrimInput />
        </Form.Item>
      </Col>
      <Col span={8}>
        <ReadOnlyField label={t('content.metadata.contentName')} value={contentName} />
      </Col>
      <Col span={8}>
        <ReadOnlyField label={t('content.metadata.contentType')} value={contentType} />
      </Col>

      <Col span={8}>
        <Form.Item name="type_id" label={t('content.metadata.type')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={typeOpts} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="vod_type" label={t('content.metadata.vodType')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={dictOpts('VodType')} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="status_flag" label={t('content.metadata.status')} valuePropName="checked" initialValue={true}>
          <Switch checkedChildren={t('content.metadata.yes')} unCheckedChildren={t('content.metadata.no')} />
        </Form.Item>
      </Col>

      <Col span={8}>
        <Form.Item name="original_name" label={t('content.metadata.originalName')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <TrimInput />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="original_country" label={t('content.metadata.originalCountry')}>
          <TrimInput />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="language" label={t('content.metadata.language')}>
          <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={dictOpts('Language')} />
        </Form.Item>
      </Col>

      <Col span={8}>
        <Form.Item name="genre_id" label={t('content.metadata.genre')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <Select allowClear placeholder="Please select" showSearch optionFilterProp="label" options={genreOpts} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="sort_name" label={t('content.metadata.sortName')}>
          <TrimInput />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="short_title" label={t('content.metadata.shortTitle')}>
          <TrimInput />
        </Form.Item>
      </Col>

      <Col span={8}>
        <Form.Item name="release_year" label={t('content.metadata.releaseYear')}>
          <DatePicker picker="year" style={{ width: '100%' }} placeholder="请选择年份" />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="custom_tag_ids" label={t('content.metadata.customTags')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={customTagOpts} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="tag_ids" label={t('content.metadata.tags')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={tagOpts} />
        </Form.Item>
      </Col>

      <Col span={8}>
        <Form.Item name="rating_level" label={t('content.metadata.ratingLevel')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={dictOpts('RatingLevel')} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="advice" label={t('content.metadata.advice')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={dictOpts('Advice')} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="rating" label={t('content.metadata.rating')}>
          <TrimInput />
        </Form.Item>
      </Col>

      <Col span={8}>
        <Form.Item name="audio_lang" label={t('content.metadata.audioLang')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={dictOpts('Language')} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="subtitle_lang" label={t('content.metadata.subtitleLang')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={dictOpts('Language')} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="studio" label={t('content.metadata.studio')}>
          <TrimInput />
        </Form.Item>
      </Col>

      <Col span={8}>
        <Form.Item name="cdr_id" label={t('content.metadata.cdrId')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <TrimInput />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="begin_duration" label={t('content.metadata.beginDuration')}>
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="end_duration" label={t('content.metadata.endDuration')}>
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>
      </Col>

      {/* Keywords: 双下拉 */}
      <Col span={8}>
        <Form.Item label={t('content.metadata.keywords')}>
          <TrimInput.Group compact>
            <Form.Item name={['keywords', 0]} noStyle>
              <Select showSearch optionFilterProp="label" style={{ width: '50%' }} allowClear placeholder={t('content.metadata.keywords.exclusive')}
                options={[
                  { value: '0', label: 'Non-platform exclusive' },
                  { value: '1', label: 'Only Tivibu' },
                ]}
              />
            </Form.Item>
            <Form.Item name={['keywords', 1]} noStyle>
              <Select showSearch optionFilterProp="label" style={{ width: '50%' }} allowClear placeholder={t('content.metadata.keywords.hdr')}
                options={[
                  { value: '0', label: 'Non-HDR content' },
                  { value: '1', label: 'HDR content' },
                ]}
              />
            </Form.Item>
          </TrimInput.Group>
        </Form.Item>
      </Col>

      <Col span={16}>
        <Form.Item name="description" label={t('content.metadata.description')} rules={[formRules.maxLength(FORM_MAX_LENGTH.TEXT_AREA)]}>
          <TrimInput.TextArea rows={3} />
        </Form.Item>
      </Col>
    </Row>
  )
}

/* ═══════════════════════════════════════════════════════════ */
/*  Channel Main 标签页 (CHANNEL)                              */
/* ═══════════════════════════════════════════════════════════ */

interface ChannelFormProps {
  contentName: string
  contentType: string
  genreOpts: { value: number; label: string }[]
  customTagOpts: { value: number; label: string }[]
  dictOpts: (code: string) => DictOption[]
}

function ChannelMainForm({ contentName, contentType, genreOpts, customTagOpts, dictOpts }: ChannelFormProps) {
  const { t } = useI18n()
  return (
    <Row gutter={16}>
      <Col span={8}>
        <Form.Item name="name" label={t('content.metadata.channelName')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <TrimInput />
        </Form.Item>
      </Col>
      <Col span={8}>
        <ReadOnlyField label={t('content.metadata.contentName')} value={contentName} />
      </Col>
      <Col span={8}>
        <ReadOnlyField label={t('content.metadata.contentType')} value={contentType} />
      </Col>

      <Col span={8}>
        <Form.Item name="genre_id" label={t('content.metadata.genre')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <Select allowClear placeholder="Please select" showSearch optionFilterProp="label" options={genreOpts} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="custom_tag_ids" label={t('content.metadata.customTags')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={customTagOpts} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="channel_number" label={t('content.metadata.channelNumber')}>
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>
      </Col>

      <Col span={16}>
        <Form.Item name="description" label={t('content.metadata.description')}>
          <TrimInput.TextArea rows={3} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="channel_type" label={t('content.metadata.channelType')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={dictOpts('Channel_type')} />
        </Form.Item>
      </Col>

      <Col span={8}>
        <Form.Item name="audio_type" label={t('content.metadata.audioType')}>
          <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={dictOpts('AudioType')} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="rating_level" label={t('content.metadata.ratingLevel')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={dictOpts('RatingLevel')} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="audio_lang" label={t('content.metadata.audioLang')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={dictOpts('Language')} />
        </Form.Item>
      </Col>

      <Col span={8}>
        <Form.Item name="subtitle_lang" label={t('content.metadata.subtitleLang')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={dictOpts('Language')} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="status_flag" label={t('content.metadata.status')} valuePropName="checked" initialValue={true}>
          <Switch checkedChildren={t('content.metadata.yes')} unCheckedChildren={t('content.metadata.no')} />
        </Form.Item>
      </Col>

      <Col span={8}>
        <Form.Item name="ppv_enable" label={t('content.metadata.ppvEnable')} valuePropName="checked" initialValue={false}>
          <Switch />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="npvr_enable" label={t('content.metadata.npvrEnable')} valuePropName="checked" initialValue={false}>
          <Switch />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="fingerprint_enable" label={t('content.metadata.fingerprintEnable')} valuePropName="checked" initialValue={false}>
          <Switch />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="watermark_enable" label={t('content.metadata.watermarkEnable')} valuePropName="checked" initialValue={false}>
          <Switch />
        </Form.Item>
      </Col>
    </Row>
  )
}

/* ═══════════════════════════════════════════════════════════ */
/*  Schedule Main 标签页 (SCHEDULE)                            */
/* ═══════════════════════════════════════════════════════════ */

function ScheduleMainForm({ contentName, contentType, genreOpts, tagOpts, customTagOpts, typeOpts, dictOpts, packageOpts }: MainFormProps) {
  const { t } = useI18n()

  /* ── 条件显示字段监听 ─────────────────────────────────────────────────── */
  const cutvEnable = Form.useWatch('cutv_enable') ?? false
  const ppvEnable = Form.useWatch('ppv_enable') ?? false
  const seriesType = Form.useWatch('series_type') ?? 0
  const tstvEnable = Form.useWatch('tstv_enable') ?? false
  const tstvMode = Form.useWatch('tstv_mode') ?? false

  /* ── Series / Show 搜索 ──────────────────────────────────────────────── */
  const [seriesSearchOptions, setSeriesSearchOptions] = useState<{ value: string; label: string; id: number }[]>([])
  const [showSearchOptions, setShowSearchOptions] = useState<{ value: string; label: string; id: number }[]>([])
  const seriesSelectRef = useRef(false)
  const showSelectRef = useRef(false)
  const form = Form.useFormInstance()

  const searchSeries = useCallback((keyword: string) => {
    if (!keyword || keyword.trim().length < 1) {
      setSeriesSearchOptions([])
      return
    }
    void getContents({ page: 1, page_size: 20, title: keyword.trim(), content_types: ['SERIES'] })
      .then((res) => {
        setSeriesSearchOptions(res.items.map((item) => ({ value: item.title, label: `${item.title} (ID:${item.id})`, id: item.id })))
      })
      .catch(() => setSeriesSearchOptions([]))
  }, [])

  const searchShow = useCallback((keyword: string) => {
    if (!keyword || keyword.trim().length < 1) {
      setShowSearchOptions([])
      return
    }
    void getContents({ page: 1, page_size: 20, title: keyword.trim(), content_types: ['SEASON'] })
      .then((res) => {
        setShowSearchOptions(res.items.map((item) => ({ value: item.title, label: `${item.title} (ID:${item.id})`, id: item.id })))
      })
      .catch(() => setShowSearchOptions([]))
  }, [])

  return (
    <Row gutter={16}>
      {/* 第 1 行：节目名称 / 内容名称（只读）/ 内容类型（只读） */}
      <Col span={8}>
        <Form.Item name="name" label={t('content.metadata.programName')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <TrimInput />
        </Form.Item>
      </Col>
      <Col span={8}>
        <ReadOnlyField label={t('content.metadata.contentName')} value={contentName} />
      </Col>
      <Col span={8}>
        <ReadOnlyField label={t('content.metadata.contentType')} value={contentType} />
      </Col>

      {/* 第 2 行：题材 / 自定义标签 / 状态 */}
      <Col span={8}>
        <Form.Item name="genre_id" label={t('content.metadata.genre')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <Select allowClear placeholder="Please select" showSearch optionFilterProp="label" options={genreOpts} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="custom_tag_ids" label={t('content.metadata.customTags')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={customTagOpts} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="status_flag" label={t('content.metadata.status')} valuePropName="checked" initialValue={true}>
          <Switch checkedChildren={t('content.metadata.yes')} unCheckedChildren={t('content.metadata.no')} />
        </Form.Item>
      </Col>

      {/* 第 3 行：开始时间 / 结束时间 */}
      <Col span={8}>
        <Form.Item name="begin_time" label={t('content.metadata.beginTime')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="end_time" label={t('content.metadata.endTime')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
        </Form.Item>
      </Col>

      {/* 第 4 行：类型 / 标签 / 分级 */}
      <Col span={8}>
        <Form.Item name="type_id" label={t('content.metadata.type')}>
          <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={typeOpts} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="tag_ids" label={t('content.metadata.tags')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={tagOpts} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="rating_level" label={t('content.metadata.ratingLevel')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={dictOpts('RatingLevel')} />
        </Form.Item>
      </Col>

      {/* 第 5 行：分级建议 / 音频语言 / 字幕语言 */}
      <Col span={8}>
        <Form.Item name="advice" label={t('content.metadata.advice')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={dictOpts('Advice')} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="audio_lang" label={t('content.metadata.audioLang')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={dictOpts('Language')} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="subtitle_lang" label={t('content.metadata.subtitleLang')}>
          <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={dictOpts('Language')} />
        </Form.Item>
      </Col>

      {/* 第 6 行：制片公司 / CDR ID / 评分 */}
      <Col span={8}>
        <Form.Item name="studio" label={t('content.metadata.studio')}>
          <TrimInput />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item
          name="cdr_id"
          label={t('content.metadata.cdrId')}
          rules={ppvEnable ? [{ required: true, message: t('content.metadata.required') }] : []}
        >
          <TrimInput />
        </Form.Item>
      </Col>

      {/* 第 7 行：播出类型 / CUTV / TSTV / TSTV 模式 / NPVR */}
      <Col span={8}>
        <Form.Item name="broadcast_type" label={t('content.metadata.broadcastType')}>
          <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={dictOpts('BroadcastType')} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="cutv_enable" label={t('content.metadata.cutvEnable')} valuePropName="checked" initialValue={false}>
          <Switch checkedChildren={t('content.metadata.yes')} unCheckedChildren={t('content.metadata.no')} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="tstv_enable" label={t('content.metadata.tstvEnable')} valuePropName="checked" initialValue={true}>
          <Switch checkedChildren={t('content.metadata.yes')} unCheckedChildren={t('content.metadata.no')} />
        </Form.Item>
      </Col>
      {tstvEnable && (
        <Col span={8}>
          <Form.Item name="tstv_mode" label={t('content.metadata.tstvMode')} valuePropName="checked" initialValue={false}>
            <Switch checkedChildren={t('content.metadata.yes')} unCheckedChildren={t('content.metadata.no')} />
          </Form.Item>
        </Col>
      )}
      <Col span={8}>
        <Form.Item name="npvr_enable" label={t('content.metadata.npvrEnable')} valuePropName="checked" initialValue={true}>
          <Switch checkedChildren={t('content.metadata.yes')} unCheckedChildren={t('content.metadata.no')} />
        </Form.Item>
      </Col>

      {/* cutv_enable 勾选时显示 program_id */}
      {cutvEnable && (
        <Col span={8}>
          <Form.Item name="program_id" label={t('content.metadata.programId')} rules={[{ required: true, message: t('content.metadata.required') }]}>
            <TrimInput />
          </Form.Item>
        </Col>
      )}

      {/* 第 8 行：PPV 开关 / 前缓冲 / 后缓冲 */}
      <Col span={8}>
        <Form.Item name="ppv_enable" label={t('content.metadata.ppvEnable')} valuePropName="checked" initialValue={false}>
          <Switch checkedChildren={t('content.metadata.yes')} unCheckedChildren={t('content.metadata.no')} />
        </Form.Item>
      </Col>
      {ppvEnable && (
        <>
          <Col span={8}>
            <Form.Item name="pre_buffer" label={t('content.metadata.preBuffer')} rules={[{ required: true, message: t('content.metadata.required') }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="post_buffer" label={t('content.metadata.postBuffer')} rules={[{ required: true, message: t('content.metadata.required') }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
        </>
      )}
      {ppvEnable && (
        <>
          <Col span={8}>
            <Form.Item name="package_ids" label={t('content.metadata.packageId')} rules={[{ required: true, message: t('content.metadata.required') }]}>
              <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={packageOpts} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="purchase_begin_time" label={t('content.metadata.purchaseBeginTime')}>
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="purchase_end_time" label={t('content.metadata.purchaseEndTime')}>
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </>
      )}

      {/* 第 9 行：Series 类型 */}
      <Col span={8}>
        <Form.Item name="series_type" label={t('content.metadata.seriesType')} rules={[{ required: true, message: t('content.metadata.required') }]}>
          <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={dictOpts('SeriesType').map((o) => ({ label: o.label, value: Number(o.value) }))} />
        </Form.Item>
      </Col>

      {/* series_type = 1 或 2 时显示 Series 字段 */}
      {(seriesType === 1 || seriesType === 2) && (
        <>
          <Col span={8}>
            <Form.Item name="series_name" label={t('content.metadata.seriesName')} rules={[{ required: true, message: t('content.metadata.required') }]}>
              <AutoComplete
                options={seriesSearchOptions}
                onSearch={(val) => searchSeries(val)}
                onSelect={(_val, option) => {
                  seriesSelectRef.current = true
                  form.setFieldsValue({ series_id: String((option as unknown as { id: number }).id) })
                }}
                onChange={() => {
                  if (seriesSelectRef.current) {
                    seriesSelectRef.current = false
                    return
                  }
                  form.setFieldsValue({ series_id: '' })
                }}
                placeholder="请输入或搜索"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="series_id" label={t('content.metadata.seriesId')} rules={[{ required: true, message: t('content.metadata.required') }]}>
              <TrimInput />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="sequence" label={t('content.metadata.sequence')} rules={[{ required: true, message: t('content.metadata.required') }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
        </>
      )}

      {/* series_type = 2 时额外显示 Season Series 字段 */}
      {seriesType === 2 && (
        <>
          <Col span={8}>
            <Form.Item name="series_ordinal" label={t('content.metadata.seriesOrdinal')} rules={[{ required: true, message: t('content.metadata.required') }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="show_name" label={t('content.metadata.showName')} rules={[{ required: true, message: t('content.metadata.required') }]}>
              <AutoComplete
                options={showSearchOptions}
                onSearch={(val) => searchShow(val)}
                onSelect={(_val, option) => {
                  showSelectRef.current = true
                  form.setFieldsValue({ show_id: String((option as unknown as { id: number }).id) })
                }}
                onChange={() => {
                  if (showSelectRef.current) {
                    showSelectRef.current = false
                    return
                  }
                  form.setFieldsValue({ show_id: '' })
                }}
                placeholder="请输入或搜索"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="show_id" label={t('content.metadata.showId')} rules={[{ required: true, message: t('content.metadata.required') }]}>
              <TrimInput />
            </Form.Item>
          </Col>
        </>
      )}

      {/* 简介 */}
      <Col span={16}>
        <Form.Item name="description" label={t('content.metadata.description')}>
          <TrimInput.TextArea rows={3} />
        </Form.Item>
      </Col>

      {/* SectionsInfo（tstv_enable 且 tstv_mode 勾选时显示） */}
      {tstvEnable && tstvMode && (
        <Col span={24}>
          <SectionsInfoEditor />
        </Col>
      )}
    </Row>
  )
}

/* ═══════════════════════════════════════════════════════════ */
/*  SectionsInfo 动态字段编辑器                                */
/* ═══════════════════════════════════════════════════════════ */

function SectionsInfoEditor() {
  const { t } = useI18n()
  return (
    <Form.List name="sections_info">
      {(fields, { add, remove }) => (
        <div>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>{t('content.metadata.sectionsInfo')}</div>
          {fields.map(({ key, name, ...restField }) => (
            <Row key={key} gutter={8}  style={{ marginBottom: 4 }}>
              <Col span={4}>
                <Form.Item {...restField} name={[name, 'type']} rules={[{ required: true, message: t('content.metadata.required') }]}>
                  <Select showSearch optionFilterProp="label" placeholder={t('content.metadata.sectionsInfo.type')}
                    options={[
                      { value: 1, label: '1:intro' },
                      { value: 2, label: '2:ad' },
                      { value: 3, label: '3:chapter' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item {...restField} name={[name, 'action']} rules={[{ required: true, message: t('content.metadata.required') }]}>
                  <Select showSearch optionFilterProp="label" placeholder={t('content.metadata.sectionsInfo.action')}
                    options={[
                      { value: 0, label: '0:no skip' },
                      { value: 1, label: '1:skip' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item {...restField} name={[name, 'tag']} rules={[{ required: true, message: t('content.metadata.required') }]}>
                  <TrimInput placeholder={t('content.metadata.sectionsInfo.tag')} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item {...restField} name={[name, 'start']} rules={[{ required: true, message: t('content.metadata.required') }]}>
                  <InputNumber style={{ width: '100%' }} placeholder={t('content.metadata.sectionsInfo.start')} min={0} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item {...restField} name={[name, 'end']} rules={[{ required: true, message: t('content.metadata.required') }]}>
                  <InputNumber style={{ width: '100%' }} placeholder={t('content.metadata.sectionsInfo.end')} min={0} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
              </Col>
            </Row>
          ))}
          <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} style={{ width: '100%' }}>
            {t('content.metadata.sectionsInfo.addRow')}
          </Button>
        </div>
      )}
    </Form.List>
  )
}

/* ═══════════════════════════════════════════════════════════ */
/*  Custom Fields 标签页                                       */
/* ═══════════════════════════════════════════════════════════ */

function CustomFieldsTab({ customFields, defaultLanguage, readOnly: disabled }: { customFields: CustomFieldListItem[]; defaultLanguage: string; readOnly: boolean }) {
  const { t } = useI18n()

  if (customFields.length === 0) {
    return <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>No custom fields configured</div>
  }

  return (
    <Row gutter={16}>
      {customFields.map(field => {
        const isRequired = field.mandatory
        const lang = defaultLanguage
        const options = field.options.map(o => ({ value: o.code, label: o.names?.[lang] ?? o.code }))
        const namePath = field.multi_language
          ? (['i18n', defaultLanguage, `cf_${field.field_code}`] as (string | number)[])
          : (['custom_field_values', field.field_code] as (string | number)[])
        return (
          <Col span={8} key={field.id}>
            <Form.Item
              name={namePath}
              label={field.field_name}
              rules={isRequired ? [{ required: true, message: t('content.metadata.required') }] : undefined}
            >
              {field.field_type === 'DropList' ? (
                <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={options} disabled={disabled} />
              ) : field.field_type === 'DropList_multiple' ? (
                <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={options} disabled={disabled} />
              ) : field.field_type === 'LongText' ? (
                <TrimInput.TextArea rows={2} disabled={disabled} />
              ) : field.field_type === 'Integer' || field.field_type === 'Decimal' ? (
                <InputNumber style={{ width: '100%' }} disabled={disabled} />
              ) : field.field_type === 'Date' ? (
                <DatePicker style={{ width: '100%' }} disabled={disabled} />
              ) : (
                <TrimInput disabled={disabled} />
              )}
            </Form.Item>
          </Col>
        )
      })}
    </Row>
  )
}

/* ═══════════════════════════════════════════════════════════ */
/*  Multi Languages 标签页                                     */
/* ═══════════════════════════════════════════════════════════ */

function MultiLanguagesTab({
  kind, customFields, genres, tags, dictOpts, currentLanguage, onLanguageChange, readOnly: disabled, defaultLanguage,
}: {
  kind: MetadataKind
  customFields: CustomFieldListItem[]
  genres: GenreListItem[]
  tags: TagListItem[]
  dictOpts: (code: string) => DictOption[]
  currentLanguage: string
  onLanguageChange: (lang: string) => void
  readOnly: boolean
  defaultLanguage: string
}) {
  const { t } = useI18n()
  const form = Form.useFormInstance()

  const allLanguages = dictOpts('Multi_Languages')
  const languages = useMemo(() => allLanguages.filter(l => l.value !== defaultLanguage), [allLanguages, defaultLanguage])

  const selectedLang = currentLanguage && currentLanguage !== defaultLanguage
    ? currentLanguage
    : languages[0]?.value || null

  // 根据当前语言过滤 Genre / Tag 选项
  const genreOptsForLang = useMemo(() => {
    if (!selectedLang) return []
    return genres.filter(g => g.language === selectedLang).map(g => ({ value: g.id, label: g.name }))
  }, [genres, selectedLang])

  const tagOptsForLang = useMemo(() => {
    if (!selectedLang) return []
    return tags.filter(tg => tg.language === selectedLang).map(tg => ({ value: tg.id, label: tg.name }))
  }, [tags, selectedLang])

  // 多语言自定义字段
  const mlCustomFields = useMemo(() => customFields.filter(f => f.multi_language), [customFields])

  // 清除某语言下的全部字段
  const handleClear = (lang: string) => {
    const current = form.getFieldValue('i18n') as Record<string, Record<string, unknown>> | undefined
    form.setFieldsValue({ i18n: { ...current, [lang]: {} } })
  }

  if (languages.length === 0) {
    return <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>{t('content.metadata.noOtherLanguages')}</div>
  }

  return (
    <Row gutter={16}>
      {/* 左侧语言列表 */}
      <Col span={6}>
        <div style={{ borderRight: '1px solid #f0f0f0', paddingRight: 8 }}>
          {languages.map(lang => (
            <div
              key={lang.value}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: selectedLang === lang.value ? '#e6f4ff' : 'transparent',
                borderRadius: 6,
                marginBottom: 4,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onClick={() => onLanguageChange(lang.value)}
            >
              <span>{lang.label}</span>
              <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); handleClear(lang.value) }}>
                {t('content.metadata.clear')}
              </Button>
            </div>
          ))}
        </div>
      </Col>

      {/* 右侧语言表单 */}
      <Col span={18}>
        {selectedLang ? (
          <div>
            <div style={{ marginBottom: 12, fontWeight: 600 }}>
              {t('content.metadata.language')}: {languages.find(l => l.value === selectedLang)?.label}
            </div>
            <Row gutter={16}>
              {/* Name | SortName */}
              <Col span={12}>
                <Form.Item name={['i18n', selectedLang!, 'name']} label={t('content.metadata.name')}>
                  <TrimInput disabled={disabled} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name={['i18n', selectedLang!, 'sort_name']} label={t('content.metadata.sortName')}>
                  <TrimInput disabled={disabled} />
                </Form.Item>
              </Col>

              {/* Tags | ShortTitle */}
              <Col span={12}>
                <Form.Item name={['i18n', selectedLang!, 'tag_ids']} label={t('content.metadata.tags')}>
                  <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={tagOptsForLang} disabled={disabled || tagOptsForLang.length === 0} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name={['i18n', selectedLang!, 'short_title']} label={t('content.metadata.shortTitle')}>
                  <TrimInput disabled={disabled} />
                </Form.Item>
              </Col>

              {/* Description | Genre */}
              <Col span={12}>
                <Form.Item name={['i18n', selectedLang!, 'description']} label={t('content.metadata.description')}>
                  <TrimInput.TextArea rows={3} disabled={disabled} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name={['i18n', selectedLang!, 'genre_ids']} label={t('content.metadata.genre')}>
                  <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={genreOptsForLang} disabled={disabled || genreOptsForLang.length === 0} />
                </Form.Item>
              </Col>

              {/* Program 额外 original_name */}
              {kind === 'program' && (
                <Col span={12}>
                  <Form.Item name={['i18n', selectedLang!, 'original_name']} label={t('content.metadata.originalName')}>
                    <TrimInput disabled={disabled} />
                  </Form.Item>
                </Col>
              )}

              {/* Custom Fields */}
              {mlCustomFields.map(field => {
                const options = field.options.map(o => ({ value: o.code, label: o.names?.[selectedLang!] ?? o.code }))
                let control: React.ReactNode
                if (field.field_type === 'DropList') {
                  control = <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={options} disabled={disabled} />
                } else if (field.field_type === 'DropList_multiple') {
                  control = <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={options} disabled={disabled} />
                } else if (field.field_type === 'LongText') {
                  control = <TrimInput.TextArea rows={2} disabled={disabled} />
                } else if (field.field_type === 'Integer' || field.field_type === 'Decimal') {
                  control = <InputNumber style={{ width: '100%' }} disabled={disabled} />
                } else if (field.field_type === 'Date') {
                  control = <DatePicker style={{ width: '100%' }} disabled={disabled} />
                } else {
                  control = <TrimInput disabled={disabled} />
                }
                return (
                  <Col span={12} key={field.id}>
                    <Form.Item name={['i18n', selectedLang!, `cf_${field.field_code}`]} label={field.field_name}>
                      {control}
                    </Form.Item>
                  </Col>
                )
              })}
            </Row>
          </div>
        ) : (
          <div style={{ color: '#999', textAlign: 'center', padding: 48 }}>Select a language</div>
        )}
      </Col>
    </Row>
  )
}
