import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Col,
  DatePicker,
  Form,
  InputNumber,
  Modal,
  Row,
  Select,
  Spin,
  Tabs,
  TimePicker,
  message,
} from 'antd'
import dayjs from 'dayjs'
import {
  createCast,
  getCast,
  getCastFieldValues,
  getCastI18n,
  saveCastFieldValues,
  saveCastI18n,
  updateCast,
} from '../api/casts'
import { getCustomFields } from '../api/customFields'
import { getMultiLanguageOptions } from '../api/i18n'
import TrimInput from './TrimInput'
import { useI18n } from '../i18n/useI18n'
import type {
  CastListItem,
  CustomFieldListItem,
  EntityFieldValueItem,
} from '../types/basic'
import type { LanguageOption } from '../types/i18n'
import { useFormRules } from '../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../constants/form'
import { isHandledError } from '../api'

interface CastFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  castId?: number
  onClose: () => void
  onSuccess?: (cast: CastListItem) => void
}

interface MainFormValues {
  name: string
  description?: string
}

type FieldValueMap = Record<number, string>
type I18nValueMap = Record<string, Record<string, string>>

const isMultiSelectField = (fieldType: string) => fieldType === 'DropList_multiple'
const isSelectField = (fieldType: string) => fieldType === 'DropList' || fieldType === 'DropList_multiple'
const isLongTextField = (fieldType: string) => fieldType === 'LongText'
const isNumberField = (fieldType: string) => fieldType === 'Integer' || fieldType === 'Decimal'
const isDateField = (fieldType: string) => fieldType === 'Date'
const isTimeField = (fieldType: string) => fieldType === 'Time'
const isDateTimeField = (fieldType: string) => fieldType === 'Date+Time'

const getFieldOptionLabel = (field: CustomFieldListItem, optionCode: string, preferredLanguage?: string) => {
  const option = field.options.find((item) => item.code === optionCode)
  if (!option) return optionCode
  return option.names[preferredLanguage ?? ''] ?? option.names.default ?? Object.values(option.names)[0] ?? option.code
}

export default function CastFormModal({
  open,
  mode,
  castId,
  onClose,
  onSuccess,
}: CastFormModalProps) {
  const { t, language } = useI18n()
  const formRules = useFormRules()
  const [itemForm] = Form.useForm<MainFormValues>()

  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('main')
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<number, string>>({})

  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldListItem[]>([])
  const [fieldValues, setFieldValues] = useState<FieldValueMap>({})
  const [i18nValues, setI18nValues] = useState<I18nValueMap>({})
  const [dataLoading, setDataLoading] = useState(false)

  const defaultLang = languageOptions[0]?.code ?? ''
  const otherLanguageOptions = useMemo(
    () => languageOptions.filter((l) => l.code !== defaultLang),
    [languageOptions, defaultLang]
  )
  const [activeLang, setActiveLang] = useState('')

  const customFieldItems = useMemo(
    () => customFields.filter((item) => item.belongings.includes('ALL') || item.belongings.includes('Cast')),
    [customFields]
  )

  const multiLanguageFields = useMemo(
    () => customFieldItems.filter((item) => item.multi_language),
    [customFieldItems]
  )

  const inputPlaceholder = (name: string) => language === 'cn' ? `请输入${name}` : `Enter ${name}`
  const selectPlaceholder = (name: string) => language === 'cn' ? `请选择${name}` : `Select ${name}`

  const prevOpenRef = useRef(false)

  const resetExtraState = useCallback(() => {
    setFieldValues({})
    const nextI18n: I18nValueMap = {}
    languageOptions.forEach((lang) => { nextI18n[lang.code] = {} })
    setI18nValues(nextI18n)
    setActiveLang(otherLanguageOptions[0]?.code ?? '')
  }, [languageOptions, otherLanguageOptions])

  const loadEditData = useCallback(async (id: number) => {
    setDataLoading(true)
    try {
      const [castData, savedFields, savedI18n] = await Promise.all([
        getCast(id),
        getCastFieldValues(id),
        getCastI18n(id),
      ])

      itemForm.setFieldsValue({
        name: castData.name,
        description: castData.description ?? undefined,
      })

      const nextFieldValues: FieldValueMap = {}
      savedFields.forEach((item: EntityFieldValueItem) => {
        nextFieldValues[item.custom_field_id] = item.value ?? ''
      })
      setFieldValues(nextFieldValues)

      const nextI18n: I18nValueMap = {}
      languageOptions.forEach((lang) => { nextI18n[lang.code] = {} })
      savedI18n.forEach((item) => {
        if (!nextI18n[item.language]) nextI18n[item.language] = {}
        nextI18n[item.language][item.field_name] = item.value ?? ''
      })
      setI18nValues(nextI18n)
    } catch (err) {
      if (isHandledError(err)) return
      console.error('Failed to load cast field values:', err)
    } finally {
      setDataLoading(false)
    }
  }, [languageOptions, itemForm])

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setActiveTab('main')
      itemForm.resetFields()
      setCustomFieldErrors({})
      resetExtraState()
      setDataLoading(mode === 'edit' && !!castId)

      if (mode === 'edit' && castId) {
        queueMicrotask(() => {
          void loadEditData(castId)
        })
      }
    }
    prevOpenRef.current = open
  }, [open, mode, castId, itemForm, resetExtraState, loadEditData])

  useEffect(() => {
    void (async () => {
      const [langs, fields] = await Promise.all([
        getMultiLanguageOptions(),
        getCustomFields({ page: 1, page_size: 200, belongings: ['ALL', 'Cast'] }),
      ])
      setLanguageOptions(langs)
      setActiveLang(langs.length > 1 ? langs[1].code : (langs[0]?.code ?? ''))
      setCustomFields(fields.items)
    })()
  }, [])

  const updateFieldValue = (fieldId: number, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }))
    setCustomFieldErrors((prev) => {
      if (prev[fieldId]) {
        const next = { ...prev }
        delete next[fieldId]
        return next
      }
      return prev
    })
  }

  const updateI18nValue = (lang: string, fieldName: string, value: string) => {
    setI18nValues((prev) => ({
      ...prev,
      [lang]: { ...(prev[lang] ?? {}), [fieldName]: value },
    }))
    const field = customFieldItems.find((f) => f.field_code === fieldName && f.multi_language)
    if (field) {
      setCustomFieldErrors((prev) => {
        if (prev[field.id]) {
          const next = { ...prev }
          delete next[field.id]
          return next
        }
        return prev
      })
    }
  }

  const clearLanguageValues = (lang: string) => {
    setI18nValues((prev) => ({ ...prev, [lang]: {} }))
  }

  const validateCustomFields = () => {
    const errors: Record<number, string> = {}
    for (const field of customFieldItems) {
      if (!field.mandatory) continue
      if (field.multi_language) {
        const hasValue = Object.values(i18nValues).some((langMap) => (langMap[field.field_code] ?? '').trim())
        if (!hasValue) {
          errors[field.id] = language === 'cn' ? `请填写${field.field_name}` : `Please fill in ${field.field_name}`
        }
      } else {
        if (!(fieldValues[field.id] ?? '').trim()) {
          errors[field.id] = language === 'cn' ? `请填写${field.field_name}` : `Please fill in ${field.field_name}`
        }
      }
    }
    setCustomFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const buildFieldValuePayload = () =>
    customFieldItems.filter((field) => !field.multi_language).map((field) => ({ custom_field_id: field.id, value: fieldValues[field.id] ?? '' }))

  const handleSubmit = async () => {
    const mainFieldNames = ['name', 'description']

    const validateCurrentTab = () => {
      if (activeTab === 'main') {
        return itemForm.validateFields(mainFieldNames).then(() => true, () => false)
      }
      if (activeTab === 'custom-fields') {
        return Promise.resolve(validateCustomFields())
      }
      return Promise.resolve(true)
    }

    const validateOtherTab = () => {
      if (activeTab === 'main') {
        if (!validateCustomFields()) return Promise.resolve('custom-fields')
        return Promise.resolve(null)
      }
      if (activeTab === 'custom-fields') {
        return itemForm.validateFields(mainFieldNames).then(
          () => null,
          () => 'main'
        )
      }
      return Promise.resolve(null)
    }

    const currentOk = await validateCurrentTab()
    if (!currentOk) return

    const otherTabError = await validateOtherTab()
    if (otherTabError) {
      setActiveTab(otherTabError)
      return
    }

    const values = await itemForm.validateFields(mainFieldNames)

    setSubmitting(true)
    try {
      let castIdResult = 0
      let result: CastListItem

      if (mode === 'edit' && castId) {
        const payload = {
          name: values.name,
          description: values.description ?? null,
        }
        result = await updateCast(castId, payload)
        castIdResult = result.id
        void message.success(t('cast.msg.updated'), 3)
      } else {
        const payload = {
          name: values.name,
          description: values.description ?? null,
        }
        result = await createCast(payload)
        castIdResult = result.id
        void message.success(t('cast.msg.created'), 3)
      }

      await saveCastFieldValues(castIdResult, { values: buildFieldValuePayload() })
      const i18nSaveTasks = otherLanguageOptions.map((lang) =>
        saveCastI18n(castIdResult, { language: lang.code, fields: i18nValues[lang.code] ?? {} })
      )
      if (defaultLang) {
        const defaultLangFields: Record<string, string> = {}
        multiLanguageFields.forEach((field) => {
          const val = i18nValues[defaultLang]?.[field.field_code] ?? ''
          if (val) defaultLangFields[field.field_code] = val
        })
        if (Object.keys(defaultLangFields).length > 0) {
          i18nSaveTasks.push(
            saveCastI18n(castIdResult, { language: defaultLang, fields: defaultLangFields })
          )
        }
      }
      await Promise.all(i18nSaveTasks)

      onSuccess?.(result)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('metadataSource.msg.operationFailed'), 5)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    onClose()
  }

  const renderCustomFieldInput = (field: CustomFieldListItem, inMultiLanguage = false, langCode?: string) => {
    if (inMultiLanguage) {
      const targetLang = langCode ?? activeLang
      const value = i18nValues[targetLang]?.[field.field_code] ?? ''
      if (isSelectField(field.field_type)) {
        if (isMultiSelectField(field.field_type)) {
          const selected = value ? value.split(',').filter(Boolean) : []
          return (
            <Select
              showSearch
              optionFilterProp="label"
              mode="multiple"
              allowClear
              value={selected}
              placeholder={field.tip ?? selectPlaceholder(field.field_name)}
              options={field.options.map((item) => ({
                label: item.names[targetLang] ?? item.names.default ?? Object.values(item.names)[0] ?? item.code,
                value: item.code,
              }))}
              onChange={(vals) => updateI18nValue(targetLang, field.field_code, vals.join(','))}
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
            placeholder={field.tip ?? selectPlaceholder(field.field_name)}
            options={field.options.map((item) => ({
              label: item.names[targetLang] ?? item.names.default ?? Object.values(item.names)[0] ?? item.code,
              value: item.code,
            }))}
            onChange={(val) => updateI18nValue(targetLang, field.field_code, val ?? '')}
            style={{ width: '100%' }}
          />
        )
      }
      if (isLongTextField(field.field_type)) {
        return (
          <TrimInput.TextArea
            rows={3}
            value={value}
            placeholder={field.tip ?? inputPlaceholder(field.field_name)}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateI18nValue(targetLang, field.field_code, e.target.value)}
          />
        )
      }
      if (isNumberField(field.field_type)) {
        return (
          <InputNumber
            style={{ width: '100%' }}
            value={value === '' ? undefined : Number(value)}
            placeholder={field.tip ?? inputPlaceholder(field.field_name)}
            onChange={(val) => updateI18nValue(targetLang, field.field_code, val == null ? '' : String(val))}
          />
        )
      }
      if (isDateField(field.field_type)) {
        return (
          <DatePicker
            style={{ width: '100%' }}
            value={value ? dayjs(value) : undefined}
            placeholder={field.tip ?? selectPlaceholder(field.field_name)}
            onChange={(_, dateString) => updateI18nValue(targetLang, field.field_code, typeof dateString === 'string' ? dateString : '')}
          />
        )
      }
      if (isTimeField(field.field_type)) {
        return (
          <TimePicker
            style={{ width: '100%' }}
            value={value ? dayjs(value, 'HH:mm:ss') : undefined}
            placeholder={field.tip ?? selectPlaceholder(field.field_name)}
            onChange={(_, timeString) => updateI18nValue(targetLang, field.field_code, typeof timeString === 'string' ? timeString : '')}
          />
        )
      }
      if (isDateTimeField(field.field_type)) {
        return (
          <DatePicker
            showTime
            style={{ width: '100%' }}
            format="YYYY-MM-DD HH:mm:ss"
            value={value ? dayjs(value) : undefined}
            placeholder={field.tip ?? selectPlaceholder(field.field_name)}
            onChange={(_, dateString) => updateI18nValue(targetLang, field.field_code, typeof dateString === 'string' ? dateString : '')}
          />
        )
      }
      return (
        <TrimInput
          value={value}
          placeholder={field.tip ?? inputPlaceholder(field.field_name)}
          onChange={(e) => updateI18nValue(targetLang, field.field_code, e.target.value)}
        />
      )
    }

    const value = fieldValues[field.id] ?? ''
    if (isSelectField(field.field_type)) {
      if (isMultiSelectField(field.field_type)) {
        const selected = value ? value.split(',').filter(Boolean) : []
        return (
          <Select
            showSearch
            optionFilterProp="label"
            mode="multiple"
            allowClear
            value={selected}
            placeholder={field.tip ?? selectPlaceholder(field.field_name)}
            options={field.options.map((item) => ({
              label: getFieldOptionLabel(field, item.code, defaultLang || undefined),
              value: item.code,
            }))}
            onChange={(vals) => updateFieldValue(field.id, vals.join(','))}
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
          placeholder={field.tip ?? selectPlaceholder(field.field_name)}
          options={field.options.map((item) => ({
            label: getFieldOptionLabel(field, item.code, defaultLang || undefined),
            value: item.code,
          }))}
          onChange={(val) => updateFieldValue(field.id, val ?? '')}
          style={{ width: '100%' }}
        />
      )
    }
    if (isLongTextField(field.field_type)) {
      return (
        <TrimInput.TextArea
          rows={3}
          value={value}
          placeholder={field.tip ?? inputPlaceholder(field.field_name)}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateFieldValue(field.id, e.target.value)}
        />
      )
    }
    if (isNumberField(field.field_type)) {
      return (
        <InputNumber
          style={{ width: '100%' }}
          value={value === '' ? undefined : Number(value)}
          placeholder={field.tip ?? inputPlaceholder(field.field_name)}
          onChange={(val) => updateFieldValue(field.id, val == null ? '' : String(val))}
        />
      )
    }
    if (isDateField(field.field_type)) {
      return (
        <DatePicker
          style={{ width: '100%' }}
          value={value ? dayjs(value) : undefined}
          placeholder={field.tip ?? selectPlaceholder(field.field_name)}
          onChange={(_, dateString) => updateFieldValue(field.id, typeof dateString === 'string' ? dateString : '')}
        />
      )
    }
    if (isTimeField(field.field_type)) {
      return (
        <TimePicker
          style={{ width: '100%' }}
          value={value ? dayjs(value, 'HH:mm:ss') : undefined}
          placeholder={field.tip ?? selectPlaceholder(field.field_name)}
          onChange={(_, timeString) => updateFieldValue(field.id, typeof timeString === 'string' ? timeString : '')}
        />
      )
    }
    if (isDateTimeField(field.field_type)) {
      return (
        <DatePicker
          showTime
          style={{ width: '100%' }}
          format="YYYY-MM-DD HH:mm:ss"
          value={value ? dayjs(value) : undefined}
          placeholder={field.tip ?? selectPlaceholder(field.field_name)}
          onChange={(_, dateString) => updateFieldValue(field.id, typeof dateString === 'string' ? dateString : '')}
        />
      )
    }
    return (
      <TrimInput
        value={value}
        placeholder={field.tip ?? inputPlaceholder(field.field_name)}
        onChange={(e) => updateFieldValue(field.id, e.target.value)}
      />
    )
  }

  return (
    <Modal
      title={mode === 'edit' ? t('cast.modal.titleEdit') : t('cast.modal.titleCreate')}
      open={open}
      onCancel={handleClose}
      onOk={() => void handleSubmit()}
      confirmLoading={submitting}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      width={920}
      destroyOnHidden
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'main',
            label: t('cast.modal.tabMain'),
            forceRender: true,
            children: (
              <Form form={itemForm} layout="vertical">
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item
                      name="name"
                      label={t('cast.modal.castNameLabel')}
                      rules={[
                        { required: true, message: t('cast.modal.castNameRequired') },
                        formRules.maxLength(FORM_MAX_LENGTH.INPUT),
                      ]}
                    >
                      <TrimInput placeholder={language === 'cn' ? '请输入人物名称' : 'Enter Cast Name'} />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item
                      name="description"
                      label={t('cast.modal.descriptionLabel')}
                      rules={[formRules.maxLength(FORM_MAX_LENGTH.TEXT_AREA)]}
                    >
                      <TrimInput.TextArea
                        rows={4}
                        placeholder={language === 'cn' ? '请输入描述' : 'Enter description'}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            ),
          },
          {
            key: 'custom-fields',
            label: t('cast.modal.tabCustomFields'),
            forceRender: true,
            children: dataLoading && mode === 'edit' ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
              </div>
            ) : (
              <Row gutter={16}>
                {customFieldItems.length === 0 ? (
                  <Col span={24}>{t('cast.modal.noCustomFields')}</Col>
                ) : (
                  customFieldItems.map((field) => (
                    <Col span={12} key={field.id}>
                      <Form.Item
                        label={field.field_name}
                        required={field.mandatory}
                        tooltip={field.tip ?? undefined}
                        validateStatus={customFieldErrors[field.id] ? 'error' : ''}
                        help={customFieldErrors[field.id] || ''}
                      >
                        {renderCustomFieldInput(field, field.multi_language, defaultLang)}
                      </Form.Item>
                    </Col>
                  ))
                )}
              </Row>
            ),
          },
          {
            key: 'multi-languages',
            label: t('cast.modal.tabMultiLanguages'),
            forceRender: true,
            children: dataLoading && mode === 'edit' ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
              </div>
            ) : otherLanguageOptions.length === 0 ? (
              <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>{t('content.metadata.noOtherLanguages')}</div>
            ) : (
              <Row gutter={16}>
                <Col span={6}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {otherLanguageOptions.map((lang) => (
                      <div
                        key={lang.code}
                        style={{
                          border: activeLang === lang.code ? '1px solid #1677ff' : '1px solid #d9d9d9',
                          borderRadius: 6,
                          padding: 10,
                          cursor: 'pointer',
                          background: activeLang === lang.code ? '#f0f7ff' : '#fff',
                        }}
                        onClick={() => setActiveLang(lang.code)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{lang.name}</span>
                          <Button
                            type="link"
                            danger
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation()
                              clearLanguageValues(lang.code)
                            }}
                          >
                            {t('category.form.clear')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Col>
                <Col span={18}>
                  <div style={{ marginBottom: 16, fontWeight: 500 }}>
                    {t('cast.modal.currentLanguage')}{otherLanguageOptions.find((item) => item.code === activeLang)?.name ?? activeLang}
                  </div>
                  <Row gutter={16}>
                    <Col span={24}>
                      <Form.Item label={t('cast.modal.castNameLabel')}>
                        <TrimInput
                          value={i18nValues[activeLang]?.name ?? ''}
                          placeholder={language === 'cn' ? '请输入人物名称' : 'Enter Cast Name'}
                          onChange={(e) => updateI18nValue(activeLang, 'name', e.target.value)}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item label={t('cast.modal.descriptionLabel')}>
                        <TrimInput.TextArea
                          rows={3}
                          value={i18nValues[activeLang]?.description ?? ''}
                          placeholder={language === 'cn' ? '请输入描述' : 'Enter description'}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateI18nValue(activeLang, 'description', e.target.value)}
                        />
                      </Form.Item>
                    </Col>
                    {multiLanguageFields.map((field) => (
                      <Col span={12} key={field.id}>
                        <Form.Item
                          label={field.field_name}
                          tooltip={field.tip ?? undefined}
                          validateStatus={customFieldErrors[field.id] ? 'error' : ''}
                          help={customFieldErrors[field.id] || ''}
                        >
                          {renderCustomFieldInput(field, true)}
                        </Form.Item>
                      </Col>
                    ))}
                  </Row>
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </Modal>
  )
}
