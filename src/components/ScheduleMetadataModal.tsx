import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AutoComplete,
  Button,
  Col,
  DatePicker,
  Form,
  InputNumber,
  Modal,
  Row,
  Select,
  Spin,
  Switch,
  Tabs,
  message,
} from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getScheduleMetadata,
  createScheduleMetadata,
  updateScheduleMetadata,
} from '../api/metadata'
import { getGenres } from '../api/genres'
import { getCustomTags } from '../api/customTags'
import { getDictTree } from '../api/dicts'
import { getCustomFields } from '../api/customFields'
import { getMultiLanguageOptions } from '../api/i18n'
import { getPackages } from '../api/packages'
import {
  getContents,
  getContent,
  updateContent,
  getContentFieldValues,
  saveContentFieldValues,
  getContentI18n,
  saveContentI18n,
} from '../api/contents'
import { useI18n } from '../i18n/useI18n'
import { useFormRules } from '../hooks/useFormRules'
import TrimInput from './TrimInput'
import type { ScheduleMetadataItem, ScheduleMetadataCreate, ScheduleMetadataUpdate } from '../types/metadata'
import type { GenreListItem, CustomFieldListItem, EntityFieldValueItem, EntityI18nItem, CustomTagListItem } from '../types/basic'
import type { DictNodeListItem } from '../types/dict'
import type { LanguageOption } from '../types/i18n'
import type { PackageListItem } from '../types/package'
import { isHandledError } from '../api'
import { FORM_MAX_LENGTH } from '../constants/form'

/* ─── 辅助函数 ───────────────────────────────────────────────────────────── */

const isMultiSelectField = (fieldType: string) => fieldType === 'DropList_multiple'
const isSelectField = (fieldType: string) => fieldType === 'DropList' || fieldType === 'DropList_multiple'
const isLongTextField = (fieldType: string) => fieldType === 'LongText'
const isNumberField = (fieldType: string) => fieldType === 'Integer' || fieldType === 'Decimal'
const isDateField = (fieldType: string) => fieldType === 'Date'
const isTimeField = (fieldType: string) => fieldType === 'Time'
const isDateTimeField = (fieldType: string) => fieldType === 'Date+Time'

function findDictNodeByCode(nodes: DictNodeListItem[], code: string): DictNodeListItem | undefined {
  for (const node of nodes) {
    if (node.code === code) return node
    if (node.children) {
      const found = findDictNodeByCode(node.children, code)
      if (found) return found
    }
  }
  return undefined
}

function mapDictChildrenToOptions(node: DictNodeListItem | undefined): { label: string; value: string }[] {
  if (!node || !node.children) return []
  return node.children.map((c) => ({ label: c.name, value: c.code }))
}

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface ScheduleMetadataModalProps {
  open: boolean
  scheduleId: number
  scheduleName: string
  contentType: string
  onClose: () => void
  onSuccess: () => void
}

/* ─── 主组件 ─────────────────────────────────────────────────────────────── */

export default function ScheduleMetadataModal({
  open,
  scheduleId,
  scheduleName,
  contentType,
  onClose,
  onSuccess,
}: ScheduleMetadataModalProps) {
  const { t, language } = useI18n()
  const formRules = useFormRules()
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('main')

  const [metadata, setMetadata] = useState<ScheduleMetadataItem | null>(null)
  const [genres, setGenres] = useState<GenreListItem[]>([])
  const [customTags, setCustomTags] = useState<CustomTagListItem[]>([])
  const [dictTree, setDictTree] = useState<DictNodeListItem[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldListItem[]>([])
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([])
  const [fieldValues, setFieldValues] = useState<Record<number, string>>({})
  const [i18nValues, setI18nValues] = useState<Record<string, Record<string, string>>>({})
  const [activeLang, setActiveLang] = useState<string>('')
  const [packages, setPackages] = useState<PackageListItem[]>([])
  const [seriesSearchOptions, setSeriesSearchOptions] = useState<{ value: string; label: string; id: number }[]>([])
  const [showSearchOptions, setShowSearchOptions] = useState<{ value: string; label: string; id: number }[]>([])
  // ref 标记“本次变更来自选中”，避免 onChange 误清 ID
  const seriesSelectRef = useRef(false)
  const showSelectRef = useRef(false)

  /* ── 字典选项 ──────────────────────────────────────────────────────────── */
  const ratingLevelOptions = useMemo(() => mapDictChildrenToOptions(findDictNodeByCode(dictTree, 'RatingLevel')), [dictTree])
  const broadcastTypeOptions = useMemo(() => mapDictChildrenToOptions(findDictNodeByCode(dictTree, 'BroadcastType')), [dictTree])
  const languageOptionsFromDict = useMemo(() => mapDictChildrenToOptions(findDictNodeByCode(dictTree, 'Language')), [dictTree])
  const adviceOptions = useMemo(() => mapDictChildrenToOptions(findDictNodeByCode(dictTree, 'Advice')), [dictTree])
  const seriesTypeOptions = useMemo(() => mapDictChildrenToOptions(findDictNodeByCode(dictTree, 'SeriesType')), [dictTree])

  /* ── 条件显示字段监听 ─────────────────────────────────────────────────── */
  const cutvEnable = Form.useWatch('cutv_enable', form) ?? false
  const ppvEnable = Form.useWatch('ppv_enable', form) ?? false
  const seriesType = Form.useWatch('series_type', form) ?? 0
  const tstvMode = Form.useWatch('tstv_mode', form) ?? false

  /* ── 自定义字段过滤 ─────────────────────────────────────────────────────── */
  const scheduleCustomFields = useMemo(
    () => customFields.filter((f) => f.belongings.includes('ALL') || f.belongings.includes('Schedule')),
    [customFields],
  )
  const multiLanguageCustomFields = useMemo(
    () => scheduleCustomFields.filter((f) => f.multi_language),
    [scheduleCustomFields],
  )

  /* ── 加载数据 ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!open || !scheduleId) return
    setLoading(true)
    void (async () => {
      try {
        const [meta, genreRes, customTagRes, dictRes, fieldsRes, langsRes, pkgRes, contentDetail] = await Promise.all([
          getScheduleMetadata(scheduleId),
          getGenres({ page: 1, page_size: 200 }),
          getCustomTags({ page: 1, page_size: 200 }),
          getDictTree(),
          getCustomFields({ page: 1, page_size: 200, belongings: ['ALL', 'Schedule'] }),
          getMultiLanguageOptions(),
          getPackages({ page: 1, page_size: 200 }),
          getContent(scheduleId),  // ✅ 获取主表数据（包含 custom_tag_ids 和 genre_id）
        ])

        setMetadata(meta)
        setGenres(genreRes.items)
        setCustomTags(customTagRes.items)
        setDictTree(dictRes)
        setCustomFields(fieldsRes.items)
        setLanguageOptions(langsRes)
        setPackages(pkgRes.items)

        if (langsRes.length > 1) {
          setActiveLang(langsRes[1].code)
        } else if (langsRes.length > 0) {
          setActiveLang(langsRes[0].code)
        }

        const [savedFields, savedI18n] = await Promise.all([
          getContentFieldValues(scheduleId),
          getContentI18n(scheduleId),
        ])

        const nextFieldValues: Record<number, string> = {}
        savedFields.forEach((item: EntityFieldValueItem) => {
          nextFieldValues[item.custom_field_id] = item.value ?? ''
        })
        setFieldValues(nextFieldValues)

        const nextI18n: Record<string, Record<string, string>> = {}
        langsRes.forEach((lang) => { nextI18n[lang.code] = {} })
        savedI18n.forEach((item: EntityI18nItem) => {
          if (!nextI18n[item.language]) nextI18n[item.language] = {}
          nextI18n[item.language][item.field_name] = item.value ?? ''
        })
        setI18nValues(nextI18n)

        // ✅ 从主表获取 genre_id、custom_tag_ids、begin_time、end_time
        const contentGenreId = contentDetail?.content?.genre_id ?? undefined
        const contentCustomTagIds = contentDetail?.content?.custom_tag_ids ?? []
        const contentBeginTime = contentDetail?.content?.begin_time ?? undefined
        const contentEndTime = contentDetail?.content?.end_time ?? undefined

        form.setFieldsValue({
          program_name: meta?.name ?? scheduleName,
          genre_id: contentGenreId,
          custom_tag_ids: contentCustomTagIds,
          begin_time: contentBeginTime ? dayjs(contentBeginTime) : undefined,
          end_time: contentEndTime ? dayjs(contentEndTime) : undefined,
          status_flag: meta?.status_flag ?? true,
          description: meta?.description ?? '',
          cutv_enable: meta?.cutv_enable ?? false,
          program_id: meta?.program_id ?? '',
          rating_level: meta?.rating_level ?? undefined,
          broadcast_type: meta?.broadcast_type ?? undefined,
          audio_lang: meta?.audio_lang ?? [],
          subtitle_lang: meta?.subtitle_lang ?? [],
          tstv_enable: meta?.tstv_enable ?? true,
          tstv_mode: meta?.tstv_mode ?? false,
          npvr_enable: meta?.npvr_enable ?? true,
          ppv_enable: meta?.ppv_enable ?? false,
          package_ids: meta?.package_ids ?? [],
          pre_buffer: meta?.pre_buffer ?? 0,
          post_buffer: meta?.post_buffer ?? 0,
          purchase_begin_time: meta?.purchase_begin_time ?? 180,
          purchase_end_time: meta?.purchase_end_time ?? -1,
          cdr_id: meta?.cdr_id ?? '',
          advice: meta?.advice ?? [],
          series_type: meta?.series_type ?? 0,
          series_name: meta?.series_name ?? '',
          series_id: meta?.series_id ?? '',
          sequence: meta?.sequence ?? undefined,
          series_ordinal: meta?.series_ordinal ?? undefined,
          show_name: meta?.show_name ?? '',
          show_id: meta?.show_id ?? '',
          sections_info: meta?.sections_info ?? [],
        })
      } catch (err) {
        if (isHandledError(err)) return
        void message.error(t('live.schedule.msg.metadataLoadFailed'), 5)
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scheduleId])

  /* ── 重置 ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) {
      form.resetFields()
      setMetadata(null)
      setFieldValues({})
      setI18nValues({})
      setActiveTab('main')
    }
  }, [open, form])

  /* ── 保存 ──────────────────────────────────────────────────────────────── */
  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      // ✅ 分离 custom_tag_ids、genre_id、begin_time、end_time，不保存到元数据表
      const { custom_tag_ids, genre_id, begin_time, end_time, ...metadataValues } = values

      const payload = {
        name: metadataValues.program_name,
        status_flag: metadataValues.status_flag,
        description: metadataValues.description || undefined,
        cutv_enable: metadataValues.cutv_enable,
        program_id: metadataValues.program_id || undefined,
        rating_level: metadataValues.rating_level || undefined,
        broadcast_type: metadataValues.broadcast_type || undefined,
        audio_lang: metadataValues.audio_lang?.length ? metadataValues.audio_lang : undefined,
        subtitle_lang: metadataValues.subtitle_lang?.length ? metadataValues.subtitle_lang : undefined,
        tstv_enable: metadataValues.tstv_enable,
        tstv_mode: metadataValues.tstv_mode,
        npvr_enable: metadataValues.npvr_enable,
        ppv_enable: metadataValues.ppv_enable,
        package_ids: metadataValues.package_ids?.length ? metadataValues.package_ids : undefined,
        pre_buffer: metadataValues.pre_buffer,
        post_buffer: metadataValues.post_buffer,
        purchase_begin_time: metadataValues.purchase_begin_time,
        purchase_end_time: metadataValues.purchase_end_time,
        cdr_id: metadataValues.cdr_id || undefined,
        advice: metadataValues.advice?.length ? metadataValues.advice : undefined,
        series_type: metadataValues.series_type,
        series_name: metadataValues.series_name || undefined,
        series_id: metadataValues.series_id || undefined,
        sequence: metadataValues.sequence,
        series_ordinal: metadataValues.series_ordinal,
        show_name: metadataValues.show_name || undefined,
        show_id: metadataValues.show_id || undefined,
        sections_info: metadataValues.sections_info?.length ? metadataValues.sections_info : undefined,
      }

      if (metadata) {
        await updateScheduleMetadata(scheduleId, payload as ScheduleMetadataUpdate)
      } else {
        await createScheduleMetadata(scheduleId, {
          content_id: scheduleId,
          ...payload,
        } as ScheduleMetadataCreate)
      }

      // ✅ 更新主表的 genre_id、custom_tag_ids、begin_time、end_time
      await updateContent(scheduleId, {
        genre_id: genre_id,
        custom_tag_ids: custom_tag_ids?.length ? custom_tag_ids : undefined,
        begin_time: begin_time ? begin_time.toISOString() : undefined,
        end_time: end_time ? end_time.toISOString() : undefined,
      })

      const fieldPayload = {
        values: Object.entries(fieldValues)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([custom_field_id, value]) => ({ custom_field_id: Number(custom_field_id), value })),
      }
      await saveContentFieldValues(scheduleId, fieldPayload)

      // 保存多语言值（默认语言只保存 cf_ 自定义字段，其余已在主表保存）
      for (const [lang, fields] of Object.entries(i18nValues)) {
        const nonEmptyFields: Record<string, string> = {}
        Object.entries(fields).forEach(([k, v]) => {
          if (lang === defaultLang && !k.startsWith('cf_')) return
          if (v !== undefined && v !== null && v !== '') nonEmptyFields[k] = v
        })
        if (Object.keys(nonEmptyFields).length > 0) {
          await saveContentI18n(scheduleId, { language: lang, fields: nonEmptyFields })
        }
      }

      void message.success(t('live.schedule.msg.metadataSaved'), 3)
      onSuccess()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('live.schedule.msg.metadataSaveFailed'), 5)
    } finally {
      setSaving(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId, metadata, fieldValues, i18nValues, form, onSuccess])

  /* ── Series / Show 搜索 ──────────────────────────────────────────────── */
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

  /* ── 自定义字段值更新 ───────────────────────────────────────────────────── */
  const updateFieldValue = useCallback((fieldId: number, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }))
  }, [])

  const updateI18nValue = useCallback((lang: string, fieldName: string, value: string) => {
    setI18nValues((prev) => ({
      ...prev,
      [lang]: {
        ...(prev[lang] ?? {}),
        [fieldName]: value,
      },
    }))
  }, [])

  const clearLanguageValues = useCallback((lang: string) => {
    setI18nValues((prev) => ({
      ...prev,
      [lang]: {},
    }))
  }, [])

  /* ── Main tab 字段同步到 Multi Languages 默认语言 ──────────────────────── */
  const defaultLang = languageOptions[0]?.code ?? ''
  const watchedProgramName = Form.useWatch('program_name', form)
  const watchedDescription = Form.useWatch('description', form)
  const watchedGenreId = Form.useWatch('genre_id', form)
  const watchedSeriesName = Form.useWatch('series_name', form)
  const watchedShowName = Form.useWatch('show_name', form)

  useEffect(() => {
    if (!defaultLang || loading) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setI18nValues((prev) => {
      const langValues = { ...(prev[defaultLang] ?? {}) }
      let changed = false
      if (watchedProgramName !== undefined && watchedProgramName !== null) {
        langValues['program_name'] = String(watchedProgramName)
        changed = true
      }
      if (watchedDescription !== undefined && watchedDescription !== null) {
        langValues['description'] = String(watchedDescription)
        changed = true
      }
      if (watchedGenreId !== undefined && watchedGenreId !== null) {
        langValues['genre'] = String(watchedGenreId)
        changed = true
      }
      if (watchedSeriesName !== undefined && watchedSeriesName !== null) {
        langValues['series_name'] = String(watchedSeriesName)
        changed = true
      }
      if (watchedShowName !== undefined && watchedShowName !== null) {
        langValues['show_name'] = String(watchedShowName)
        changed = true
      }
      if (!changed) return prev
      return { ...prev, [defaultLang]: langValues }
    })
  }, [watchedProgramName, watchedDescription, watchedGenreId, watchedSeriesName, watchedShowName, defaultLang, loading])

  /* ── 自定义字段输入渲染 ─────────────────────────────────────────────────── */
  const renderCustomFieldInput = useCallback(
    (field: CustomFieldListItem, isI18n = false, lang = '') => {
      const value = isI18n ? (i18nValues[lang]?.[field.field_code] ?? '') : (fieldValues[field.id] ?? '')

      if (isSelectField(field.field_type)) {
        if (isMultiSelectField(field.field_type)) {
          return (
            <Select
              showSearch
              optionFilterProp="label"
              mode="multiple"
              allowClear
              value={value ? value.split(',') : undefined}
              placeholder={field.tip ?? t('customField.placeholder.selectField', { name: field.field_name })}
              options={field.options.map((item) => ({
                label: item.names[language] ?? item.names.default ?? Object.values(item.names)[0] ?? item.code,
                value: item.code,
              }))}
              onChange={(val) => {
                const v = (val ?? []).join(',')
                if (isI18n) updateI18nValue(lang, field.field_code, v)
                else updateFieldValue(field.id, v)
              }}
              style={{ width: '100%' }}
            />
          )
        }
        return (
          <Select
            showSearch
            optionFilterProp="label"
            allowClear
            value={value || undefined}
            placeholder={field.tip ?? t('customField.placeholder.selectField', { name: field.field_name })}
            options={field.options.map((item) => ({
              label: item.names[language] ?? item.names.default ?? Object.values(item.names)[0] ?? item.code,
              value: item.code,
            }))}
            onChange={(val) => {
              if (isI18n) updateI18nValue(lang, field.field_code, val ?? '')
              else updateFieldValue(field.id, val ?? '')
            }}
            style={{ width: '100%' }}
          />
        )
      }
      if (isLongTextField(field.field_type)) {
        return (
          <TrimInput.TextArea
            rows={3}
            value={value}
            placeholder={field.tip ?? t('customField.placeholder.enterField', { name: field.field_name })}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
              if (isI18n) updateI18nValue(lang, field.field_code, e.target.value)
              else updateFieldValue(field.id, e.target.value)
            }}
          />
        )
      }
      if (isNumberField(field.field_type)) {
        return (
          <InputNumber
            style={{ width: '100%' }}
            value={value ? Number(value) : undefined}
            placeholder={field.tip ?? t('customField.placeholder.enterField', { name: field.field_name })}
            onChange={(val) => {
              const v = val !== null ? String(val) : ''
              if (isI18n) updateI18nValue(lang, field.field_code, v)
              else updateFieldValue(field.id, v)
            }}
          />
        )
      }
      if (isDateField(field.field_type)) {
        return (
          <TrimInput
            type="date"
            value={value}
            placeholder={field.tip ?? t('customField.placeholder.enterField', { name: field.field_name })}
            onChange={(e) => {
              if (isI18n) updateI18nValue(lang, field.field_code, e.target.value)
              else updateFieldValue(field.id, e.target.value)
            }}
          />
        )
      }
      if (isTimeField(field.field_type)) {
        return (
          <TrimInput
            type="time"
            value={value}
            placeholder={field.tip ?? t('customField.placeholder.enterField', { name: field.field_name })}
            onChange={(e) => {
              if (isI18n) updateI18nValue(lang, field.field_code, e.target.value)
              else updateFieldValue(field.id, e.target.value)
            }}
          />
        )
      }
      if (isDateTimeField(field.field_type)) {
        return (
          <TrimInput
            type="datetime-local"
            value={value}
            placeholder={field.tip ?? t('customField.placeholder.enterField', { name: field.field_name })}
            onChange={(e) => {
              if (isI18n) updateI18nValue(lang, field.field_code, e.target.value)
              else updateFieldValue(field.id, e.target.value)
            }}
          />
        )
      }
      return (
        <TrimInput
          value={value}
          placeholder={field.tip ?? t('customField.placeholder.enterField', { name: field.field_name })}
          onChange={(e) => {
            if (isI18n) updateI18nValue(lang, field.field_code, e.target.value)
            else updateFieldValue(field.id, e.target.value)
          }}
        />
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fieldValues, i18nValues, language, t],
  )

  /* ── Tab 内容 ──────────────────────────────────────────────────────────── */
  const tabItems = [
    {
      key: 'main',
      label: t('content.metadata.tab.main'),
      children: (
        <Form form={form} layout="vertical" autoComplete="off">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="program_name"
                label={t('content.metadata.programName')}
                rules={[{ required: true, message: t('content.metadata.required') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
              >
                <TrimInput />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={t('content.metadata.contentName')}>
                <TrimInput value={scheduleName} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={t('content.metadata.contentType')}>
                <TrimInput value={contentType} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="genre_id"
                label={t('content.metadata.genre')}
                rules={[{ required: true, message: t('content.metadata.required') }]}
              >
                <Select allowClear placeholder="Please select" showSearch optionFilterProp="label" options={genres.map((g) => ({ label: g.name, value: g.id }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="custom_tag_ids" label={t('content.metadata.customTags')}>
                <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={customTags.map((tag) => ({ label: tag.name, value: tag.id }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status_flag" label={t('content.metadata.status')} valuePropName="checked">
                <Switch checkedChildren={t('content.metadata.yes')} unCheckedChildren={t('content.metadata.no')} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
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
            <Col span={8}>
              <Form.Item name="rating_level" label={t('content.metadata.ratingLevel')}>
                <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={ratingLevelOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="broadcast_type" label={t('content.metadata.broadcastType')}>
                <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={broadcastTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="audio_lang" label={t('content.metadata.audioLang')}>
                <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={languageOptionsFromDict} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="subtitle_lang" label={t('content.metadata.subtitleLang')}>
                <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={languageOptionsFromDict} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="cutv_enable" label={t('content.metadata.cutvEnable')} valuePropName="checked">
                <Switch checkedChildren={t('content.metadata.yes')} unCheckedChildren={t('content.metadata.no')} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="tstv_enable" label={t('content.metadata.tstvEnable')} valuePropName="checked">
                <Switch checkedChildren={t('content.metadata.yes')} unCheckedChildren={t('content.metadata.no')} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="tstv_mode" label={t('content.metadata.tstvMode')} valuePropName="checked">
                <Switch checkedChildren={t('content.metadata.yes')} unCheckedChildren={t('content.metadata.no')} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="npvr_enable" label={t('content.metadata.npvrEnable')} valuePropName="checked">
                <Switch checkedChildren={t('content.metadata.yes')} unCheckedChildren={t('content.metadata.no')} />
              </Form.Item>
            </Col>
          </Row>
          {cutvEnable && (
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="program_id" label={t('content.metadata.programId')} rules={[{ required: true, message: t('content.metadata.required') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                  <TrimInput />
                </Form.Item>
              </Col>
            </Row>
          )}
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="ppv_enable" label={t('content.metadata.ppvEnable')} valuePropName="checked">
                <Switch checkedChildren={t('content.metadata.yes')} unCheckedChildren={t('content.metadata.no')} />
              </Form.Item>
            </Col>
            {ppvEnable && (
              <>
                <Col span={6}>
                  <Form.Item name="package_ids" label={t('content.metadata.packageId')} rules={[{ required: true, message: t('content.metadata.required') }]}>
                    <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={packages.map((p) => ({ label: p.name, value: p.id }))} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="pre_buffer" label={t('content.metadata.preBuffer')}>
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="post_buffer" label={t('content.metadata.postBuffer')}>
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>
          {ppvEnable && (
            <Row gutter={16}>
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
            </Row>
          )}
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="cdr_id" label={t('content.metadata.cdrId')} rules={[formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                <TrimInput />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="advice" label={t('content.metadata.advice')}>
                <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={adviceOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="series_type" label={t('content.metadata.seriesType')} rules={[{ required: true, message: t('content.metadata.required') }]}>
                <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={seriesTypeOptions.map((o) => ({ label: o.label, value: Number(o.value) }))} />
              </Form.Item>
            </Col>
          </Row>
          {(seriesType === 1 || seriesType === 2) && (
            <Row gutter={16}>
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
                <Form.Item name="series_id" label={t('content.metadata.seriesId')} rules={[{ required: true, message: t('content.metadata.required') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                  <TrimInput />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="sequence" label={t('content.metadata.sequence')} rules={[{ required: true, message: t('content.metadata.required') }]}>
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
              </Col>
            </Row>
          )}
          {seriesType === 2 && (
            <Row gutter={16}>
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
                <Form.Item name="show_id" label={t('content.metadata.showId')} rules={[{ required: true, message: t('content.metadata.required') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                  <TrimInput />
                </Form.Item>
              </Col>
            </Row>
          )}
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="description" label={t('content.metadata.description')} rules={[formRules.maxLength(FORM_MAX_LENGTH.TEXT_AREA)]}>
                <TrimInput.TextArea rows={3} />
              </Form.Item>
            </Col>
          </Row>
          {tstvMode && (
            <Row gutter={16}>
              <Col span={24}>
                <SectionsInfoEditor />
              </Col>
            </Row>
          )}
        </Form>
      ),
    },
    {
      key: 'customFields',
      label: t('content.metadata.tab.customFields'),
      children: (
        <div>
          {scheduleCustomFields.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
              {t('metadata.customFields.empty')}
            </div>
          ) : (
            <Row gutter={16}>
              {scheduleCustomFields.map((field) => (
                <Col span={8} key={field.id}>
                  <Form.Item
                    label={field.field_name}
                    required={field.mandatory}
                    tooltip={field.tip ?? undefined}
                  >
                    {renderCustomFieldInput(field)}
                  </Form.Item>
                </Col>
              ))}
            </Row>
          )}
        </div>
      ),
    },
    {
      key: 'multiLanguages',
      label: t('content.metadata.tab.multiLanguages'),
      children: (
        <Row gutter={16}>
          <Col span={8}>
            <div style={{ border: '1px solid #d9d9d9', borderRadius: 6 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px',
                  backgroundColor: '#fafafa',
                  borderBottom: '1px solid #d9d9d9',
                  fontWeight: 600,
                  padding: '8px 12px',
                }}
              >
                <span>{t('metadata.multiLang.language')}</span>
                <span style={{ textAlign: 'center' }}>{t('metadata.multiLang.action')}</span>
              </div>
              {languageOptions.filter((l) => l.code !== defaultLang).map((lang) => (
                <div
                  key={lang.code}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderBottom: '1px solid #f0f0f0',
                    cursor: 'pointer',
                    backgroundColor: activeLang === lang.code ? '#e6f7ff' : 'transparent',
                  }}
                  onClick={() => setActiveLang(lang.code)}
                >
                  <span style={{ color: activeLang === lang.code ? '#1890ff' : 'inherit', fontWeight: activeLang === lang.code ? 600 : 400 }}>
                    {lang.name}
                  </span>
                  <Button
                    type="link"
                    size="small"
                    danger
                    onClick={(e) => {
                      e.stopPropagation()
                      clearLanguageValues(lang.code)
                    }}
                  >
                    {t('metadata.multiLang.clear')}
                  </Button>
                </div>
              ))}
            </div>
          </Col>
          <Col span={16}>
            {activeLang && (
              <div>
                <div style={{ marginBottom: 16, fontWeight: 600 }}>
                  {t('metadata.multiLang.languageLabel')}: {languageOptions.filter((l) => l.code !== defaultLang).find((l) => l.code === activeLang)?.name ?? activeLang}
                </div>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label={t('content.metadata.programName')}>
                      <TrimInput
                        value={i18nValues[activeLang]?.['program_name'] ?? ''}
                        onChange={(e) => updateI18nValue(activeLang, 'program_name', e.target.value)}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label={t('content.metadata.genre')}>
                      <TrimInput
                        value={i18nValues[activeLang]?.['genre'] ?? ''}
                        onChange={(e) => updateI18nValue(activeLang, 'genre', e.target.value)}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label={t('content.metadata.seriesName')}>
                      <TrimInput
                        value={i18nValues[activeLang]?.['series_name'] ?? ''}
                        onChange={(e) => updateI18nValue(activeLang, 'series_name', e.target.value)}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label={t('content.metadata.showName')}>
                      <TrimInput
                        value={i18nValues[activeLang]?.['show_name'] ?? ''}
                        onChange={(e) => updateI18nValue(activeLang, 'show_name', e.target.value)}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label={t('content.metadata.description')}>
                      <TrimInput.TextArea
                        rows={3}
                        value={i18nValues[activeLang]?.['description'] ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateI18nValue(activeLang, 'description', e.target.value)}
                      />
                    </Form.Item>
                  </Col>
                  {multiLanguageCustomFields.map((field) => (
                    <Col span={12} key={field.id}>
                      <Form.Item label={field.field_name} tooltip={field.tip ?? undefined}>
                        {renderCustomFieldInput(field, true, activeLang)}
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
              </div>
            )}
          </Col>
        </Row>
      ),
    },
  ]

  return (
    <Modal
      open={open}
      title={t('content.metadata.title.schedule')}
      width={960}
      onCancel={onClose}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="primary" loading={saving} onClick={() => void handleSave()}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      {loading ? (
        <div style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin />
        </div>
      ) : (
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      )}
    </Modal>
  )
}

/* ═══════════════════════════════════════════════════════════ */
/*  SectionsInfo 动态字段编辑器                                */
/* ═══════════════════════════════════════════════════════════ */

function SectionsInfoEditor() {
  const { t } = useI18n()
  const formRules = useFormRules()
  return (
    <Form.List name="sections_info">
      {(fields, { add, remove }) => (
        <div>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>{t('content.metadata.sectionsInfo')}</div>
          {fields.map(({ key, name, ...restField }) => (
            <Row key={key} gutter={8} align="middle" style={{ marginBottom: 4 }}>
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
                <Form.Item {...restField} name={[name, 'tag']} rules={[{ required: true, message: t('content.metadata.required') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
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
