import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Form,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { batchDeleteTags, createTag, deleteTag, getTags, updateTag } from '../../api/tags'
import { getMultiLanguageOptions } from '../../api/i18n'
import SearchForm from '../../components/SearchForm'
import TrimInput from '../../components/TrimInput'
import type { LanguageOption } from '../../types/i18n'
import type { TagCreatePayload, TagListItem, TagUpdatePayload } from '../../types/basic'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'
import { useFormRules } from '../../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../../constants/form'

interface SearchValues {
  name?: string
  languages?: string[]
}

interface FormValues {
  name: string
  language: string
}

export default function TagManagement() {
  const { t } = useI18n()
  const formRules = useFormRules()
  const [itemForm] = Form.useForm<FormValues>()
  const [list, setList] = useState<TagListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<TagListItem | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([])
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.basic.tags.operate')
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filters, sortField, sortOrder)
    },
  })

  // ─── 搜索字段配置 ───────────────────────────────────────────────────────────

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'name',
      labelKey: 'tag.form.nameLabel',
      type: 'input',
      placeholderKey: 'tag.form.nameRequired',
    },
    {
      name: 'languages',
      labelKey: 'tag.form.languageLabel',
      type: 'multiSelect',
      placeholderKey: 'tag.form.languageRequired',
      options: languageOptions.map((item) => ({ label: item.name, value: item.code })),
    },
  ], [languageOptions, t])

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
      const data = await getTags({
        page,
        page_size: pageSize,
        ...nextFilters,
        sort_by: nextSortField ?? undefined,
        sort_order: nextSortOrder === 'ascend' ? 'asc' : nextSortOrder === 'descend' ? 'desc' : undefined,
      })
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
    itemForm.resetFields()
    setModalOpen(true)
  }

  const openEdit = (record: TagListItem) => {
    setEditingRecord(record)
    itemForm.setFieldsValue({ name: record.name, language: record.language })
    setModalOpen(true)
  }

  const closeModal = () => {
    itemForm.resetFields()
    setModalOpen(false)
    setEditingRecord(null)
  }

  const handleSubmit = async () => {
    const values = await itemForm.validateFields()
    const current = editingRecord
    setSubmitting(true)
    try {
      if (current) {
        const payload: TagUpdatePayload = { name: values.name, language: values.language }
        await updateTag(current.id, payload)
        closeModal()
        message.success(t('tag.msg.updated'))
      } else {
        const payload: TagCreatePayload = { name: values.name, language: values.language }
        await createTag(payload)
        closeModal()
        message.success(t('tag.msg.created'))
      }
      void loadList(current ? pagination.current : 1, pagination.pageSize, filters, sortField, sortOrder)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record: TagListItem) => {
    await deleteTag(record.id)
    message.success(t('common.msg.deleted'))
    setSelectedIds(prev => prev.filter(id => id !== record.id))
    void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    await batchDeleteTags({ ids: selectedIds })
    message.success(t('common.msg.deleted'))
    setSelectedIds([])
    void loadList(1, pagination.pageSize, filters, sortField, sortOrder)
  }

  const languageMap = useMemo(() => {
    const map = new Map<string, string>()
    languageOptions.forEach(item => map.set(item.code, item.name))
    return map
  }, [languageOptions])

  const columns: ColumnsType<TagListItem> = [
    { title: t('tag.col.name'), dataIndex: 'name', key: 'name', sorter: true, sortOrder: sortField === 'name' ? sortOrder : null },
    { title: t('tag.col.language'), dataIndex: 'language', key: 'language', sorter: true, sortOrder: sortField === 'language' ? sortOrder : null, render: (value: string) => <Tag color="blue">{languageMap.get(value) ?? value}</Tag> },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 160,
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
            <Popconfirm title={`${t('common.confirm')} ${t('common.batchDelete')} ${selectedIds.length} ${t('common.action')}？`} okText={t('common.confirm')} cancelText={t('common.cancel')} onConfirm={() => void handleBatchDelete()} disabled={selectedIds.length === 0}>
              <Button danger disabled={selectedIds.length === 0}>{t('common.batchDelete')} {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}</Button>
            </Popconfirm>
          )}
          {canOperate && (
            <Button type="primary" onClick={openCreate}>{t('tag.toolbar.newTag')}</Button>
          )}
        </div>

        <Table<TagListItem>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={list}
          scroll={{ x: 700 }}
          onChange={handleTableChange}
          rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as number[]) }}
          pagination={tablePaginationProps}
          size="small"
        />

      <Modal title={editingRecord ? t('tag.modal.titleEdit') : t('tag.modal.titleCreate')} open={modalOpen} onCancel={closeModal} onOk={() => void handleSubmit()} confirmLoading={submitting} okText={t('common.confirm')} cancelText={t('common.cancel')} destroyOnHidden>
        <Form form={itemForm} layout="vertical">
          <Form.Item name="name" label={t('tag.form.nameLabel')} rules={[{ required: true, message: t('tag.form.nameRequired') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
            <TrimInput placeholder={t('tag.form.nameRequired')} />
          </Form.Item>
          <Form.Item name="language" label={t('tag.form.languageLabel')} rules={[{ required: true, message: t('tag.form.languageRequired') }]}>
            <Select showSearch optionFilterProp="label" placeholder={t('tag.form.languageRequired')} options={languageOptions.map((item) => ({ label: item.name, value: item.code }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
