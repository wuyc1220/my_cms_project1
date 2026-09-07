import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Col,
  Form,
  Modal,
  Row,
  Spin,
  Tabs,
  message,
} from 'antd'
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
import { useSensitiveCheck } from '../hooks/useSensitiveCheck'
import CustomFieldControl from './CustomFieldControl'
import { getFieldOptionLabel, formatApiValue, getCustomFieldPlaceholder, validateCustomFields as validateCustomFieldsUtil, clearFieldError } from '../utils/customField'
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

export default function CastFormModal({
  open,
  mode,
  castId,
  onClose,
  onSuccess,
}: CastFormModalProps) {
  const { t, language } = useI18n()
  const { checkSensitive } = useSensitiveCheck()
  const formRules = useFormRules()
  const [itemForm] = Form.useForm<MainFormValues>()

  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('main')
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<number, Record<string, string>>>({})

  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldListItem[]>([])
  const [fieldValues, setFieldValues] = useState<FieldValueMap>({})
  const [i18nValues, setI18nValues] = useState<I18nValueMap>({})
  const [dataLoading, setDataLoading] = useState(false)

  const defaultLang = languageOptions[0]?.code ?? ''
  const languageOrder = useMemo(() => languageOptions.map((l) => l.code), [languageOptions])
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
    setCustomFieldErrors((prev) => clearFieldError(prev, fieldId, '_main'))
  }

  const updateI18nValue = (lang: string, fieldName: string, value: string) => {
    setI18nValues((prev) => ({
      ...prev,
      [lang]: { ...(prev[lang] ?? {}), [fieldName]: value },
    }))
    const field = customFieldItems.find((f) => f.field_code === fieldName && f.multi_language)
    if (field) {
      setCustomFieldErrors((prev) => clearFieldError(prev, field.id, lang))
    }
  }

  const clearLanguageValues = (lang: string) => {
    setI18nValues((prev) => ({ ...prev, [lang]: {} }))
  }

  const buildFieldValuePayload = () =>
    customFieldItems.filter((field) => !field.multi_language).map((field) => ({ custom_field_id: field.id, value: fieldValues[field.id] ?? '' }))

  const handleSubmit = async () => {
    const mainFieldNames = ['name', 'description']

    const doValidateCustomFields = () => {
      const errors = validateCustomFieldsUtil(customFieldItems, fieldValues, i18nValues, t, defaultLang)
      setCustomFieldErrors(errors)
      return Object.values(errors).every((langErrors) => Object.keys(langErrors).length === 0)
    }

    const validateCurrentTab = () => {
      if (activeTab === 'main') {
        return itemForm.validateFields(mainFieldNames).then(() => true, () => false)
      }
      if (activeTab === 'custom-fields') {
        return Promise.resolve(doValidateCustomFields())
      }
      return Promise.resolve(true)
    }

    const validateOtherTab = () => {
      if (activeTab === 'main') {
        if (!doValidateCustomFields()) return Promise.resolve('custom-fields')
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
      // 敏感词预校验：检查 name、description、自定义字段、多语言数据
      const checkData: Record<string, unknown> = {
        name: values.name,
        description: values.description ?? null,
        fieldValues: buildFieldValuePayload(),
        i18nValues,
      }
      const ok = await checkSensitive(checkData)
      if (!ok) return

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
    const targetLang = inMultiLanguage ? (langCode ?? activeLang) : defaultLang
    const rawValue = inMultiLanguage
      ? (i18nValues[targetLang]?.[field.field_code] ?? '')
      : (fieldValues[field.id] ?? '')

    const options = field.options.map((item) => ({
      label: getFieldOptionLabel(field, item.code, inMultiLanguage ? targetLang : (defaultLang || undefined), languageOrder),
      value: item.code,
    }))

    const placeholder = getCustomFieldPlaceholder(field, t)

    const handleChange = (val: unknown) => {
      const strVal = formatApiValue(field.field_type, val)
      if (inMultiLanguage) {
        updateI18nValue(targetLang, field.field_code, strVal)
      } else {
        updateFieldValue(field.id, strVal)
      }
    }

    return (
      <CustomFieldControl
        fieldType={field.field_type}
        options={options}
        placeholder={placeholder}
        value={rawValue}
        onChange={handleChange}
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
      width={'60%'}
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
              <Form layout="vertical">
                <Row gutter={16}>
                  {customFieldItems.length === 0 ? (
                    <Col span={24}>{t('cast.modal.noCustomFields')}</Col>
                  ) : (
                    customFieldItems.map((field) => {
                      const errorKey = field.multi_language ? defaultLang : '_main'
                      return (
                      <Col span={12} key={field.id}>
                        <Form.Item
                          label={field.field_name}
                          required={field.mandatory}
                          tooltip={field.tip ?? undefined}
                          validateStatus={customFieldErrors[field.id]?.[errorKey] ? 'error' : ''}
                          help={customFieldErrors[field.id]?.[errorKey] || ''}
                        >
                          {renderCustomFieldInput(field, field.multi_language, defaultLang)}
                        </Form.Item>
                      </Col>
                      )
                    })
                  )}
                </Row>
              </Form>
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
                  <Form layout="vertical">
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
                            validateStatus={customFieldErrors[field.id]?.[activeLang] ? 'error' : ''}
                            help={customFieldErrors[field.id]?.[activeLang] || ''}
                          >
                            {renderCustomFieldInput(field, true)}
                          </Form.Item>
                        </Col>
                      ))}
                    </Row>
                  </Form>
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </Modal>
  )
}
