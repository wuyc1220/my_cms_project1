/**
 * PackageCreateModal — 服务包新增/编辑弹框
 *
 * 封装服务包管理页面的新建和编辑功能，支持自定义字段。
 * 可被 PackageManagement 列表页和 PackageLinkModal 等弹框复用。
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  Col,
  Form,
  Modal,
  Row,
  Select,
  Tabs,
  message,
  Button,
  Spin,
} from 'antd'
import {
  createPackage,
  getPackageFieldValues,
  getPackageI18n,
  savePackageFieldValues,
  savePackageI18n,
  updatePackage,
} from '../api/packages'
import { getCustomFields } from '../api/customFields'
import { getMultiLanguageOptions } from '../api/i18n'
import { useI18n } from '../i18n/useI18n'
import { useFormRules } from '../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../constants/form'
import TrimInput from './TrimInput'
import CustomFieldControl from './CustomFieldControl'
import { formatApiValue, getCustomFieldPlaceholder, getFieldOptionLabel, validateCustomFields as validateCustomFieldsUtil, clearFieldError } from '../utils/customField'
import type {
  PackageListItem,
  PackageCreatePayload,
  PackageUpdatePayload,
} from '../types/package'
import type { CustomFieldListItem, EntityFieldValueItem, EntityI18nItem } from '../types/basic'
import type { LanguageOption } from '../types/i18n'

// ─── 类型 ─────────────────────────────────────────────────────────────

interface MainFormValues {
  name: string
  package_type?: string | null
  platforms?: string[] | null
  description?: string
}

type FieldValueMap = Record<number, string>
type I18nValueMap = Record<string, Record<string, string>>

export interface PackageCreateModalProps {
  open: boolean
  editingRecord?: PackageListItem | null
  packageTypeOptions: { label: string; value: string }[]
  platformOptions: { label: string; value: string }[]
  /** 外部传入的自定义字段（可选，不传则内部自动加载） */
  customFields?: CustomFieldListItem[]
  /** 外部传入的语言选项（可选，不传则内部自动加载） */
  languageOptions?: LanguageOption[]
  onClose: () => void
  onSuccess?: () => void
}

export default function PackageCreateModal({
  open,
  editingRecord,
  packageTypeOptions,
  platformOptions,
  customFields: externalCustomFields,
  languageOptions: externalLanguageOptions,
  onClose,
  onSuccess,
}: PackageCreateModalProps) {
  const { t } = useI18n()
  const formRules = useFormRules()
  const [form] = Form.useForm<MainFormValues>()

  const [submitting, setSubmitting] = useState(false)
  const [customFields, setCustomFields] = useState<CustomFieldListItem[]>(
    externalCustomFields ?? [],
  )
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>(
    externalLanguageOptions ?? [],
  )
  const [fieldValues, setFieldValues] = useState<FieldValueMap>({})
  const [i18nValues, setI18nValues] = useState<I18nValueMap>({})
  const [dataLoading, setDataLoading] = useState(false)
  const [activeLang, setActiveLang] = useState('')
  const [activeTab, setActiveTab] = useState('main')
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<number, Record<string, string>>>({})
  const [isReady, setIsReady] = useState(false)

  // 使用 ref 存储最新的自定义字段和语言选项，避免 loadEditData 的闭包问题
  const customFieldsRef = useRef<CustomFieldListItem[]>([])
  const languageOptionsRef = useRef<LanguageOption[]>([])

  // 同步 ref 与状态
  useEffect(() => {
    customFieldsRef.current = customFields
  }, [customFields])

  useEffect(() => {
    languageOptionsRef.current = languageOptions
  }, [languageOptions])

  const isEdit = !!editingRecord
  const defaultLang = languageOptions[0]?.code ?? ''
  const otherLanguageOptions = useMemo(() => languageOptions.filter((l) => l.code !== defaultLang), [languageOptions, defaultLang])

  // 自定义字段候选项（仅 ALL 或 Package）
  const customFieldItems = useMemo(
    () =>
      customFields.filter(
        (f) => f.belongings.includes('ALL') || f.belongings.includes('Package'),
      ),
    [customFields],
  )

  // 多语言自定义字段
  const multiLanguageFields = useMemo(
    () => customFieldItems.filter((item) => item.multi_language),
    [customFieldItems],
  )

  const resetState = useCallback(() => {
    setFieldValues({})
    const nextI18n: I18nValueMap = {}
    languageOptionsRef.current.forEach((lang) => { nextI18n[lang.code] = {} })
    setI18nValues(nextI18n)
    const otherLangs = languageOptionsRef.current.filter((l) => l.code !== languageOptionsRef.current[0]?.code)
    setActiveLang(otherLangs[0]?.code ?? '')
    setCustomFieldErrors({})
  }, [])

  // 加载编辑数据
  const loadEditData = useCallback(async (packageId: number) => {
    if (!isReady) return
    setDataLoading(true)
    try {
      const [savedFields, savedI18n] = await Promise.all([
        getPackageFieldValues(packageId),
        getPackageI18n(packageId),
      ])

      const nextFieldValues: FieldValueMap = {}
      const nextI18n: I18nValueMap = {}

      // 使用 ref 获取最新的自定义字段和默认语言，避免闭包问题
      const currentCustomFields = customFieldsRef.current.filter(
        (f) => f.belongings.includes('ALL') || f.belongings.includes('Package'),
      )
      const currentDefaultLang = languageOptionsRef.current[0]?.code ?? ''

      // 初始化所有语言的 i18n 对象
      languageOptionsRef.current.forEach((lang) => { nextI18n[lang.code] = {} })

      // 处理保存的字段值
      savedFields.forEach((item: EntityFieldValueItem) => {
        nextFieldValues[item.custom_field_id] = item.value ?? ''
      })

      // 处理保存的 i18n 值
      savedI18n.forEach((item: EntityI18nItem) => {
        if (!nextI18n[item.language]) nextI18n[item.language] = {}
        nextI18n[item.language][item.field_name] = item.value ?? ''

        // 如果是多语言字段且是默认语言，同时设置到 fieldValues 中用于 Custom Fields 标签页显示
        const field = currentCustomFields.find(f => f.field_code === item.field_name && f.multi_language)
        if (field && item.language === currentDefaultLang && item.value) {
          nextFieldValues[field.id] = item.value
        }
      })

      // 兜底回填：multi_language 开关切换后，存量值可能仍留在另一张表中，双向回退保证回显不丢
      currentCustomFields.forEach((field) => {
        const mainValue = nextFieldValues[field.id] ?? ''
        if (field.multi_language) {
          // 多语言字段：i18n 默认语言无值时，回退取非多语言时期的存量值
          const mlValue = nextI18n[currentDefaultLang]?.[field.field_code] ?? ''
          if (!mlValue && mainValue) {
            nextI18n[currentDefaultLang] = { ...(nextI18n[currentDefaultLang] ?? {}), [field.field_code]: mainValue }
          }
        } else if (!mainValue) {
          // 非多语言字段：主值无值时，回退取多语言时期的存量值（默认语言优先，其次按语言顺序）
          const langOrder = languageOptionsRef.current.map((l) => l.code)
          const fallbackLang = langOrder.find((lang) => (nextI18n[lang]?.[field.field_code] ?? '').trim() !== '')
          if (fallbackLang) {
            nextFieldValues[field.id] = nextI18n[fallbackLang][field.field_code]
          }
        }
      })

      setFieldValues(nextFieldValues)
      setI18nValues(nextI18n)
    } catch {
      // 静默处理
    } finally {
      setDataLoading(false)
    }
  }, [isReady])

  // 初始化基础数据（自定义字段和语言选项）
  useEffect(() => {
    if (!open) {
      setTimeout(() => setIsReady(false), 0)
      return
    }

    const initData = async () => {
      const fieldsLoaded = externalCustomFields !== undefined
      const langsLoaded = externalLanguageOptions !== undefined

      if (!fieldsLoaded) {
        try {
          const fields = await getCustomFields({
            page: 1,
            page_size: 200,
            belongings: ['ALL', 'Package'],
          })
          setCustomFields(fields.items)
        } catch {
          setCustomFields([])
        }
      }

      if (!langsLoaded) {
        try {
          const langs = await getMultiLanguageOptions()
          setLanguageOptions(langs)
          setActiveLang(langs.length > 1 ? langs[1].code : (langs[0]?.code ?? ''))
        } catch {
          setLanguageOptions([])
        }
      }

      setIsReady(true)
    }

    void initData()
  }, [open, externalCustomFields, externalLanguageOptions])

  // 打开时初始化表单和数据
  useEffect(() => {
    if (!open || !isReady) return

    // 重置表单和字段值
    form.resetFields()
    setActiveTab('main')
    setTimeout(() => resetState(), 0)

    if (isEdit && editingRecord) {
      form.setFieldsValue({
        name: editingRecord.name,
        package_type: editingRecord.package_type ?? undefined,
        platforms: editingRecord.platforms ?? undefined,
        description: editingRecord.description ?? undefined,
      })
      // 加载已保存的自定义字段值和 i18n
      setTimeout(() => void loadEditData(editingRecord.id), 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isReady, editingRecord?.id])

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

  const handleSubmit = async () => {
    const mainFieldNames = ['name', 'package_type', 'platforms']

    const doValidateCustomFields = () => {
      const errors = validateCustomFieldsUtil(customFieldItems, fieldValues, i18nValues, t, defaultLang)
      setCustomFieldErrors(errors)
      return Object.values(errors).every((langErrors) => Object.keys(langErrors).length === 0)
    }

    const validateCurrentTab = () => {
      if (activeTab === 'main') {
        return form.validateFields(mainFieldNames).then(() => true, () => false)
      }
      if (activeTab === 'custom') {
        return Promise.resolve(doValidateCustomFields())
      }
      return Promise.resolve(true)
    }

    const validateOtherTab = () => {
      if (activeTab === 'main') {
        if (!doValidateCustomFields()) return Promise.resolve('custom')
        return Promise.resolve(null)
      }
      if (activeTab === 'custom') {
        return form.validateFields(mainFieldNames).then(
          () => null,
          () => 'main',
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

    const values = await form.validateFields()

    setSubmitting(true)
    try {
      let pkgId = editingRecord?.id ?? 0
      if (isEdit && editingRecord) {
        const payload: PackageUpdatePayload = {
          name: values.name,
          package_type: values.package_type ?? null,
          platforms: values.platforms ?? [],
          description: values.description ?? null,
        }
        const updated = await updatePackage(editingRecord.id, payload)
        pkgId = updated.id
        void message.success(t('package.msg.updated'), 3)
      } else {
        const payload: PackageCreatePayload = {
          name: values.name,
          package_type: values.package_type ?? null,
          platforms: values.platforms ?? [],
          description: values.description ?? null,
        }
        const created = await createPackage(payload)
        pkgId = created.id
        void message.success(t('package.msg.created'), 3)
      }

      await savePackageFieldValues(pkgId, {
        values: customFieldItems
          .filter((f) => !f.multi_language)
          .map((f) => ({
            custom_field_id: f.id,
            value: formatApiValue(f.field_type, fieldValues[f.id]),
          })),
      })

      // 保存多语言字段：默认语言存储在 i18n 中
      const i18nSaveTasks: Promise<EntityI18nItem[]>[] = []

      // 为每种语言保存多语言字段值
      if (multiLanguageFields.length > 0) {
        languageOptions.forEach((lang) => {
          const fields: Record<string, string> = {}
          multiLanguageFields.forEach((field) => {
            fields[field.field_code] = i18nValues[lang.code]?.[field.field_code] ?? ''
          })
          i18nSaveTasks.push(savePackageI18n(pkgId, { language: lang.code, fields }))
        })
      }

      await Promise.all(i18nSaveTasks)

      onSuccess?.()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  // 构建 Tabs 项
  const tabItems = [
    {
      key: 'main',
      label: t('package.tab.main'),
      forceRender: true,
      children: (
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label={t('package.form.name')}
                rules={[{ required: true, message: t('package.rule.nameRequired') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
              >
                <TrimInput
                  placeholder={t('package.placeholder.name')}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="package_type"
                label={t('package.form.type')}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  allowClear
                  placeholder={t('package.placeholder.type')}
                  options={packageTypeOptions}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="platforms"
                label={t('package.form.platform')}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  mode="multiple"
                  allowClear
                  placeholder={t('package.placeholder.platform')}
                  options={platformOptions}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="description" label={t('package.form.description')} rules={[formRules.maxLength(FORM_MAX_LENGTH.TEXT_AREA)]}>
                <TrimInput.TextArea
                  rows={3}
                  placeholder={t('package.placeholder.description')}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      ),
    },
    {
      key: 'custom',
      label: t('package.tab.customFields'),
      forceRender: true,
      children: dataLoading && isEdit ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Form layout="vertical">
          <Row gutter={16}>
            {customFieldItems.length === 0 ? (
              <Col span={24}>
                <div style={{ color: '#999', padding: '16px 0' }}>
                  {t('package.noCustomFields')}
                </div>
              </Col>
            ) : (
              customFieldItems.map((field) => {
                const isML = field.multi_language
                const preferredLang = isML ? (languageOptions[0]?.code ?? undefined) : undefined
                const errorKey = isML ? defaultLang : '_main'
                const langOrder = languageOptions.map((l) => l.code)
                const value = isML
                  ? (i18nValues[defaultLang]?.[field.field_code] ?? '')
                  : (fieldValues[field.id] ?? '')
                const handleChange = isML
                  ? (val: unknown) => updateI18nValue(defaultLang, field.field_code, formatApiValue(field.field_type, val))
                  : (val: unknown) => updateFieldValue(field.id, formatApiValue(field.field_type, val))

                return (
                  <Col key={field.id} span={12}>
                    <Form.Item
                      label={field.field_name}
                      required={field.mandatory}
                      tooltip={field.tip ?? undefined}
                      validateStatus={customFieldErrors[field.id]?.[errorKey] ? 'error' : ''}
                      help={customFieldErrors[field.id]?.[errorKey] || ''}
                    >
                      <CustomFieldControl
                        fieldType={field.field_type}
                        options={field.options.map((o) => ({
                          value: o.code,
                          label: getFieldOptionLabel(field, o.code, preferredLang, langOrder),
                        }))}
                        placeholder={getCustomFieldPlaceholder(field, t)}
                        value={value}
                        onChange={handleChange}
                      />
                    </Form.Item>
                  </Col>
                )
              })
            )}
          </Row>
        </Form>
      ),
    },
  ]

  // 如果有其他语言，添加 Multi Languages 标签页
  if (otherLanguageOptions.length > 0) {
    tabItems.push({
      key: 'multi-languages',
      label: t('package.tab.multiLanguages'),
      forceRender: true,
      children: dataLoading && isEdit ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
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
                      onClick={(e) => { e.stopPropagation(); clearLanguageValues(lang.code) }}
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
                {multiLanguageFields.map((field) => {
                  const value = i18nValues[activeLang]?.[field.field_code] ?? ''
                  const handleChange = (val: unknown) => updateI18nValue(activeLang, field.field_code, formatApiValue(field.field_type, val))

                  return (
                    <Col span={12} key={field.id}>
                      <Form.Item
                        label={field.field_name}
                        tooltip={field.tip ?? undefined}
                        validateStatus={customFieldErrors[field.id]?.[activeLang] ? 'error' : ''}
                        help={customFieldErrors[field.id]?.[activeLang] || ''}
                      >
                        <CustomFieldControl
                          fieldType={field.field_type}
                          options={field.options.map((o) => ({
                            value: o.code,
                            label: o.names[activeLang] ?? o.names[defaultLang] ?? Object.values(o.names)[0] ?? o.code,
                          }))}
                          placeholder={getCustomFieldPlaceholder(field, t)}
                          value={value}
                          onChange={handleChange}
                        />
                      </Form.Item>
                    </Col>
                  )
                })}
              </Row>
            </Form>
          </Col>
        </Row>
      ),
    })
  }

  return (
    <Modal
      title={isEdit ? t('package.modal.titleEdit') : t('package.modal.titleCreate')}
      open={open}
      onCancel={onClose}
      onOk={() => void handleSubmit()}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      confirmLoading={submitting}
      width={860}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
    </Modal>
  )
}
