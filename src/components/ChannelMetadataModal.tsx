import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Col,
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
import {
  getChannelMetadata,
  createChannelMetadata,
  updateChannelMetadata,
} from '../api/metadata'
import { getGenres } from '../api/genres'
import { getCustomTags } from '../api/customTags'
import { getDictTree } from '../api/dicts'
import { getCustomFields } from '../api/customFields'
import { getMultiLanguageOptions } from '../api/i18n'
import TrimInput from './TrimInput'
import {
  getContent,
  updateContent,
  getContentFieldValues,
  saveContentFieldValues,
  getContentI18n,
  saveContentI18n,
} from '../api/contents'
import { useI18n } from '../i18n/useI18n'
import { useFormRules } from '../hooks/useFormRules'
import type { ChannelMetadataItem, ChannelMetadataCreate, ChannelMetadataUpdate } from '../types/metadata'
import type { GenreListItem, CustomFieldListItem, EntityFieldValueItem, EntityI18nItem, CustomTagListItem } from '../types/basic'
import type { DictNodeListItem } from '../types/dict'
import type { LanguageOption } from '../types/i18n'
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

interface ChannelMetadataModalProps {
  open: boolean
  channelId: number
  channelName: string
  contentType: string
  readOnly?: boolean
  onClose: () => void
  onSuccess: () => void
}

/* ─── 主组件 ─────────────────────────────────────────────────────────────── */

export default function ChannelMetadataModal({
  open,
  channelId,
  channelName,
  contentType,
  readOnly = false,
  onClose,
  onSuccess,
}: ChannelMetadataModalProps) {
  const { t, language } = useI18n()
  const formRules = useFormRules()
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('main')

  const [metadata, setMetadata] = useState<ChannelMetadataItem | null>(null)
  const [genres, setGenres] = useState<GenreListItem[]>([])
  const [customTags, setCustomTags] = useState<CustomTagListItem[]>([])
  const [dictTree, setDictTree] = useState<DictNodeListItem[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldListItem[]>([])
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([])
  const [fieldValues, setFieldValues] = useState<Record<number, string>>({})
  const [i18nValues, setI18nValues] = useState<Record<string, Record<string, string>>>({})
  const [activeLang, setActiveLang] = useState<string>('')

  /* ── 字典选项 ──────────────────────────────────────────────────────────── */
  const channelTypeOptions = useMemo(() => mapDictChildrenToOptions(findDictNodeByCode(dictTree, 'Channel_type')), [dictTree])
  const audioTypeOptions = useMemo(() => mapDictChildrenToOptions(findDictNodeByCode(dictTree, 'AudioType')), [dictTree])
  const ratingLevelOptions = useMemo(() => mapDictChildrenToOptions(findDictNodeByCode(dictTree, 'RatingLevel')), [dictTree])
  const languageOptionsFromDict = useMemo(() => mapDictChildrenToOptions(findDictNodeByCode(dictTree, 'Language')), [dictTree])

  /* ── 自定义字段过滤 ─────────────────────────────────────────────────────── */
  const channelCustomFields = useMemo(
    () => customFields.filter((f) => f.belongings.includes('ALL') || f.belongings.includes('Channel')),
    [customFields],
  )
  const multiLanguageCustomFields = useMemo(
    () => channelCustomFields.filter((f) => f.multi_language),
    [channelCustomFields],
  )

  /* ── 加载数据 ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!open || !channelId) return
    setLoading(true)
    void (async () => {
      try {
        const [meta, genreRes, customTagRes, dictRes, fieldsRes, langsRes, contentDetail] = await Promise.all([
          getChannelMetadata(channelId),
          getGenres({ page: 1, page_size: 200 }),
          getCustomTags({ page: 1, page_size: 200 }),
          getDictTree(),
          getCustomFields({ page: 1, page_size: 200, belongings: ['ALL', 'Channel'] }),
          getMultiLanguageOptions(),
          getContent(channelId),  // ✅ 获取主表数据（包含 custom_tag_ids 和 genre_id）
        ])

        setMetadata(meta)
        setGenres(genreRes.items)
        setCustomTags(customTagRes.items)
        setDictTree(dictRes)
        setCustomFields(fieldsRes.items)
        setLanguageOptions(langsRes)

        if (langsRes.length > 1) {
          setActiveLang(langsRes[1].code)
        } else if (langsRes.length > 0) {
          setActiveLang(langsRes[0].code)
        }

        // 加载自定义字段值和多语言值
        const [savedFields, savedI18n] = await Promise.all([
          getContentFieldValues(channelId),
          getContentI18n(channelId),
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

        // ✅ 从主表获取 genre_id 和 custom_tag_ids
        const contentGenreId = contentDetail?.content?.genre_id ?? undefined
        const contentCustomTagIds = contentDetail?.content?.custom_tag_ids ?? []

        // 初始化表单
        form.setFieldsValue({
          channel_name: meta?.name ?? channelName,
          genre_id: contentGenreId,  // ✅ 从主表获取
          custom_tag_ids: contentCustomTagIds,  // ✅ 从主表获取
          channel_number: meta?.channel_number ?? undefined,
          description: meta?.description ?? '',
          channel_type: meta?.channel_type ?? undefined,
          audio_type: meta?.audio_type ?? undefined,
          rating_level: meta?.rating_level ?? undefined,
          audio_lang: meta?.audio_lang ?? [],
          subtitle_lang: meta?.subtitle_lang ?? [],
          status_flag: meta?.status_flag ?? true,
          ppv_enable: meta?.ppv_enable ?? false,
          npvr_enable: meta?.npvr_enable ?? false,
          fingerprint_enable: meta?.fingerprint_enable ?? false,
          watermark_enable: meta?.watermark_enable ?? false,
        })
      } catch (err) {
        if (isHandledError(err)) return
        void message.error(t('live.channel.msg.metadataLoadFailed'), 5)
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, channelId])

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

      // ✅ 分离 custom_tag_ids 和 genre_id，不保存到元数据表
      const { custom_tag_ids, genre_id, ...otherValues } = values

      const payload = {
        name: otherValues.channel_name,
        // genre_id 和 custom_tag_ids 已移除，不再保存到元数据表
        channel_number: otherValues.channel_number,
        description: otherValues.description || undefined,
        channel_type: otherValues.channel_type || undefined,
        audio_type: otherValues.audio_type || undefined,
        rating_level: otherValues.rating_level || undefined,
        audio_lang: otherValues.audio_lang?.length ? otherValues.audio_lang : undefined,
        subtitle_lang: otherValues.subtitle_lang?.length ? otherValues.subtitle_lang : undefined,
        status_flag: otherValues.status_flag,
        ppv_enable: otherValues.ppv_enable,
        npvr_enable: otherValues.npvr_enable,
        fingerprint_enable: otherValues.fingerprint_enable,
        watermark_enable: otherValues.watermark_enable,
      }

      if (metadata) {
        // 更新
        await updateChannelMetadata(channelId, payload as ChannelMetadataUpdate)
      } else {
        // 创建（需要提供必需的 call_sign / start_time / end_time）
        await createChannelMetadata(channelId, {
          content_id: channelId,
          call_sign: otherValues.channel_name,
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
          ...payload,
        } as ChannelMetadataCreate)
      }

      // ✅ 更新主表的 genre_id 和 custom_tag_ids
      await updateContent(channelId, {
        genre_id: genre_id,
        custom_tag_ids: custom_tag_ids?.length ? custom_tag_ids : undefined,
      })

      // 保存自定义字段值
      const fieldPayload = {
        values: Object.entries(fieldValues)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([custom_field_id, value]) => ({ custom_field_id: Number(custom_field_id), value })),
      }
      await saveContentFieldValues(channelId, fieldPayload)

      // 保存多语言值（默认语言只保存 cf_ 自定义字段，其余已在主表保存）
      for (const [lang, fields] of Object.entries(i18nValues)) {
        const nonEmptyFields: Record<string, string> = {}
        Object.entries(fields).forEach(([k, v]) => {
          if (lang === defaultLang && !k.startsWith('cf_')) return
          if (v !== undefined && v !== null && v !== '') nonEmptyFields[k] = v
        })
        if (Object.keys(nonEmptyFields).length > 0) {
          await saveContentI18n(channelId, { language: lang, fields: nonEmptyFields })
        }
      }

      void message.success(t('live.channel.msg.metadataSaved'), 3)
      onSuccess()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('live.channel.msg.metadataSaveFailed'), 5)
    } finally {
      setSaving(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, metadata, fieldValues, i18nValues, form, onSuccess])

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
  const watchedChannelName = Form.useWatch('channel_name', form)
  const watchedDescription = Form.useWatch('description', form)
  const watchedGenreId = Form.useWatch('genre_id', form)

  useEffect(() => {
    if (!defaultLang || loading) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setI18nValues((prev) => {
      const langValues = { ...(prev[defaultLang] ?? {}) }
      let changed = false
      if (watchedChannelName !== undefined && watchedChannelName !== null) {
        langValues['channel_name'] = String(watchedChannelName)
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
      if (!changed) return prev
      return { ...prev, [defaultLang]: langValues }
    })
  }, [watchedChannelName, watchedDescription, watchedGenreId, defaultLang, loading])

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
      label: t('metadata.tab.main'),
      children: (
        <Form form={form} layout="vertical" autoComplete="off" disabled={readOnly}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="channel_name"
                label={t('metadata.channel.channelName')}
                rules={[{ required: true, message: t('metadata.channel.channelNameRequired') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
              >
                <TrimInput />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={t('metadata.channel.contentName')}>
                <TrimInput value={channelName} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={t('metadata.channel.contentType')}>
                <TrimInput value={contentType} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="channel_number" label={t('metadata.channel.channelNumber')}>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="genre_id"
                label={t('metadata.channel.genre')}
                rules={[{ required: true, message: t('metadata.channel.genreRequired') }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  allowClear
                  placeholder={t('metadata.channel.genrePlaceholder')}
                  options={genres.map((g) => ({ label: g.name, value: g.id }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="custom_tag_ids" label={t('metadata.channel.customTags')}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  mode="multiple"
                  allowClear
                  placeholder={t('metadata.channel.customTagsPlaceholder')}
                  options={customTags.map((tag) => ({ label: tag.name, value: tag.id }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="status_flag" label={t('metadata.channel.status')} valuePropName="checked">
                <Switch checkedChildren="YES" unCheckedChildren="NO" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="channel_type" label={t('metadata.channel.type')}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  allowClear
                  placeholder={t('metadata.channel.typePlaceholder')}
                  options={channelTypeOptions}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="audio_type" label={t('metadata.channel.audioType')}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  allowClear
                  placeholder={t('metadata.channel.audioTypePlaceholder')}
                  options={audioTypeOptions}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="rating_level" label={t('metadata.channel.ratingLevel')}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  allowClear
                  placeholder={t('metadata.channel.ratingLevelPlaceholder')}
                  options={ratingLevelOptions}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="audio_lang" label={t('metadata.channel.audioLang')}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  mode="multiple"
                  allowClear
                  placeholder={t('metadata.channel.audioLangPlaceholder')}
                  options={languageOptionsFromDict}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="subtitle_lang" label={t('metadata.channel.subtitleLang')}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  mode="multiple"
                  allowClear
                  placeholder={t('metadata.channel.subtitleLangPlaceholder')}
                  options={languageOptionsFromDict}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="ppv_enable" label={t('metadata.channel.ppvEnable')} valuePropName="checked">
                <Switch checkedChildren="YES" unCheckedChildren="NO" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="npvr_enable" label={t('metadata.channel.npvrEnable')} valuePropName="checked">
                <Switch checkedChildren="YES" unCheckedChildren="NO" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="fingerprint_enable" label={t('metadata.channel.fingerprintEnable')} valuePropName="checked">
                <Switch checkedChildren="YES" unCheckedChildren="NO" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="watermark_enable" label={t('metadata.channel.watermarkEnable')} valuePropName="checked">
                <Switch checkedChildren="YES" unCheckedChildren="NO" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="description" label={t('metadata.channel.description')} rules={[formRules.maxLength(FORM_MAX_LENGTH.TEXT_AREA)]}>
                <TrimInput.TextArea rows={3} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      ),
    },
    {
      key: 'customFields',
      label: t('metadata.tab.customFields'),
      children: (
        <fieldset disabled={readOnly} style={{ border: 'none', padding: 0, margin: 0 }}>
          {channelCustomFields.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
              {t('metadata.customFields.empty')}
            </div>
          ) : (
            <Row gutter={16}>
              {channelCustomFields.map((field) => (
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
        </fieldset>
      ),
    },
    {
      key: 'multiLanguages',
      label: t('metadata.tab.multiLanguages'),
      children: (
        <fieldset disabled={readOnly} style={{ border: 'none', padding: 0, margin: 0 }}>
        <Row gutter={16}>
          {/* 左侧语言列表 */}
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
                    disabled={readOnly}
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

          {/* 右侧表单 */}
          <Col span={16}>
            {activeLang && (
              <div>
                <div style={{ marginBottom: 16, fontWeight: 600 }}>
                  {t('metadata.multiLang.languageLabel')}: {languageOptions.filter((l) => l.code !== defaultLang).find((l) => l.code === activeLang)?.name ?? activeLang}
                </div>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label={t('metadata.channel.channelName')}>
                      <TrimInput
                        value={i18nValues[activeLang]?.['channel_name'] ?? ''}
                        onChange={(e) => updateI18nValue(activeLang, 'channel_name', e.target.value)}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label={t('metadata.channel.description')}>
                      <TrimInput.TextArea
                        rows={3}
                        value={i18nValues[activeLang]?.['description'] ?? ''}
                        onChange={(e) => updateI18nValue(activeLang, 'description', e.target.value)}
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
        </fieldset>
      ),
    },
  ]

  return (
    <Modal
      open={open}
      title={t('metadata.channel.title')}
      width={900}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          {!readOnly && (
            <Button type="primary" loading={saving} onClick={() => void handleSave()}>
              {t('common.confirm')}
            </Button>
          )}
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
