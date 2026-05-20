import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Col,
  Form,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { DeleteOutlined, EditOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  batchDeleteCustomFields,
  createCustomField,
  deleteCustomField,
  getCustomFields,
  updateCustomField,
} from '../../api/customFields'
import { getMultiLanguageOptions } from '../../api/i18n'
import SearchForm from '../../components/SearchForm'
import TrimInput from '../../components/TrimInput'
import type { LanguageOption } from '../../types/i18n'
import type {
  CustomFieldCreatePayload,
  CustomFieldListItem,
  CustomFieldOptionItem,
  CustomFieldQueryParams,
  CustomFieldUpdatePayload,
} from '../../types/basic'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'
import { useFormRules } from '../../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../../constants/form'

const FIELD_TYPES = [
  'Text', 'LongText', 'Integer', 'Decimal',
  'DropList', 'DropList_multiple', 'Date', 'Time', 'Date+Time',
] as const

const BELONGING_OPTIONS = [
  'Program', 'Series', 'Movie', 'Cast', 'CastRoleMap',
  'Picture', 'Category', 'Package', 'Channel', 'PhysicalChannel', 'Schedule', 'ALL',
] as const

const fieldTypeI18nKey = (ft: string) => `customField.fieldType.${ft}` as `customField.fieldType.${(typeof FIELD_TYPES)[number]}`
const belongingI18nKey = (b: string) => `customField.belonging.${b}` as `customField.belonging.${(typeof BELONGING_OPTIONS)[number]}`

interface SearchValues {
  field_name?: string
  field_type?: string
  belongings?: string[]
  mandatory?: boolean
}

interface FormValues {
  field_name: string
  field_type: string
  belongings: string[]
  mandatory: boolean
  multi_language: boolean
  tip?: string
}

export default function CustomFieldManagement() {
  const { t } = useI18n()
  const formRules = useFormRules()
  const [itemForm] = Form.useForm<FormValues>()
  const [list, setList] = useState<CustomFieldListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRecord, setDetailRecord] = useState<CustomFieldListItem | null>(null)
  const [editingRecord, setEditingRecord] = useState<CustomFieldListItem | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const { hasPermission } = usePermission()
  const canView = hasPermission('menu.basic.customFields.view') || hasPermission('menu.basic.customFields.operate')
  const canOperate = hasPermission('menu.basic.customFields.operate')
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filters, sortField, sortOrder)
    },
  })
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([])
  const [options, setOptions] = useState<CustomFieldOptionItem[]>([])
  const [fieldType, setFieldType] = useState<string>('')
  const [multiLanguage, setMultiLanguage] = useState(false)
  const nextKey = useRef(0)

  // ─── 搜索字段配置 ───────────────────────────────────────────────────────────

  const searchFields: SearchFieldConfig[] = [
    {
      name: 'field_name',
      labelKey: 'customField.col.fieldName',
      type: 'input',
      placeholderKey: 'customField.placeholder.fieldName',
    },
    {
      name: 'field_type',
      labelKey: 'customField.col.fieldType',
      type: 'select',
      placeholderKey: 'customField.placeholder.fieldType',
      options: FIELD_TYPES.map((ft) => ({ label: ft, value: ft, labelKey: fieldTypeI18nKey(ft) })),
    },
    {
      name: 'belongings',
      labelKey: 'customField.col.belonging',
      type: 'multiSelect',
      placeholderKey: 'customField.placeholder.belonging',
      options: BELONGING_OPTIONS.map((b) => ({ label: b, value: b, labelKey: belongingI18nKey(b) })),
    },
    {
      name: 'mandatory',
      labelKey: 'customField.col.mandatory',
      type: 'select',
      placeholderKey: 'common.placeholder.select',
      options: [
        { label: '是', labelKey: 'customField.form.yes', value: 1 },
        { label: '否', labelKey: 'customField.form.no', value: 0 },
      ],
    },
  ]

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
      const params: CustomFieldQueryParams = {
        page,
        page_size: pageSize,
        ...nextFilters,
        sort_by: nextSortField ?? undefined,
        sort_order: nextSortOrder === 'ascend' ? 'asc' : nextSortOrder === 'descend' ? 'desc' : undefined,
      }
      const data = await getCustomFields(params)
      setList(data.items)
      updatePagination(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      const [langs] = await Promise.all([getMultiLanguageOptions(), loadList(1, 10, {})])
      setLanguageOptions(langs)
    })()
  }, [])


  const openCreate = () => {
    setEditingRecord(null)
    setOptions([])
    setFieldType('')
    setMultiLanguage(false)
    itemForm.resetFields()
    itemForm.setFieldsValue({ mandatory: true, multi_language: false })
    setModalOpen(true)
  }

  const openEdit = (record: CustomFieldListItem) => {
    setEditingRecord(record)
    setFieldType(record.field_type)
    setMultiLanguage(record.multi_language)
    setOptions(record.options.map((o, i) => ({ ...o, _key: i })))
    nextKey.current = record.options.length
    itemForm.setFieldsValue({
      field_name: record.field_name,
      field_type: record.field_type,
      belongings: record.belongings,
      mandatory: record.mandatory,
      multi_language: record.multi_language,
      tip: record.tip ?? undefined,
    })
    setModalOpen(true)
  }

  const openDetail = (record: CustomFieldListItem) => {
    setDetailRecord(record)
    setDetailOpen(true)
  }

  const closeModal = () => {
    itemForm.resetFields()
    setModalOpen(false)
    setEditingRecord(null)
    setOptions([])
    setFieldType('')
    setMultiLanguage(false)
  }

  const isDropList = (ft: string) => ft === 'DropList' || ft === 'DropList_multiple'

  const handleSubmit = async () => {
    const values = await itemForm.validateFields()
    const current = editingRecord

    if (isDropList(values.field_type)) {
      if (options.length === 0) {
        message.error(t('customField.msg.optionsRequired'))
        return
      }
      const codeSet = new Set<string>()
      for (let i = 0; i < options.length; i++) {
        const o = options[i]
        if (!o.code?.trim()) {
          message.error(t('customField.msg.codeRequired', { index: i + 1 }))
          return
        }
        const trimmedCode = o.code.trim()
        if (codeSet.has(trimmedCode)) {
          message.error(t('customField.msg.codeDuplicate', { index: i + 1, code: trimmedCode }))
          return
        }
        codeSet.add(trimmedCode)
      }
      if (values.multi_language && languageOptions.length > 0) {
        const firstLang = languageOptions[0]
        for (let i = 0; i < options.length; i++) {
          const o = options[i]
          if (!o.names?.[firstLang.code]?.trim()) {
            message.error(t('customField.msg.firstLangRequired', { index: i + 1, lang: firstLang.name }))
            return
          }
        }
      } else {
        for (let i = 0; i < options.length; i++) {
          const o = options[i]
          if (!o.names?.['default']?.trim()) {
            message.error(t('customField.msg.nameRequired', { index: i + 1 }))
            return
          }
        }
      }
    }

    setSubmitting(true)
    try {
      const optionPayload = isDropList(values.field_type) ? options.map((o, i) => ({
        id: o.id,
        code: o.code,
        names: o.names,
        sort_order: i,
      })) : []

      if (current) {
        const payload: CustomFieldUpdatePayload = {
          field_name: values.field_name,
          field_type: values.field_type,
          belongings: values.belongings,
          mandatory: values.mandatory,
          multi_language: values.multi_language,
          tip: values.tip ?? null,
          options: optionPayload,
        }
        await updateCustomField(current.id, payload)
        message.success(t('customField.msg.updated'), 3)
      } else {
        const payload: CustomFieldCreatePayload = {
          field_name: values.field_name,
          field_type: values.field_type,
          belongings: values.belongings,
          mandatory: values.mandatory,
          multi_language: values.multi_language,
          tip: values.tip ?? null,
          options: optionPayload,
        }
        await createCustomField(payload)
        message.success(t('customField.msg.created'), 3)
      }
      closeModal()
      void loadList(current ? pagination.current : 1, pagination.pageSize, filters, sortField, sortOrder)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record: CustomFieldListItem) => {
    await deleteCustomField(record.id)
    message.success(t('common.msg.deleted'), 3)
    setSelectedIds(prev => prev.filter(id => id !== record.id))
    void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    await batchDeleteCustomFields({ ids: selectedIds })
    message.success(t('customField.msg.batchDeleted', { count: selectedIds.length }), 3)
    setSelectedIds([])
    void loadList(1, pagination.pageSize, filters, sortField, sortOrder)
  }

  const addOptionRow = () => {
    setOptions(prev => [...prev, { code: '', names: {}, sort_order: prev.length, _key: nextKey.current++ } as CustomFieldOptionItem & { _key: number }])
  }

  const removeOptionRow = (idx: number) => {
    setOptions(prev => prev.filter((_, i) => i !== idx))
  }

  const updateOptionField = (idx: number, field: string, value: string) => {
    setOptions(prev => prev.map((o, i) => {
      if (i !== idx) return o
      if (field === 'code') return { ...o, code: value }
      return { ...o, names: { ...o.names, [field]: value } }
    }))
  }

  const optionColumns = (): ColumnsType<CustomFieldOptionItem & { _key?: number }> => {
    const cols: ColumnsType<CustomFieldOptionItem & { _key?: number }> = [
      {
        title: 'NO.',
        width: 60,
        render: (_, __, idx) => idx + 1,
      },
      {
        title: t('customField.form.code'),
        dataIndex: 'code',
        render: (val: string, _, idx) => (
          <TrimInput
            size="small"
            value={val}
            placeholder={t('customField.option.codePlaceholder')}
            onChange={e => updateOptionField(idx, 'code', e.target.value)}
          />
        ),
      },
    ]

    if (multiLanguage && languageOptions.length > 0) {
      languageOptions.forEach(lang => {
        cols.push({
          title: `${t('customField.form.name')}_${lang.name}`,
          render: (_, record, idx) => (
            <TrimInput
              size="small"
              value={record.names?.[lang.code] ?? ''}
              placeholder={lang.name}
              onChange={e => updateOptionField(idx, lang.code, e.target.value)}
            />
          ),
        })
      })
    } else {
      cols.push({
        title: t('customField.form.name'),
        render: (_, record, idx) => (
          <TrimInput
            size="small"
            value={record.names?.['default'] ?? ''}
            placeholder={t('customField.option.namePlaceholder')}
            onChange={e => updateOptionField(idx, 'default', e.target.value)}
          />
        ),
      })
    }

    cols.push({
      title: t('common.delete'),
      width: 60,
      render: (_, __, idx) => (
        <Button
          type="link"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => removeOptionRow(idx)}
        />
      ),
    })

    return cols
  }

  const columns: ColumnsType<CustomFieldListItem> = [
    { title: t('customField.col.fieldName'), dataIndex: 'field_name', key: 'field_name', sorter: true, sortOrder: sortField === 'field_name' ? sortOrder : null },
    { title: t('customField.col.fieldType'), dataIndex: 'field_type', key: 'field_type',sorter: true, sortOrder: sortField === 'field_type' ? sortOrder : null,
      render: (v: string) => <Tag color="blue">{t(fieldTypeI18nKey(v))}</Tag> },
    {
      title: t('customField.col.belonging'),
      dataIndex: 'belongings',
      key: 'belongings',
      render: (vals: string[]) => (
        <Space size={4} wrap>
          {vals.map(v => <Tag key={v}>{t(belongingI18nKey(v))}</Tag>)}
        </Space>
      ),
    },
    {
      title: t('customField.col.mandatory'),
      dataIndex: 'mandatory',
      key: 'mandatory',
      sorter: true,
      sortOrder: sortField === 'mandatory' ? sortOrder : null,
      render: (v: boolean) => v ? <Tag color="green">{t('customField.form.yes')}</Tag> : <Tag>{t('customField.form.no')}</Tag>,
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space size={0}>
          {canView && (
            <Tooltip title={t('common.detail')}>
              <Button type="link" size="small" icon={<InfoCircleOutlined />} onClick={() => openDetail(record)} />
            </Tooltip>
          )}
          {canOperate && (
            <Tooltip title={t('common.edit')}>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
            </Tooltip>
          )}
          {canOperate && (
            <Popconfirm
              title={t('common.confirmDelete', { name: record.field_name })}
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
      ),
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
          {canOperate && (
            <Popconfirm
              title={t('common.confirmDeleteSelected', { count: selectedIds.length })}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              onConfirm={() => void handleBatchDelete()}
              disabled={selectedIds.length === 0}
            >
              <Button danger disabled={selectedIds.length === 0}>
                {t('common.batchDelete')}{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
              </Button>
            </Popconfirm>
          )}
          {canOperate && (
            <Button type="primary" onClick={openCreate}>{t('customField.toolbar.newField')}</Button>
          )}
        </div>

        <Table<CustomFieldListItem>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={list}
          scroll={{ x: 900 }}
          onChange={handleTableChange}
          rowSelection={{ selectedRowKeys: selectedIds, onChange: keys => setSelectedIds(keys as number[]) }}
          pagination={tablePaginationProps}
          size="small"
        />

      {/* 新增/编辑弹框 */}
      <Modal
        title={editingRecord ? t('customField.modal.titleEdit') : t('customField.modal.titleCreate')}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        width={800}
        destroyOnHidden
      >
        <Form form={itemForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="field_name" label={t('customField.form.fieldName')} rules={[{ required: true, message: t('customField.form.nameRequired') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                <TrimInput placeholder={t('customField.placeholder.fieldName')} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="field_type" label={t('customField.form.fieldType')} rules={[{ required: true, message: t('customField.form.typeRequired') }]}>
                <Select
                  showSearch optionFilterProp="label"
                  placeholder={t('customField.placeholder.fieldType')}
                  style={{ width: '100%' }}
                  options={FIELD_TYPES.map(ft => ({ label: t(fieldTypeI18nKey(ft)), value: ft }))}
                  onChange={v => { setFieldType(v); if (!isDropList(v)) setOptions([]) }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="belongings" label={t('customField.form.belonging')} rules={[{ required: true, message: t('customField.form.belongingRequired') }]}>
                <Select
                  showSearch optionFilterProp="label"
                  mode="multiple"
                  placeholder={t('customField.placeholder.belonging')}
                  style={{ width: '100%' }}
                  options={BELONGING_OPTIONS.map(b => ({ label: t(belongingI18nKey(b)), value: b }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tip" label={t('customField.form.tip')} rules={[formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                <TrimInput placeholder={t('customField.placeholder.tip')} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mandatory" label={t('customField.form.mandatory')} valuePropName="checked">
                <Switch checkedChildren={t('customField.form.yes')} unCheckedChildren={t('customField.form.no')} defaultChecked />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="multi_language" label={t('customField.form.multiLanguage')} valuePropName="checked">
                <Switch
                  checkedChildren={t('customField.form.yes')}
                  unCheckedChildren={t('customField.form.no')}
                  onChange={v => setMultiLanguage(v)}
                />
              </Form.Item>
            </Col>
          </Row>

          {isDropList(fieldType) && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>{t('customField.form.options')}</span>
                <Button type="primary" ghost size="small" icon={<PlusOutlined />} onClick={addOptionRow}>{t('customField.form.addRow')}</Button>
              </div>
              <Table<CustomFieldOptionItem & { _key?: number }>
                rowKey={r => String((r as CustomFieldOptionItem & { _key?: number })._key ?? r.code)}
                size="small"
                pagination={false}
                dataSource={options as (CustomFieldOptionItem & { _key?: number })[]}
                columns={optionColumns()}
                scroll={{ x: 500 }}
              />
            </div>
          )}
        </Form>
      </Modal>

      {/* 详情弹框 */}
      <Modal
        title={t('customField.detail.title')}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>{t('common.close')}</Button>}
        width={800}
        destroyOnHidden
      >
        {detailRecord && (
          <Form layout="vertical" initialValues={detailRecord}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="field_name" label={t('customField.form.fieldName')}>
                  <TrimInput disabled style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="field_type" label={t('customField.form.fieldType')}>
                  <Select disabled style={{ width: '100%' }} options={FIELD_TYPES.map(ft => ({ label: t(fieldTypeI18nKey(ft)), value: ft }))} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="belongings" label={t('customField.form.belonging')}>
              <Select disabled mode="multiple" style={{ width: '100%' }} options={BELONGING_OPTIONS.map(b => ({ label: t(belongingI18nKey(b)), value: b }))} />
            </Form.Item>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="mandatory" label={t('customField.form.mandatory')} valuePropName="checked">
                  <Switch disabled checkedChildren={t('customField.form.yes')} unCheckedChildren={t('customField.form.no')} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="multi_language" label={t('customField.form.multiLanguage')} valuePropName="checked">
                  <Switch disabled checkedChildren={t('customField.form.yes')} unCheckedChildren={t('customField.form.no')} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="tip" label={t('customField.form.tip')}>
              <TrimInput disabled style={{ width: '100%' }} />
            </Form.Item>
            {isDropList(detailRecord.field_type) && detailRecord.options.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 500 }}>{t('customField.form.options')}</span>
                </div>
                <Table
                  size="small"
                  pagination={false}
                  rowKey="code"
                  dataSource={detailRecord.options}
                  columns={
                    detailRecord.multi_language && languageOptions.length > 0
                      ? [
                          { title: 'NO.', width: 60, render: (_: unknown, __: unknown, i: number) => i + 1 },
                          { title: t('customField.form.code'), dataIndex: 'code' },
                          ...languageOptions.map(lang => ({
                            title: `${t('customField.form.name')}_${lang.name}`,
                            render: (_: unknown, record: CustomFieldOptionItem) => record.names?.[lang.code] ?? '-',
                          })),
                        ]
                      : [
                          { title: 'NO.', width: 60, render: (_: unknown, __: unknown, i: number) => i + 1 },
                          { title: t('customField.form.code'), dataIndex: 'code' },
                          {
                            title: t('customField.form.name'),
                            render: (_: unknown, record: CustomFieldOptionItem) => record.names?.['default'] ?? '-',
                          },
                        ]
                  }
                  scroll={{ x: 500 }}
                />
              </div>
            )}
          </Form>
        )}
      </Modal>
    </div>
  )
}
