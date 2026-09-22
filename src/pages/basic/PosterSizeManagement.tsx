import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  batchDeletePosterSizes,
  createPosterSize,
  deletePosterSize,
  getPosterSizeFieldValues,
  getPosterSizeI18n,
  getPosterSizes,
  savePosterSizeFieldValues,
  savePosterSizeI18n,
  updatePosterSize,
} from '../../api/posterSizes'
import { getCustomFields } from '../../api/customFields'
import { getDictTree, getDictChildren } from '../../api/dicts'
import { getMultiLanguageOptions } from '../../api/i18n'
import type { LanguageOption } from '../../types/i18n'
import { getFieldOptionLabel, formatApiValue, getCustomFieldPlaceholder, validateCustomFields as validateCustomFieldsUtil, clearFieldError } from '../../utils/customField'
import SearchForm from '../../components/SearchForm'
import ResizableTable from '../../components/ResizableTable'
import TrimInput from '../../components/TrimInput'
import CustomFieldControl from '../../components/CustomFieldControl'
import type { DictNodeListItem } from '../../types/dict'
import type {
  CustomFieldListItem,
  EntityFieldValueItem,
  EntityI18nItem,
  PosterSizeCreatePayload,
  PosterSizeListItem,
  PosterSizeUpdatePayload,
} from '../../types/basic'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'
import { useFormRules } from '../../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../../constants/form'

const BELONGING_KEYS: Record<string, string> = {
  Cast: 'customField.belonging.Cast',
  Category: 'customField.belonging.Category',
  Program: 'customField.belonging.Program',
  Series: 'customField.belonging.Series',
  Channel: 'customField.belonging.Channel',
  Schedule: 'customField.belonging.Schedule',
}

type FieldValueMap = Record<number, string>
type I18nValueMap = Record<string, Record<string, string>>

interface SearchValues {
  name?: string
  belongings?: string[]
  mandatory?: string
}

interface MainFormValues {
  name: string
  belongings: string[]
  extensions: string[]
  width: number
  height: number
  max_file_size_kb: number
  mapping_type: string  // 改为 string 类型，与字典 code 一致
  mandatory: boolean
  [key: string]: any
}

export default function PosterSizeManagement() {
  const { t } = useI18n()
  const formRules = useFormRules()
  const [mainForm] = Form.useForm<MainFormValues>()
  const [list, setList] = useState<PosterSizeListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<PosterSizeListItem | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [extensionOptions, setExtensionOptions] = useState<{ label: string; value: string }[]>([])
  const [activeTab, setActiveTab] = useState('main')
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.basic.posterSpecs.operate')
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filters, sortField, sortOrder)
    },
  })

  const [customFields, setCustomFields] = useState<CustomFieldListItem[]>([])
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([])
  const [mappingTypeOptions, setMappingTypeOptions] = useState<{ label: string; value: string }[]>([])
  const [fieldValues, setFieldValues] = useState<FieldValueMap>({})
  const [i18nValues, setI18nValues] = useState<I18nValueMap>({})
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<number, Record<string, string>>>({})
  const [activeLang, setActiveLang] = useState('')
  const defaultLang = languageOptions[0]?.code ?? ''
  const languageOrder = useMemo(() => languageOptions.map((l) => l.code), [languageOptions])
  const otherLanguageOptions = useMemo(() => languageOptions.filter((l) => l.code !== defaultLang), [languageOptions, defaultLang])

  const customFieldItems = useMemo(
    () => customFields.filter((item) => item.belongings.includes('ALL') || item.belongings.includes('Picture')),
    [customFields],
  )

  const multiLanguageFields = useMemo(
    () => customFieldItems.filter((item) => item.multi_language),
    [customFieldItems],
  )
  const hasMultiLang = multiLanguageFields.length > 0

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'name',
      labelKey: 'posterSize.form.nameLabel',
      type: 'input',
      placeholderKey: 'posterSize.form.nameRequired',
    },
    {
      name: 'belongings',
      labelKey: 'posterSize.col.belonging',
      type: 'multiSelect',
      placeholderKey: 'posterSize.form.belongingRequired',
      options: Object.entries(BELONGING_KEYS).map(([value, labelKey]) => ({ label: t(labelKey as any), value })),
    },
    {
      name: 'mandatory',
      labelKey: 'posterSize.search.mandatory',
      type: 'select',
      placeholderKey: 'common.placeholder.all',
      options: [
        { label: t('common.yes'), value: 'true' },
        { label: t('common.no'), value: 'false' },
      ],
    },
  ], [t])

  const {
    form: searchForm,
    filters,
    expanded,
    setExpanded,
    showExpand,
    handleSearch,
    handleReset,
  } = useSearchForm<SearchValues>({
    onSearch: (values) => {
      setSelectedIds([])
      void loadList(1, pagination.pageSize, values, sortField, sortOrder)
    },
    onReset: () => {
      setSelectedIds([])
      resetSort()
      void loadList(1, pagination.pageSize, {}, null, null)
    },
    fieldsCount: searchFields.length,
  })

  const loadList = async (page = pagination.current, pageSize = pagination.pageSize, nextFilters = filters, nextSortField?: string | null, nextSortOrder?: 'ascend' | 'descend' | null) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        page,
        page_size: pageSize,
        sort_by: nextSortField ?? undefined,
        sort_order: nextSortOrder === 'ascend' ? 'asc' : nextSortOrder === 'descend' ? 'desc' : undefined,
        ...nextFilters,
        mandatory: nextFilters.mandatory === 'true' ? true : nextFilters.mandatory === 'false' ? false : undefined,
      }
      const data = await getPosterSizes(params)
      setList(data.items)
      updatePagination(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      const [dicts, fields, langs, mappingTypes] = await Promise.all([
        getDictTree({ code: 'Image_file_extensions' }),
        getCustomFields({ page: 1, page_size: 200, belongings: ['ALL', 'Picture'] }),
        getMultiLanguageOptions().catch(() => [] as LanguageOption[]),
        // 获取 Picture_Mapping_Type 字典数据
        getDictChildren('Picture_Mapping_Type').catch(() => []),
      ])
      // 加载列表数据（不阻塞其他请求）
      void loadList(1, 10, {})
      const root = dicts.find((item) => item.code === 'Image_file_extensions')
      setExtensionOptions((root?.children ?? []).map((item: DictNodeListItem) => ({ label: item.name, value: item.code })))
      setCustomFields(fields.items)
      setLanguageOptions(langs)
      // 转换数据格式：API 返回 { name, code }，Select 需要 { label, value }
      setMappingTypeOptions(mappingTypes.map((item: any) => ({ label: item.name, value: item.code })))
    })()
  }, [])

  const resetExtraState = () => {
    setFieldValues({})
    const nextI18n: I18nValueMap = {}
    languageOptions.forEach((lang) => {
      nextI18n[lang.code] = {}
    })
    setI18nValues(nextI18n)
    setCustomFieldErrors({})
    setActiveLang(otherLanguageOptions[0]?.code ?? '')
  }

  const openCreate = () => {
    setEditingRecord(null)
    setActiveTab('main')
    mainForm.resetFields()
    resetExtraState()
    mainForm.setFieldsValue({
      width: -1,
      height: -1,
      max_file_size_kb: -1,
      mandatory: false,
      belongings: [],
      extensions: [],
      mapping_type: undefined,
    })
    setModalOpen(true)
  }

  const openEdit = (record: PosterSizeListItem) => {
    setEditingRecord(record)
    setActiveTab('main')
    mainForm.resetFields()
    resetExtraState()
    mainForm.setFieldsValue({
      name: record.name,
      belongings: record.belongings,
      extensions: record.extensions,
      width: record.width,
      height: record.height,
      max_file_size_kb: record.max_file_size_kb,
      mapping_type: record.mapping_type != null ? String(record.mapping_type) : undefined,
      mandatory: record.mandatory,
    })
    setModalOpen(true)
    void (async () => {
      const hasML = customFieldItems.some(f => f.multi_language)
      const [savedFields, savedI18n] = await Promise.all([
        getPosterSizeFieldValues(record.id),
        hasML ? getPosterSizeI18n(record.id).catch(() => [] as EntityI18nItem[]) : Promise.resolve([] as EntityI18nItem[]),
      ])
      // 非多语言字段值
      const nextFieldValues: FieldValueMap = {}
      savedFields.forEach((item: EntityFieldValueItem) => {
        const field = customFieldItems.find(f => f.id === item.custom_field_id)
        if (field && !field.multi_language) {
          nextFieldValues[item.custom_field_id] = item.value ?? ''
        }
      })
      setFieldValues(nextFieldValues)
      // 多语言字段值：按语言分组
      const nextI18n: I18nValueMap = {}
      languageOptions.forEach((lang) => {
        nextI18n[lang.code] = {}
      })
      savedI18n.forEach((item: EntityI18nItem) => {
        if (!nextI18n[item.language]) nextI18n[item.language] = {}
        nextI18n[item.language][item.field_name] = item.value ?? ''
      })
      setI18nValues(nextI18n)
    })()
  }

  const closeModal = () => {
    mainForm.resetFields()
    setModalOpen(false)
    setEditingRecord(null)
    setActiveTab('main')
    resetExtraState()
  }

  const updateFieldValue = (fieldId: number, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }))
    setCustomFieldErrors((prev) => clearFieldError(prev, fieldId, '_main'))
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
      setCustomFieldErrors((prev) => clearFieldError(prev, field.id, language))
    }
  }

  const clearLanguageValues = (language: string) => {
    setI18nValues((prev) => ({
      ...prev,
      [language]: {},
    }))
  }

  const buildFieldValuePayload = (): EntityFieldValueItem[] => {
    return customFieldItems.filter((field) => !field.multi_language).map((field) => ({
      custom_field_id: field.id,
      value: fieldValues[field.id] ?? '',
    }))
  }

  const handleSubmit = async () => {
    const mainFieldNames = ['name', 'belongings', 'extensions', 'width', 'height', 'max_file_size_kb', 'mapping_type', 'mandatory']

    const doValidateCustomFields = () => {
      const errors = validateCustomFieldsUtil(customFieldItems, fieldValues, i18nValues, t, defaultLang)
      setCustomFieldErrors(errors)
      return Object.values(errors).every((langErrors) => Object.keys(langErrors).length === 0)
    }

    const validateCurrentTab = () => {
      if (activeTab === 'main') {
        return mainForm.validateFields(mainFieldNames).then(() => true, () => false)
      }
      if (activeTab === 'custom-fields') {
        return Promise.resolve(doValidateCustomFields())
      }
      // multiLanguages tab 非默认语言不做必填校验
      return Promise.resolve(true)
    }

    const validateOtherTab = () => {
      if (activeTab === 'main') {
        if (!doValidateCustomFields()) return Promise.resolve('custom-fields')
        return Promise.resolve(null)
      }
      if (activeTab === 'custom-fields' || activeTab === 'multiLanguages') {
        return mainForm.validateFields(mainFieldNames).then(
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

    try {
      const values = await mainForm.validateFields(mainFieldNames)
      const current = editingRecord
      setSubmitting(true)

      let posterSizeId = current?.id ?? 0
      const submitValues = {
        ...values,
        mapping_type: values.mapping_type != null ? Number(values.mapping_type) : undefined,
      }
      if (current) {
        const payload: PosterSizeUpdatePayload = { ...submitValues }
        const updated = await updatePosterSize(current.id, payload)
        posterSizeId = updated.id
        void message.success(t('posterSize.msg.updated'), 3)
      } else {
        // mapping_type 在创建时是必填字段，确保有值
        const payload: PosterSizeCreatePayload = {
          ...submitValues,
          mapping_type: submitValues.mapping_type ?? 0,
        }
        const created = await createPosterSize(payload)
        posterSizeId = created.id
        void message.success(t('posterSize.msg.created'), 3)
      }

      // 保存非多语言自定义字段值
      await savePosterSizeFieldValues(posterSizeId, { values: buildFieldValuePayload() })

      // 保存多语言字段值（按语言分别保存，默认语言也走 i18n）
      if (hasMultiLang) {
        const i18nSaveTasks = otherLanguageOptions.map((lang) =>
          savePosterSizeI18n(posterSizeId, {
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
              savePosterSizeI18n(posterSizeId, { language: defaultLang, fields: defaultLangFields }),
            )
          }
        }
        await Promise.all(i18nSaveTasks)
      }

      closeModal()
      void loadList(current ? pagination.current : 1, pagination.pageSize, filters, sortField, sortOrder)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record: PosterSizeListItem) => {
    await deletePosterSize(record.id)
    message.success(t('common.msg.deleted'))
    setSelectedIds(prev => prev.filter(id => id !== record.id))
    void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    await batchDeletePosterSizes({ ids: selectedIds })
    message.success(t('common.msg.deleted'))
    setSelectedIds([])
    void loadList(1, pagination.pageSize, filters, sortField, sortOrder)
  }

  const renderCustomFieldInput = (field: CustomFieldListItem, langCode?: string) => {
    if (langCode) {
      const value = i18nValues[langCode]?.[field.field_code] ?? ''
      const options = field.options.map((item) => ({
        label: getFieldOptionLabel(field, item.code, langCode, languageOrder),
        value: item.code,
      }))
      const placeholder = getCustomFieldPlaceholder(field, t)
      return (
        <CustomFieldControl
          fieldType={field.field_type}
          options={options}
          placeholder={placeholder}
          value={value}
          disabled={!canOperate}
          onChange={(val: unknown) => updateI18nValue(langCode, field.field_code, formatApiValue(field.field_type, val))}
        />
      )
    }
    const value = fieldValues[field.id] ?? ''
    const options = field.options.map((item) => ({
      label: getFieldOptionLabel(field, item.code, defaultLang || languageOrder[0], languageOrder),
      value: item.code,
    }))
    const placeholder = getCustomFieldPlaceholder(field, t)
    return (
      <CustomFieldControl
        fieldType={field.field_type}
        options={options}
        placeholder={placeholder}
        value={value}
        disabled={!canOperate}
        onChange={(val: unknown) => updateFieldValue(field.id, formatApiValue(field.field_type, val))}
      />
    )
  }

  const columns: ColumnsType<PosterSizeListItem> = [
    { title: t('posterSize.col.name'), dataIndex: 'name', key: 'name', width: 320, sorter: true, sortOrder: sortField === 'name' ? sortOrder : null },
    { title: t('posterSize.col.belonging'), dataIndex: 'belongings', key: 'belongings', width: 220, render: (values: string[]) => values.map((item) => <Tag key={item}>{t(BELONGING_KEYS[item] as any) || item}</Tag>) },
    { title: t('posterSize.col.width'), dataIndex: 'width', key: 'width', width: 160, sorter: true, sortOrder: sortField === 'width' ? sortOrder : null },
    { title: t('posterSize.col.height'), dataIndex: 'height', key: 'height', width: 160, sorter: true, sortOrder: sortField === 'height' ? sortOrder : null },
    { title: t('posterSize.col.aspectRatio'), dataIndex: 'aspect_ratio', key: 'aspect_ratio', width: 160, render: (value: string | null | undefined) => value || '—' },
    { title: t('posterSize.col.maxFileSize'), dataIndex: 'max_file_size_kb', key: 'max_file_size_kb', width: 160, sorter: true, sortOrder: sortField === 'max_file_size_kb' ? sortOrder : null },
    { title: t('posterSize.col.mandatory'), dataIndex: 'mandatory', key: 'mandatory', width: 160, sorter: true, sortOrder: sortField === 'mandatory' ? sortOrder : null, render: (value: boolean) => (value ? <Tag color="red">{t('common.yes')}</Tag> : <Tag>{t('common.no')}</Tag>) },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 140,
      render: (_, record) => (
        <Space size={0}>
          {canOperate && (
            <Tooltip title={t('common.edit')}>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
            </Tooltip>
          )}
          {canOperate && (
            <Popconfirm title={`${t('common.confirm')} ${t('common.delete')} "${record.name}"？`} okText={t('common.confirm')} cancelText={t('common.cancel')} onConfirm={() => void handleDelete(record)}>
              <Tooltip title={t('common.delete')}>
                <Button type="link" size="small" icon={<DeleteOutlined />} danger />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  // Multi Languages Tab（非默认语言的多语言自定义字段）
  const renderMultiLanguagesTab = () => {
    if (!hasMultiLang) return null
    if (otherLanguageOptions.length === 0) {
      return <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>{t('content.metadata.noOtherLanguages')}</div>
    }
    return (
      <Row gutter={16}>
        {/* 左侧语言列表 */}
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
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onClick={() => setActiveLang(lang.code)}
              >
                <span>{lang.name}</span>
                <Button type="link" danger size="small" onClick={(e) => { e.stopPropagation(); clearLanguageValues(lang.code) }}>
                  {t('content.metadata.clear')}
                </Button>
              </div>
            ))}
          </div>
        </Col>

        {/* 右侧语言表单 */}
        <Col span={18}>
          <div style={{ marginBottom: 12, fontWeight: 600 }}>
            {t('content.metadata.language')}: {otherLanguageOptions.find((item) => item.code === activeLang)?.name ?? activeLang}
          </div>
          <Form layout="vertical">
            <Row gutter={16}>
              {multiLanguageFields.map((field) => (
                <Col span={12} key={field.id}>
                  <Form.Item
                    label={field.field_name}
                    tooltip={field.tip ?? undefined}
                    validateStatus={customFieldErrors[field.id]?.[activeLang] ? 'error' : ''}
                    help={customFieldErrors[field.id]?.[activeLang] || ''}
                  >
                    {renderCustomFieldInput(field, activeLang)}
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </Form>
        </Col>
      </Row>
    )
  }

  return (
    <div className="main-container">
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
        {canOperate && (
          <Popconfirm title={`${t('common.confirm')} ${t('common.batchDelete')} ${selectedIds.length} ${t('common.action')}？`} okText={t('common.confirm')} cancelText={t('common.cancel')} onConfirm={() => void handleBatchDelete()} disabled={selectedIds.length === 0}>
            <Button danger disabled={selectedIds.length === 0}>{t('common.batchDelete')} {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}</Button>
          </Popconfirm>
        )}
        {canOperate && (
          <Button type="primary" onClick={openCreate}>{t('posterSize.toolbar.newPosterSize')}</Button>
        )}
      </div>

      <ResizableTable<PosterSizeListItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={list}
        scroll={{ x: 1100 }}
        onChange={handleTableChange}
        rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as number[]) }}
        pagination={tablePaginationProps}
        size="small"
      />

      <Modal
        title={editingRecord ? t('posterSize.modal.titleEdit') : t('posterSize.modal.titleCreate')}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden={false}
        width={800}
      >
        <Form form={mainForm} layout="vertical" preserve={true}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            destroyInactiveTabPane={false}
            items={[
              {
                key: 'main',
                label: t('posterSize.tab.main'),
                forceRender: true,
                children: (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="name" label={t('posterSize.form.nameLabel')} rules={[{ required: true, message: t('posterSize.form.nameRequired') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                        <TrimInput placeholder={t('posterSize.form.nameRequired')} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="belongings" label={t('posterSize.form.belongingLabel')} rules={[{ required: true, message: t('posterSize.form.belongingRequired') }]}>
                        <Select showSearch optionFilterProp="label" mode="multiple" placeholder={t('posterSize.form.belongingRequired')} options={Object.entries(BELONGING_KEYS).map(([value, labelKey]) => ({ label: t(labelKey as any), value }))} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="extensions" label={t('posterSize.form.extensionsLabel')} rules={[{ required: true, message: t('posterSize.form.extensionsRequired') }]}>
                        <Select showSearch optionFilterProp="label" mode="multiple" placeholder={t('posterSize.form.extensionsRequired')} options={extensionOptions} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="mapping_type" label={t('posterSize.form.mappingTypeLabel')} rules={[{ required: true, message: t('posterSize.form.mappingTypeRequired') }]}>
                        <Select 
                          showSearch 
                          optionFilterProp="label" 
                          placeholder={t('posterSize.form.mappingTypeRequired')} 
                          options={mappingTypeOptions} 
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="width" label={t('posterSize.form.widthLabel')} rules={[{ required: true, message: t('posterSize.form.widthRequired') }, { validator: (_, value) => value === -1 || (Number.isInteger(value) && value > 0) ? Promise.resolve() : Promise.reject(new Error(t('posterSize.form.dimensionInvalid'))) }]}>
                        <InputNumber style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="height" label={t('posterSize.form.heightLabel')} rules={[{ required: true, message: t('posterSize.form.heightRequired') }, { validator: (_, value) => value === -1 || (Number.isInteger(value) && value > 0) ? Promise.resolve() : Promise.reject(new Error(t('posterSize.form.dimensionInvalid'))) }]}>
                        <InputNumber style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label={t('posterSize.col.aspectRatio')}>
                        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.width !== cur.width || prev.height !== cur.height}>
                          {({ getFieldValue }) => {
                            const w = getFieldValue('width')
                            const h = getFieldValue('height')
                            let aspectRatio = ''
                            if (w > 0 && h > 0) {
                              const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
                              const g = gcd(w, h)
                              aspectRatio = `${w / g}:${h / g}`
                            }
                            return <Input style={{ width: '100%' }} value={aspectRatio} disabled placeholder={t('posterSize.form.aspectRatioPlaceholder')} />
                          }}
                        </Form.Item>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="max_file_size_kb" label={t('posterSize.form.maxFileSizeLabel')} rules={[{ required: true, message: t('posterSize.form.maxFileSizeRequired') }, { validator: (_, value) => value === -1 || (Number.isInteger(value) && value > 0) ? Promise.resolve() : Promise.reject(new Error(t('posterSize.form.dimensionInvalid'))) }]}>
                        <InputNumber style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="mandatory" label={t('posterSize.form.mandatoryLabel')} valuePropName="checked">
                        <Switch checkedChildren={t('common.yes')} unCheckedChildren={t('common.no')} />
                      </Form.Item>
                    </Col>
                  </Row>
                ),
              },
              {
                key: 'custom-fields',
                label: t('posterSize.tab.customFields'),
                forceRender: true,
                children: (
                  <Form layout="vertical">
                    <Row gutter={16}>
                    {customFieldItems.length === 0 ? (
                      <Col span={24}>{t('posterSize.tab.noCustomFields')}</Col>
                    ) : customFieldItems.map((field) => {
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
                          {renderCustomFieldInput(field, field.multi_language ? defaultLang : undefined)}
                        </Form.Item>
                      </Col>
                      )
                    })}
                    </Row>
                  </Form>
                ),
              },
              ...(hasMultiLang ? [{
                key: 'multiLanguages',
                label: t('content.metadata.tab.multiLanguages'),
                forceRender: true,
                children: renderMultiLanguagesTab(),
              }] : []),
            ]}
          />
        </Form>
      </Modal>
    </div>
  )
}
