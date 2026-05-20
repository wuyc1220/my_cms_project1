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
  Table,
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
  getPosterSizes,
  savePosterSizeFieldValues,
  updatePosterSize,
} from '../../api/posterSizes'
import { getCustomFields } from '../../api/customFields'
import { getDictTree } from '../../api/dicts'
import SearchForm from '../../components/SearchForm'
import TrimInput from '../../components/TrimInput'
import type { DictNodeListItem } from '../../types/dict'
import type {
  CustomFieldListItem,
  EntityFieldValueItem,
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

const BELONGING_OPTIONS = [
  'Cast', 'Category', 'Program', 'Series', 'Channel', 'Schedule',
].map((item) => ({ label: item, value: item }))

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
  mapping_type: number
  mandatory: boolean
  [key: string]: any
}

const isMultiSelectField = (fieldType: string) => fieldType === 'DropList_multiple'
const isSelectField = (fieldType: string) => fieldType === 'DropList' || fieldType === 'DropList_multiple'
const isLongTextField = (fieldType: string) => fieldType === 'LongText'
const isNumberField = (fieldType: string) => fieldType === 'Integer' || fieldType === 'Decimal'

const getFieldOptionLabel = (field: CustomFieldListItem, optionCode: string, preferredLanguage?: string) => {
  const option = field.options.find((item) => item.code === optionCode)
  if (!option) return optionCode
  return option.names[preferredLanguage ?? ''] ?? option.names.default ?? Object.values(option.names)[0] ?? option.code
}

export default function PosterSizeManagement() {
  const { t, language } = useI18n()
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

  const customFieldItems = useMemo(
    () => customFields.filter((item) => item.belongings.includes('ALL') || item.belongings.includes('Picture')),
    [customFields],
  )

  const inputPlaceholder = (name: string) => language === 'cn' ? `请输入${name}` : `Enter ${name}`
  const selectPlaceholder = (name: string) => language === 'cn' ? `请选择${name}` : `Select ${name}`

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
      options: BELONGING_OPTIONS,
    },
    {
      name: 'mandatory',
      labelKey: 'posterSize.search.mandatory',
      type: 'select',
      placeholderKey: 'common.placeholder.all',
      options: [
        { label: 'YES', value: 'true' },
        { label: 'NO', value: 'false' },
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
      const [dicts, fields] = await Promise.all([
        getDictTree({ code: 'Image_file_extensions' }),
        getCustomFields({ page: 1, page_size: 200, belongings: ['ALL', 'Picture'] }),
        loadList(1, 10, {}),
      ])
      const root = dicts.find((item) => item.code === 'Image_file_extensions')
      setExtensionOptions((root?.children ?? []).map((item: DictNodeListItem) => ({ label: item.name, value: item.code })))
      setCustomFields(fields.items)
    })()
  }, [])

  // 获取自定义字段的表单字段名
  const getCustomFieldName = (fieldId: number) => `custom_field_${fieldId}`

  // 获取自定义字段的校验规则
  const getCustomFieldRules = (field: CustomFieldListItem) => {
    const rules: any[] = []
    if (field.mandatory) {
      rules.push({
        required: true,
        message: language === 'cn' ? `请填写${field.field_name}` : `Please fill in ${field.field_name}`,
      })
    }
    return rules
  }

  const resetExtraState = () => {
    customFieldItems.forEach((field) => {
      mainForm.setFieldValue(getCustomFieldName(field.id), undefined)
    })
  }

  const openCreate = () => {
    setEditingRecord(null)
    setActiveTab('main')
    mainForm.resetFields()
    resetExtraState()
    mainForm.setFieldsValue({ width: -1, height: -1, max_file_size_kb: -1, mandatory: false, belongings: [], extensions: [], mapping_type: undefined })
    const initialCustomFieldValues: Record<string, any> = {}
    customFieldItems.forEach((field) => {
      initialCustomFieldValues[getCustomFieldName(field.id)] = undefined
    })
    mainForm.setFieldsValue(initialCustomFieldValues)
    setModalOpen(true)
  }

  const openEdit = (record: PosterSizeListItem) => {
    setEditingRecord(record)
    setActiveTab('main')
    resetExtraState()
    mainForm.setFieldsValue({
      name: record.name,
      belongings: record.belongings,
      extensions: record.extensions,
      width: record.width,
      height: record.height,
      max_file_size_kb: record.max_file_size_kb,
      mapping_type: record.mapping_type ?? undefined,
      mandatory: record.mandatory,
    })
    setModalOpen(true)
    void (async () => {
      const savedFields = await getPosterSizeFieldValues(record.id)
      savedFields.forEach((item: EntityFieldValueItem) => {
        const fieldName = getCustomFieldName(item.custom_field_id)
        const field = customFieldItems.find(f => f.id === item.custom_field_id)
        if (field && isMultiSelectField(field.field_type)) {
          const value = item.value ?? ''
          mainForm.setFieldValue(fieldName, value ? value.split(',').filter(Boolean) : [])
        } else {
          mainForm.setFieldValue(fieldName, item.value ?? '')
        }
      })
    })()
  }

  const closeModal = () => {
    mainForm.resetFields()
    setModalOpen(false)
    setEditingRecord(null)
    setActiveTab('main')
    resetExtraState()
  }

  const buildFieldValuePayload = () => {
    const formValues = mainForm.getFieldsValue()
    return customFieldItems.map((field) => {
      const fieldName = getCustomFieldName(field.id)
      let value = formValues[fieldName]
      if (isMultiSelectField(field.field_type) && Array.isArray(value)) {
        value = value.join(',')
      }
      return { custom_field_id: field.id, value: value ?? '' }
    })
  }

  const handleSubmit = async () => {
    const mainFieldNames = ['name', 'belongings', 'extensions', 'width', 'height', 'max_file_size_kb', 'mapping_type']
    const customFieldNames = customFieldItems.map(field => getCustomFieldName(field.id))

    const currentTabFieldNames = activeTab === 'custom-fields' ? customFieldNames : mainFieldNames
    const otherTabFieldNames = activeTab === 'custom-fields' ? mainFieldNames : customFieldNames
    const otherTabKey = activeTab === 'custom-fields' ? 'main' : 'custom-fields'

    try {
      await mainForm.validateFields(currentTabFieldNames)
    } catch (errorInfo: any) {
      if (errorInfo.errorFields && errorInfo.errorFields.length > 0) {
        return
      }
    }

    try {
      await mainForm.validateFields(otherTabFieldNames)
    } catch (errorInfo: any) {
      if (errorInfo.errorFields && errorInfo.errorFields.length > 0) {
        setActiveTab(otherTabKey)
        return
      }
    }

    try {
      const values = await mainForm.validateFields([...mainFieldNames, ...customFieldNames])
      const current = editingRecord
      setSubmitting(true)

      let posterSizeId = current?.id ?? 0
      if (current) {
        const payload: PosterSizeUpdatePayload = { ...values }
        const updated = await updatePosterSize(current.id, payload)
        posterSizeId = updated.id
        void message.success(t('posterSize.msg.updated'), 3)
      } else {
        const payload: PosterSizeCreatePayload = { ...values }
        const created = await createPosterSize(payload)
        posterSizeId = created.id
        void message.success(t('posterSize.msg.created'), 3)
      }

      await savePosterSizeFieldValues(posterSizeId, { values: buildFieldValuePayload() })

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

  const renderCustomFieldInput = (field: CustomFieldListItem) => {
    const fieldName = getCustomFieldName(field.id)
    
    if (isSelectField(field.field_type)) {
      if (isMultiSelectField(field.field_type)) {
        return (
          <Form.Item
            name={fieldName}
            label={field.field_name}
            rules={getCustomFieldRules(field)}
            tooltip={field.tip ?? undefined}
          >
            <Select
              showSearch optionFilterProp="label"
              mode="multiple"
              allowClear
              placeholder={field.tip ?? selectPlaceholder(field.field_name)}
              options={field.options.map((item) => ({
                label: getFieldOptionLabel(field, item.code),
                value: item.code,
              }))}
            />
          </Form.Item>
        )
      }
      return (
        <Form.Item
          name={fieldName}
          label={field.field_name}
          rules={getCustomFieldRules(field)}
          tooltip={field.tip ?? undefined}
        >
          <Select
            showSearch optionFilterProp="label"
            allowClear
            placeholder={field.tip ?? selectPlaceholder(field.field_name)}
            options={field.options.map((item) => ({
              label: getFieldOptionLabel(field, item.code),
              value: item.code,
            }))}
          />
        </Form.Item>
      )
    }
    if (isLongTextField(field.field_type)) {
      return (
        <Form.Item
          name={fieldName}
          label={field.field_name}
          rules={getCustomFieldRules(field)}
          tooltip={field.tip ?? undefined}
        >
          <TrimInput.TextArea
            rows={3}
            placeholder={field.tip ?? inputPlaceholder(field.field_name)}
          />
        </Form.Item>
      )
    }
    if (isNumberField(field.field_type)) {
      return (
        <Form.Item
          name={fieldName}
          label={field.field_name}
          rules={getCustomFieldRules(field)}
          tooltip={field.tip ?? undefined}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder={field.tip ?? inputPlaceholder(field.field_name)}
          />
        </Form.Item>
      )
    }
    return (
      <Form.Item
        name={fieldName}
        label={field.field_name}
        rules={getCustomFieldRules(field)}
        tooltip={field.tip ?? undefined}
      >
        <TrimInput
          placeholder={field.tip ?? inputPlaceholder(field.field_name)}
        />
      </Form.Item>
    )
  }

  const columns: ColumnsType<PosterSizeListItem> = [
    { title: t('posterSize.col.name'), dataIndex: 'name', key: 'name', width: 180, sorter: true, sortOrder: sortField === 'name' ? sortOrder : null },
    { title: t('posterSize.col.belonging'), dataIndex: 'belongings', key: 'belongings', width: 220, render: (values: string[]) => values.map((item) => <Tag key={item}>{item}</Tag>) },
    { title: t('posterSize.col.width'), dataIndex: 'width', key: 'width', width: 100, sorter: true, sortOrder: sortField === 'width' ? sortOrder : null },
    { title: t('posterSize.col.height'), dataIndex: 'height', key: 'height', width: 100, sorter: true, sortOrder: sortField === 'height' ? sortOrder : null },
    { title: t('posterSize.col.aspectRatio'), dataIndex: 'aspect_ratio', key: 'aspect_ratio', width: 100, render: (value: string | null | undefined) => value || '—' },
    { title: t('posterSize.col.maxFileSize'), dataIndex: 'max_file_size_kb', key: 'max_file_size_kb', width: 160, sorter: true, sortOrder: sortField === 'max_file_size_kb' ? sortOrder : null },
    { title: t('posterSize.col.mandatory'), dataIndex: 'mandatory', key: 'mandatory', width: 100, sorter: true, sortOrder: sortField === 'mandatory' ? sortOrder : null, render: (value: boolean) => (value ? <Tag color="red">YES</Tag> : <Tag>NO</Tag>) },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 100,
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

      <Table<PosterSizeListItem>
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
                        <Select showSearch optionFilterProp="label" mode="multiple" placeholder={t('posterSize.form.belongingRequired')} options={BELONGING_OPTIONS} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="extensions" label={t('posterSize.form.extensionsLabel')} rules={[{ required: true, message: t('posterSize.form.extensionsRequired') }]}>
                        <Select showSearch optionFilterProp="label" mode="multiple" placeholder={t('posterSize.form.extensionsRequired')} options={extensionOptions} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="mapping_type" label={t('posterSize.form.mappingTypeLabel')} rules={[{ required: true, message: t('posterSize.form.mappingTypeRequired') }]}>
                        <InputNumber style={{ width: '100%' }} placeholder={t('posterSize.form.mappingTypeRequired')} />
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
                        <Switch checkedChildren="YES" unCheckedChildren="NO" />
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
                  <Row gutter={16}>
                    {customFieldItems.length === 0 ? (
                      <Col span={24}>{t('posterSize.tab.noCustomFields')}</Col>
                    ) : (
                      customFieldItems.map((field) => (
                        <Col span={12} key={field.id}>
                          {renderCustomFieldInput(field)}
                        </Col>
                      ))
                    )}
                  </Row>
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </div>
  )
}
