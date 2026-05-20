import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Col,
  DatePicker,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  TimePicker,
  Tooltip,
  message,
} from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, InfoCircleOutlined, PictureOutlined, MenuOutlined, PlusOutlined, EditOutlined, DeleteOutlined, HolderOutlined, CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  createCategory,
  deleteCategory,
  getCategoryContents,
  getCategoryFieldValues,
  getCategoryI18n,
  getCategoryTree,
  reorderCategoryContents,
  saveCategoryFieldValues,
  saveCategoryI18n,
  updateCategory,
} from '../../api/categories'
import type { CategoryContentRow } from '../../api/categories'
import { getCustomFields } from '../../api/customFields'
import { getDictTree } from '../../api/dicts'
import { getMultiLanguageOptions } from '../../api/i18n'
import CategoryIngestHistoryModal from '../../components/CategoryIngestHistoryModal'
import PostersModal from '../../components/PostersModal'
import SearchForm from '../../components/SearchForm'
import TrimInput from '../../components/TrimInput'
import type {
  CategoryCreatePayload,
  CategoryListItem,
  CategoryUpdatePayload,
  CustomFieldListItem,
  EntityFieldValueItem,
} from '../../types/basic'
import type { DictNodeListItem } from '../../types/dict'
import type { LanguageOption } from '../../types/i18n'
import dayjs from 'dayjs'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useI18n } from '../../i18n/useI18n'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'
import { useFormRules } from '../../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../../constants/form'
import { isHandledError } from '../../api'


interface SearchValues {
  name?: string
  platforms?: string[]
  category_types?: string[]
  ingest_statuses?: string[]
}

interface FormValues {
  platform: string
  name: string
  sequence: number
  category_type?: string
  vod_count: number
  description?: string
  jump_category_code?: string
  status: boolean
}

type ModalMode = 'createRoot' | 'createChild' | 'edit'

interface ModalState {
  open: boolean
  mode: ModalMode
  record: CategoryRow | null
  parentId: number | null
  platform: string | null
}

interface PlatformRow {
  key: string
  rowType: 'platform'
  platform: string
  platformLabel: string
  children: CategoryRow[]
}

interface CategoryRow extends Omit<CategoryListItem, 'children'> {
  key: number
  rowType: 'category'
  children?: CategoryRow[]
}

type TreeRow = PlatformRow | CategoryRow

type FieldValueMap = Record<number, string>
type I18nValueMap = Record<string, Record<string, string>>

const CLOSED_MODAL: ModalState = { open: false, mode: 'createRoot', record: null, parentId: null, platform: null }

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

const getPlatformLabel = (platform: string, options: { label: string; value: string }[]) => {
  return options.find((item) => item.value === platform)?.label ?? platform
}

const mapCategoryRow = (node: CategoryListItem): CategoryRow => {
  const mappedChildren = node.children?.length ? node.children.map(mapCategoryRow) : []
  const { children: _, ...rest } = node
  const result: CategoryRow = {
    ...rest,
    key: node.id,
    rowType: 'category',
  }
  if (mappedChildren.length > 0) {
    result.children = mappedChildren
  }
  return result
}

const buildPlatformTree = (
  categories: CategoryListItem[],
  options: { label: string; value: string }[],
  showAllPlatforms: boolean = true,
): PlatformRow[] => {
  const validPlatformCodes = new Set(options.map((o) => o.value))
  const groups = new Map<string, CategoryRow[]>()
  if (showAllPlatforms) {
    options.forEach(({ value }) => groups.set(value, []))
  }
  categories.forEach((node) => {
    if (!validPlatformCodes.has(node.platform)) return
    if (!groups.has(node.platform)) groups.set(node.platform, [])
    groups.get(node.platform)!.push(mapCategoryRow(node))
  })

  return Array.from(groups.entries())
    .filter(([, children]) => showAllPlatforms || children.length > 0)
    .map(([platform, children]) => ({
      key: `platform-${platform}`,
      rowType: 'platform' as const,
      platform,
      platformLabel: getPlatformLabel(platform, options),
      children,
    }))
}

export default function CategoryManagement() {
  const { t, language } = useI18n()
  const navigate = useNavigate()
  const formRules = useFormRules()
  const [itemForm] = Form.useForm<FormValues>()
  const [tree, setTree] = useState<CategoryListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modal, setModal] = useState<ModalState>(CLOSED_MODAL)
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [platformOptions, setPlatformOptions] = useState<{ label: string; value: string }[]>([])
  const [categoryTypeOptions, setCategoryTypeOptions] = useState<{ label: string; value: string }[]>([])
  const [ingestStatusOptions, setIngestStatusOptions] = useState<{ label: string; value: string }[]>([])
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldListItem[]>([])
  const [fieldValues, setFieldValues] = useState<FieldValueMap>({})
  const [i18nValues, setI18nValues] = useState<I18nValueMap>({})
  const defaultLang = languageOptions[0]?.code ?? ''
  const otherLanguageOptions = useMemo(() => languageOptions.filter((l) => l.code !== defaultLang), [languageOptions, defaultLang])
  const [activeLang, setActiveLang] = useState('')
  const [contentOrderModal, setContentOrderModal] = useState<{ open: boolean; record: CategoryRow | null }>({ open: false, record: null })
  const [contentOrderRows, setContentOrderRows] = useState<CategoryContentRow[]>([])
  const [contentOrderLoading, setContentOrderLoading] = useState(false)
  const [contentOrderSubmitting, setContentOrderSubmitting] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [postersModal, setPostersModal] = useState<{ open: boolean; record: CategoryRow | null }>({ open: false, record: null })
  const [historyModal, setHistoryModal] = useState<{ open: boolean; record: CategoryRow | null }>({ open: false, record: null })
  const [syncing, setSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState('main')
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<number, string>>({})
  const { hasPermission } = usePermission()
  const canView = hasPermission('menu.basic.categories.view') || hasPermission('menu.basic.categories.operate')
  const canOperate = hasPermission('menu.basic.categories.operate')

  const customFieldItems = useMemo(
    () => customFields.filter((item) => item.belongings.includes('ALL') || item.belongings.includes('Category')),
    [customFields],
  )

  const multiLanguageFields = useMemo(
    () => customFieldItems.filter((item) => item.multi_language),
    [customFieldItems],
  )

  // ─── 搜索字段配置 ───────────────────────────────────────────────────────────

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'platforms',
      labelKey: 'category.col.platform',
      type: 'multiSelect',
      placeholderKey: 'category.placeholder.platform',
      options: platformOptions,
    },
    {
      name: 'name',
      labelKey: 'category.col.categoryName',
      type: 'input',
      placeholderKey: 'category.placeholder.categoryName',
    },
    {
      name: 'category_types',
      labelKey: 'category.col.categoryType',
      type: 'multiSelect',
      placeholderKey: 'category.placeholder.categoryType',
      options: categoryTypeOptions,
    },
    {
      name: 'ingest_statuses',
      labelKey: 'category.col.ingestStatus',
      type: 'multiSelect',
      placeholderKey: 'category.placeholder.ingestStatus',
      options: ingestStatusOptions,
    },
  ], [platformOptions, categoryTypeOptions, ingestStatusOptions, t])

  // ─── 使用 useSearchForm Hook ─────────────────────────────────────────────────

  const {
    form: searchForm,
    filters,
    expanded,
    setExpanded,
    showExpand,
    handleSearch,
    handleReset,
  } = useSearchForm<SearchValues>({
    onSearch: async (values) => {
      await loadTree(values)
    },
    onReset: () => {
      void loadTree({})
    },
    fieldsCount: searchFields.length,
  })

  const hasFilters = useMemo(() => {
    return Boolean(filters.name || (filters.platforms && filters.platforms.length > 0) || (filters.category_types && filters.category_types.length > 0) || (filters.ingest_statuses && filters.ingest_statuses.length > 0))
  }, [filters])

  const platformTree = useMemo(() => buildPlatformTree(tree, platformOptions, !hasFilters), [tree, platformOptions, hasFilters])

  const loadTree = async (nextFilters = filters) => {
    setLoading(true)
    try {
      const data = await getCategoryTree(nextFilters)
      setTree(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      const [dicts, langs, fields] = await Promise.all([
        getDictTree(),
        getMultiLanguageOptions(),
        getCustomFields({ page: 1, page_size: 200, belongings: ['ALL', 'Category'] }),
      ])
      const platformRoot = dicts.find((item) => item.code === 'Platform')
      const typeRoot = dicts.find((item) => item.code === 'Category_Type')
      setPlatformOptions((platformRoot?.children ?? []).map((item: DictNodeListItem) => ({ label: item.name, value: item.code })))
      setCategoryTypeOptions((typeRoot?.children ?? []).map((item: DictNodeListItem) => ({ label: item.name, value: item.code })))
      setIngestStatusOptions([
        { label: 'none', value: 'none' },
        { label: 'processing', value: 'processing' },
        { label: 'success', value: 'success' },
        { label: 'failure', value: 'failure' },
      ])
      setLanguageOptions(langs)
      setActiveLang(langs.length > 1 ? langs[1].code : (langs[0]?.code ?? ''))
      setCustomFields(fields.items)
      await loadTree({})
    })()
  }, [])


  const resetExtraState = () => {
    setFieldValues({})
    const nextI18n: I18nValueMap = {}
    languageOptions.forEach((lang) => {
      nextI18n[lang.code] = {}
    })
    setI18nValues(nextI18n)
    setActiveLang(otherLanguageOptions[0]?.code ?? '')
  }

  const openModal = (mode: ModalMode, record: CategoryRow | null = null) => {
    setActiveTab('main')
    itemForm.resetFields()
    resetExtraState()
    setCustomFieldErrors({})
    if (mode === 'createRoot') {
      setModal({ open: true, mode, record: null, parentId: null, platform: record?.platform ?? null })
      // 使用 setTimeout 确保 Modal 和 Form 已经渲染完成后再设置值
      setTimeout(() => {
        itemForm.setFieldsValue({ platform: record?.platform, sequence: 1, vod_count: 0, status: false })
      }, 0)
      return
    }
    if (mode === 'createChild' && record) {
      setModal({ open: true, mode, record, parentId: record.id, platform: record.platform })
      setTimeout(() => {
        itemForm.setFieldsValue({ platform: record.platform, sequence: 1, vod_count: 0, status: false })
      }, 0)
      return
    }
    if (mode === 'edit' && record) {
      setModal({ open: true, mode, record, parentId: record.parent_id, platform: record.platform })
      // 使用 setTimeout 确保 Modal 和 Form 已经渲染完成后再设置值
      setTimeout(() => {
        itemForm.setFieldsValue({
          platform: record.platform,
          name: record.name,
          sequence: record.sequence,
          category_type: record.category_type ?? undefined,
          vod_count: record.vod_count,
          description: record.description ?? undefined,
          jump_category_code: record.jump_category_code ?? undefined,
          status: record.status === 1,
        })
      }, 0)
      void (async () => {
        const [savedFields, savedI18n] = await Promise.all([
          getCategoryFieldValues(record.id),
          getCategoryI18n(record.id),
        ])
        const nextFieldValues: FieldValueMap = {}
        savedFields.forEach((item) => {
          nextFieldValues[item.custom_field_id] = item.value ?? ''
        })
        setFieldValues(nextFieldValues)

        const nextI18n: I18nValueMap = {}
        languageOptions.forEach((lang) => {
          nextI18n[lang.code] = {}
        })
        savedI18n.forEach((item) => {
          if (!nextI18n[item.language]) nextI18n[item.language] = {}
          nextI18n[item.language][item.field_name] = item.value ?? ''
        })
        setI18nValues(nextI18n)

        // 确保 activeLang 有默认值
        if (!activeLang && otherLanguageOptions.length > 0) {
          setActiveLang(otherLanguageOptions[0].code)
        }
      })()
    }
  }

  const openCreateRoot = (platform: string) => {
    setActiveTab('main')
    itemForm.resetFields()
    resetExtraState()
    setCustomFieldErrors({})
    itemForm.setFieldsValue({ platform, sequence: 1, vod_count: 0, status: false })
    setModal({ open: true, mode: 'createRoot', record: null, parentId: null, platform })
  }

  const closeModal = () => {
    setModal(CLOSED_MODAL)
    setActiveTab('main')
    itemForm.resetFields()
    resetExtraState()
    setCustomFieldErrors({})
  }

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

  const updateI18nValue = (language: string, fieldName: string, value: string) => {
    setI18nValues((prev) => ({
      ...prev,
      [language]: {
        ...(prev[language] ?? {}),
        [fieldName]: value,
      },
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

  const clearLanguageValues = (language: string) => {
    setI18nValues((prev) => ({
      ...prev,
      [language]: {},
    }))
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

  const buildFieldValuePayload = (): EntityFieldValueItem[] => {
    return customFieldItems.filter((field) => !field.multi_language).map((field) => ({
      custom_field_id: field.id,
      value: fieldValues[field.id] ?? '',
    }))
  }

  const handleSubmit = async () => {
    const mainFieldNames = ['platform', 'name', 'sequence', 'vod_count', 'category_type', 'description', 'jump_category_code', 'status']

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

    const values = await itemForm.validateFields(mainFieldNames)

    const current = modal
    setSubmitting(true)
    try {
      let categoryId = current.record?.id ?? 0
      if (current.mode === 'edit' && current.record) {
        const payload: CategoryUpdatePayload = {
          platform: values.platform,
          name: values.name,
          sequence: values.sequence,
          category_type: values.category_type ?? null,
          vod_count: values.vod_count,
          description: values.description ?? null,
          jump_category_code: values.jump_category_code ?? null,
          status: values.status ? 1 : 0,
        }
        const updated = await updateCategory(current.record.id, payload)
        categoryId = updated.id
        message.success(t('category.msg.updated'), 3)
      } else {
        const payload: CategoryCreatePayload = {
          parent_id: current.parentId,
          platform: values.platform,
          name: values.name,
          sequence: values.sequence,
          category_type: values.category_type ?? null,
          vod_count: values.vod_count,
          description: values.description ?? null,
          jump_category_code: values.jump_category_code ?? null,
          status: values.status ? 1 : 0,
        }
        const created = await createCategory(payload)
        categoryId = created.id
        message.success(t('category.msg.created'), 3)
      }

      await saveCategoryFieldValues(categoryId, { values: buildFieldValuePayload() })
      const i18nSaveTasks = otherLanguageOptions.map((lang) =>
        saveCategoryI18n(categoryId, {
          language: lang.code,
          fields: i18nValues[lang.code] ?? {},
        }),
      )
      if (defaultLang) {
        const defaultLangFields: Record<string, string> = {}
        multiLanguageFields.forEach((field) => {
          const val = i18nValues[defaultLang]?.[field.field_code] ?? ''
          if (val) defaultLangFields[field.field_code] = val
        })
        if (Object.keys(defaultLangFields).length > 0) {
          i18nSaveTasks.push(
            saveCategoryI18n(categoryId, { language: defaultLang, fields: defaultLangFields }),
          )
        }
      }
      await Promise.all(i18nSaveTasks)

      closeModal()
      if (current.mode === 'createChild' && current.record) {
        const parentId = current.record.id
        setExpandedKeys((prev) => (prev.includes(parentId) ? prev : [...prev, parentId]))
      }
      void loadTree(filters)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record: CategoryRow) => {
    await deleteCategory(record.id)
    message.success(t('common.msg.deleted'), 3)
    void loadTree(filters)
  }

  const openDetailPage = (record: CategoryRow) => {
    navigate(`/basic/categories/${record.id}`)
  }

  const openPosterModal = (record: CategoryRow) => {
    setPostersModal({ open: true, record })
  }

  const openContentOrder = (record: CategoryRow) => {
    setContentOrderModal({ open: true, record })
    setContentOrderRows([])
    setContentOrderLoading(true)
    void getCategoryContents(record.id)
      .then((rows) => setContentOrderRows(rows))
      .finally(() => setContentOrderLoading(false))
  }

  const moveContentRow = (index: number, direction: 'up' | 'down') => {
    setContentOrderRows((prev) => {
      const next = [...prev]
      const swapIndex = direction === 'up' ? index - 1 : index + 1
      ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
      return next
    })
  }

  const handleDragStart = (index: number) => {
    setDragIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    setContentOrderRows((prev) => {
      const next = [...prev]
      const dragItem = next[dragIndex]
      next.splice(dragIndex, 1)
      next.splice(index, 0, dragItem)
      setDragIndex(index)
      return next
    })
  }

  const handleDragEnd = () => {
    setDragIndex(null)
  }

  const handleContentOrderSave = async () => {
    if (!contentOrderModal.record) return
    setContentOrderSubmitting(true)
    try {
      await reorderCategoryContents(contentOrderModal.record.id, contentOrderRows.map((r) => r.id))
      message.success(t('category.msg.orderSaved'), 3)
      setContentOrderModal({ open: false, record: null })
    } finally {
      setContentOrderSubmitting(false)
    }
  }

  // 递归提取树中所有栏目的 ID
  const flattenCategoryIds = (nodes: CategoryListItem[]): number[] => {
    const ids: number[] = []
    const traverse = (items: CategoryListItem[]) => {
      items.forEach((item) => {
        ids.push(item.id)
        if (item.children?.length) traverse(item.children)
      })
    }
    traverse(nodes)
    return ids
  }

  // 模拟同步：将当前所有栏目的 ingest_status 批量更新为 success
  const handleSync = async () => {
    const ids = flattenCategoryIds(tree)
    if (ids.length === 0) {
      void message.info(t('category.msg.noData'), 3)
      return
    }
    setSyncing(true)
    try {
      await Promise.all(ids.map((id) => updateCategory(id, { ingest_status: 'success' })))
      void message.success(t('category.msg.syncComplete', { count: ids.length }), 3)
      void loadTree(filters)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('category.msg.syncFailed'), 5)
    } finally {
      setSyncing(false)
    }
  }

  const renderCustomFieldInput = (field: CustomFieldListItem, langCode?: string) => {
    if (langCode) {
      const value = i18nValues[langCode]?.[field.field_code] ?? ''
      if (isSelectField(field.field_type)) {
        if (isMultiSelectField(field.field_type)) {
          const selected = value ? value.split(',').filter(Boolean) : []
          return (
            <Select
              showSearch optionFilterProp="label"
              mode="multiple"
              allowClear
              value={selected}
              placeholder={field.tip ?? t('customField.placeholder.selectField', { name: field.field_name })}
              options={field.options.map((item) => ({
                label: item.names[langCode] ?? item.names.default ?? Object.values(item.names)[0] ?? item.code,
                value: item.code,
              }))}
              onChange={(vals) => updateI18nValue(langCode, field.field_code, vals.join(','))}
              style={{ width: '100%' }}
            />
          )
        }
        return (
          <Select
            showSearch optionFilterProp="label"
            allowClear
            value={value || undefined}
            placeholder={field.tip ?? t('customField.placeholder.selectField', { name: field.field_name })}
            options={field.options.map((item) => ({
              label: item.names[langCode] ?? item.names.default ?? Object.values(item.names)[0] ?? item.code,
              value: item.code,
            }))}
            onChange={(val) => updateI18nValue(langCode, field.field_code, val ?? '')}
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
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateI18nValue(langCode, field.field_code, e.target.value)}
          />
        )
      }
      if (isDateField(field.field_type)) {
        return (
          <DatePicker
            style={{ width: '100%' }}
            value={value ? dayjs(value) : undefined}
            placeholder={field.tip ?? t('customField.placeholder.selectField', { name: field.field_name })}
            onChange={(_, dateString) => updateI18nValue(langCode, field.field_code, typeof dateString === 'string' ? dateString : '')}
          />
        )
      }
      if (isTimeField(field.field_type)) {
        return (
          <TimePicker
            style={{ width: '100%' }}
            value={value ? dayjs(value, 'HH:mm:ss') : undefined}
            placeholder={field.tip ?? t('customField.placeholder.selectField', { name: field.field_name })}
            onChange={(_, timeString) => updateI18nValue(langCode, field.field_code, typeof timeString === 'string' ? timeString : '')}
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
            placeholder={field.tip ?? t('customField.placeholder.selectField', { name: field.field_name })}
            onChange={(_, dateString) => updateI18nValue(langCode, field.field_code, typeof dateString === 'string' ? dateString : '')}
          />
        )
      }
      return (
        <TrimInput
          value={value}
          placeholder={field.tip ?? t('customField.placeholder.enterField', { name: field.field_name })}
          onChange={(e) => updateI18nValue(langCode, field.field_code, e.target.value)}
        />
      )
    }

    const value = fieldValues[field.id] ?? ''
    if (isSelectField(field.field_type)) {
      if (isMultiSelectField(field.field_type)) {
        const selected = value ? value.split(',').filter(Boolean) : []
        return (
          <Select
              showSearch optionFilterProp="label"
              mode="multiple"
            allowClear
            value={selected}
            placeholder={field.tip ?? t('customField.placeholder.selectField', { name: field.field_name })}
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
            showSearch optionFilterProp="label"
            allowClear
          value={value || undefined}
          placeholder={field.tip ?? t('customField.placeholder.selectField', { name: field.field_name })}
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
          placeholder={field.tip ?? t('customField.placeholder.enterField', { name: field.field_name })}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateFieldValue(field.id, e.target.value)}
        />
      )
    }
    if (isNumberField(field.field_type)) {
      return (
        <InputNumber
          style={{ width: '100%' }}
          value={value === '' ? undefined : Number(value)}
          placeholder={field.tip ?? t('customField.placeholder.enterField', { name: field.field_name })}
          onChange={(val) => updateFieldValue(field.id, val == null ? '' : String(val))}
        />
      )
    }
    if (isDateField(field.field_type)) {
      return (
        <DatePicker
          style={{ width: '100%' }}
          value={value ? dayjs(value) : undefined}
          placeholder={field.tip ?? t('customField.placeholder.selectField', { name: field.field_name })}
          onChange={(_, dateString) => updateFieldValue(field.id, typeof dateString === 'string' ? dateString : '')}
        />
      )
    }
    if (isTimeField(field.field_type)) {
      return (
        <TimePicker
          style={{ width: '100%' }}
          value={value ? dayjs(value, 'HH:mm:ss') : undefined}
          placeholder={field.tip ?? t('customField.placeholder.selectField', { name: field.field_name })}
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
          placeholder={field.tip ?? t('customField.placeholder.selectField', { name: field.field_name })}
          onChange={(_, dateString) => updateFieldValue(field.id, typeof dateString === 'string' ? dateString : '')}
        />
      )
    }
    return (
      <TrimInput
          value={value}
          placeholder={field.tip ?? t('customField.placeholder.enterField', { name: field.field_name })}
          onChange={(e) => updateFieldValue(field.id, e.target.value)}
        />
    )
  }

  const columns: ColumnsType<TreeRow> = [
    {
      title: t('category.col.platform'),
      dataIndex: 'platform',
      key: 'platform',
      width: 200,
      render: (_, record) => {
        if (record.rowType === 'platform') {
          return <span style={{ fontWeight: 600 }}>{record.platformLabel}</span>
        }
        return null
      },
    },
    {
      title: t('category.col.categoryId'),
      key: 'id',
      width: 160,
      render: (_, record) => record.rowType === 'platform' ? null : record.id,
    },
    {
      title: t('category.col.categoryName'),
      key: 'name',
      render: (_, record) => {
        if (record.rowType === 'platform') return null
        return <span>{record.name}</span>
      },
    },
    {
      title: t('category.col.categoryType'),
      dataIndex: 'category_type',
      key: 'category_type',
      width: 200,
      render: (_, record) => {
        if (record.rowType === 'platform') return null
        if (!record.category_type) return null
        return categoryTypeOptions.find(o => o.value === record.category_type)?.label ?? record.category_type
      },
    },
    {
      title: t('category.col.ingestStatus'),
      dataIndex: 'ingest_status',
      key: 'ingest_status',
      width: 200,
      render: (_, record) => {
        if (record.rowType === 'platform') return null
        const displayVal = record.ingest_status ?? 'None'
        const tagColor = displayVal === 'success' ? 'success' : displayVal === 'failure' ? 'error' : 'default'
        return (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => setHistoryModal({ open: true, record })}
          >
            <Tag color={tagColor} style={{ cursor: 'pointer', margin: 0 }}>{displayVal}</Tag>
          </Button>
        )
      },
    },
    {
      title: t('category.col.action'),
      key: 'action',
      fixed: 'right',
      width: 280,
      render: (_, record) => {
        if (record.rowType === 'platform') {
          return canOperate ? (
            <Tooltip title={t('category.modal.titleCreateRoot')}>
              <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openCreateRoot(record.platform)} />
            </Tooltip>
          ) : null
        }
        return (
          <Space size={0} wrap={false}>
            {canView && (
              <Tooltip title={t('common.detail')}>
                <Button type="link" size="small" icon={<InfoCircleOutlined />} onClick={() => openDetailPage(record)} />
              </Tooltip>
            )}
            {canView && (
              <Tooltip title={t('category.tooltip.posters')}>
                <Button type="link" size="small" icon={<PictureOutlined />} onClick={() => openPosterModal(record)} />
              </Tooltip>
            )}
            {canOperate && (
              <Tooltip title={t('category.tooltip.contentOrder')}>
                <Button type="link" size="small" icon={<MenuOutlined />} onClick={() => openContentOrder(record)} />
              </Tooltip>
            )}
            {canOperate && (
              <Tooltip title={t('category.modal.titleCreateChild')}>
                <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openModal('createChild', record)} />
              </Tooltip>
            )}
            {canOperate && (
              <Tooltip title={t('common.edit')}>
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal('edit', record)} />
              </Tooltip>
            )}
            {canOperate && (
              <Popconfirm
                title={t('common.confirmDelete', { name: record.name })}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                onConfirm={() => void handleDelete(record)}
              >
                <Tooltip title={t('common.delete')}>
                  <Button type="link" size="small" icon={<DeleteOutlined />} danger />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div className="main-container">
      {/* 搜索区 */}
        <SearchForm
          fields={searchFields}
          form={searchForm}
          expanded={expanded}
          onExpandChange={setExpanded}
          showExpand={showExpand}
          onSearch={handleSearch}
          onReset={handleReset}
          loading={loading}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          {canOperate && (
            <Button type="primary" loading={syncing} onClick={() => void handleSync()}>{t('category.toolbar.syncBtn')}</Button>
          )}
        </div>

        <Table<TreeRow>
          rowKey="key"
          loading={loading}
          columns={columns}
          dataSource={platformTree}
          scroll={{ x: 1100 }}
          pagination={false}
          expandable={{
            expandedRowKeys: expandedKeys,
            onExpand: (expanded, record) => {
              setExpandedKeys((prev) => expanded ? [...prev, record.key] : prev.filter((k) => k !== record.key))
            },
            indentSize: 20,
            expandIcon: ({ expanded, onExpand, record }) => {
              const hasChildren = 'children' in record && Array.isArray(record.children) && (record.children as CategoryRow[]).length > 0
              if (!hasChildren) return <span style={{ display: 'inline-block', width: 17 }} />
              return expanded
                ? <CaretDownOutlined style={{ marginRight: 10 }} onClick={(e) => { e.stopPropagation(); onExpand(record, e) }} />
                : <CaretRightOutlined style={{ marginRight: 10 }} onClick={(e) => { e.stopPropagation(); onExpand(record, e) }} />
            },
          }}
          size="small"
        />

      <Modal
        title={modal.mode === 'edit' ? t('category.modal.titleEdit') : modal.mode === 'createChild' ? t('category.modal.titleCreateChild') : t('category.modal.titleCreateRoot')}
        open={modal.open}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        width={920}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'main',
              label: t('category.tab.main'),
              forceRender: true,
              children: (
                <Form form={itemForm} layout="vertical">
                  <Form.Item name="platform" hidden><TrimInput /></Form.Item>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label={t('category.form.parentLabel')}>
                        <TrimInput value={modal.record?.name ?? ''} readOnly placeholder={t('category.form.emptyParent')} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label={t('category.form.platformLabel')}>
                        <TrimInput value={platformOptions.find(o => o.value === modal.platform)?.label ?? modal.platform ?? ''} readOnly />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="jump_category_code" label={t('category.form.jumpCodeLabel')} rules={[formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                        <TrimInput placeholder={t('category.form.jumpCodeLabel')} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="name" label={t('category.form.nameLabel')} rules={[{ required: true, message: t('category.form.nameRequired') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                        <TrimInput placeholder={t('category.form.nameRequired')} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="sequence" label={t('category.form.sequenceLabel')} rules={[{ required: true, message: t('category.form.sequenceRequired') }]}>
                        <InputNumber min={1} max={9999} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="category_type" label={t('category.form.typeLabel')}>
                        <Select showSearch optionFilterProp="label" allowClear placeholder={t('category.form.typeLabel')} options={categoryTypeOptions} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="vod_count" label={t('category.form.vodCountLabel')} rules={[{ required: true, message: t('category.form.vodCountRequired') }]}>
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="status" label={t('category.form.statusLabel')} valuePropName="checked">
                        <Switch checkedChildren={t('category.form.valid')} unCheckedChildren={t('category.form.invalid')} />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item name="description" label={t('category.form.descriptionLabel')} rules={[formRules.maxLength(FORM_MAX_LENGTH.TEXT_AREA)]}>
                        <TrimInput.TextArea rows={3} placeholder={t('category.form.descriptionLabel')} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              ),
            },
            {
              key: 'custom-fields',
              label: t('category.tab.customFields'),
              forceRender: true,
              children: (
                <Row gutter={16}>
                  {customFieldItems.length === 0 ? (
                    <Col span={24}>{t('category.form.noCustomFields')}</Col>
                  ) : customFieldItems.map((field) => (
                    <Col span={12} key={field.id}>
                      <Form.Item
                        label={field.field_name}
                        required={field.mandatory}
                        tooltip={field.tip ?? undefined}
                        validateStatus={customFieldErrors[field.id] ? 'error' : ''}
                        help={customFieldErrors[field.id] || ''}
                      >
                        {renderCustomFieldInput(field, field.multi_language ? defaultLang : undefined)}
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
              ),
            },
            {
              key: 'multi-languages',
              label: t('category.tab.multiLanguages'),
              forceRender: true,
              children: otherLanguageOptions.length === 0 ? (
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
                            <Button type="link" danger size="small" onClick={(e) => { e.stopPropagation(); clearLanguageValues(lang.code) }}>
                              {t('category.form.clear')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Col>
                  <Col span={18}>
                    <div style={{ marginBottom: 16, fontWeight: 500 }}>
                      {t('category.form.currentLanguage')}{otherLanguageOptions.find((item) => item.code === activeLang)?.name ?? activeLang}
                    </div>
                    <Row gutter={16}>
                      <Col span={24}>
                        <Form.Item label={t('category.col.categoryName')}>
                          <TrimInput
                            value={i18nValues[activeLang]?.name ?? ''}
                            placeholder={t('category.placeholder.categoryName')}
                            onChange={(e) => updateI18nValue(activeLang, 'name', e.target.value)}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={24}>
                        <Form.Item label={t('category.form.descriptionLabel')}>
                          <TrimInput.TextArea
                            rows={3}
                            value={i18nValues[activeLang]?.description ?? ''}
                            placeholder={t('category.form.descriptionLabel')}
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
                            {renderCustomFieldInput(field, activeLang)}
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

      <Modal
        title={t('category.modal.contentOrderTitle', { name: contentOrderModal.record?.name ?? '' })}
        open={contentOrderModal.open}
        onCancel={() => setContentOrderModal({ open: false, record: null })}
        onOk={() => void handleContentOrderSave()}
        confirmLoading={contentOrderSubmitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        width={760}
        destroyOnHidden
      >
        <Table<CategoryContentRow>
          rowKey="id"
          loading={contentOrderLoading}
          dataSource={contentOrderRows}
          pagination={false}
          locale={{ emptyText: t('category.contentOrder.emptyContents') }}
          onRow={(_, index) => ({
            draggable: true,
            onDragStart: () => index !== undefined && handleDragStart(index),
            onDragOver: (e) => index !== undefined && handleDragOver(e, index),
            onDragEnd: handleDragEnd,
            style: {
              cursor: 'move',
              background: dragIndex === index ? '#f0f7ff' : undefined,
            },
          })}
          columns={[
            {
              title: '',
              key: 'drag',
              width: 40,
              render: () => <HolderOutlined style={{ cursor: 'grab', color: '#999' }} />,
            },
            {
              title: t('category.form.contentName'),
              dataIndex: 'content_name',
              key: 'content_name',
              render: (name: string, record) => {
                const getDetailPath = () => {
                  if (record.content_type === 'CHANNEL') return `/live/channels/${record.id}`
                  if (record.content_type === 'SCHEDULE') return `/live/schedules/${record.id}`
                  return `/contents/${record.id}`
                }
                return (
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(getDetailPath())}>
                    {name}
                  </Button>
                )
              },
            },
            { title: t('category.form.contentType'), dataIndex: 'content_type', key: 'content_type', width: 140 },
            { title: t('category.form.genre'), dataIndex: 'genre', key: 'genre', width: 120 },
            { title: t('category.form.status'), dataIndex: 'status', key: 'status', width: 100 },
            {
              title: t('common.action'),
              key: 'action',
              width: 100,
              render: (_, __, index) => (
                <Space size={4}>
                  <Button
                    type="link"
                    size="small"
                    icon={<ArrowUpOutlined />}
                    disabled={index === 0}
                    onClick={() => moveContentRow(index, 'up')}
                  />
                  <Button
                    type="link"
                    size="small"
                    icon={<ArrowDownOutlined />}
                    disabled={index === contentOrderRows.length - 1}
                    onClick={() => moveContentRow(index, 'down')}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Modal>

      <PostersModal
        open={postersModal.open && !!postersModal.record}
        entityType="category"
        entityId={postersModal.record?.id ?? 0}
        entityName={postersModal.record?.name}
        readOnly={!canOperate}
        onClose={() => setPostersModal({ open: false, record: null })}
      />

      <CategoryIngestHistoryModal
        open={historyModal.open && !!historyModal.record}
        entityType="Category"
        entityId={historyModal.record?.id ?? 0}
        entityName={historyModal.record?.name ?? ''}
        onClose={() => setHistoryModal({ open: false, record: null })}
      />
    </div>
  )
}
