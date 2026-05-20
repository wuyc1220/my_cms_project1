import dayjs from 'dayjs'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Form,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Upload,
  message,
} from 'antd'
import { DeleteOutlined, EditOutlined, InboxOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  batchDeleteSensitiveWords,
  batchToggleSensitiveWordStatus,
  createSensitiveWord,
  deleteSensitiveWord,
  exportSensitiveWordsExcel,
  getSensitiveWords,
  importSensitiveWordsExcel,
  toggleSensitiveWordStatus,
  updateSensitiveWord,
} from '../../api/sensitiveWords'
import { getDictTree } from '../../api/dicts'
import type { DictNodeListItem } from '../../types/dict'
import type {
  BatchStatusPayload,
  SensitiveWordCreatePayload,
  SensitiveWordListItem,
  SensitiveWordQueryParams,
  SensitiveWordUpdatePayload,
} from '../../types/basic'
import { useI18n } from '../../i18n/useI18n'
import SearchForm from '../../components/SearchForm'
import TrimInput from '../../components/TrimInput'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useSearchForm } from '../../hooks/useSearchForm'
import { useTablePagination } from '../../hooks/useTablePagination'
import { usePermission } from '../../hooks/usePermission'
import { useFormRules } from '../../hooks/useFormRules'
import { isHandledError } from '../../api'
import { FORM_MAX_LENGTH } from '../../constants/form'


interface SearchValues {
  keyword?: string
  type_codes?: string[]
  status?: string
  created_at?: [string, string]
}

interface FormValues {
  keyword: string
  type_code: string
  status: boolean
}

export default function SensitiveWordManagement() {
  const { t } = useI18n()
  const [itemForm] = Form.useForm<FormValues>()
  const [list, setList] = useState<SensitiveWordListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<SensitiveWordListItem | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [typeOptions, setTypeOptions] = useState<Array<{ label: string; value: string }>>([])
  const [importing, setImporting] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.system.sensitiveWords.operate')
  const formRules = useFormRules()

  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } =
    useTablePagination({
      onChange: ({ page, pageSize, sortField, sortOrder }) => {
        void loadList(page, pageSize, filters, sortField, sortOrder)
      },
    })

  const searchFields: SearchFieldConfig[] = useMemo(
    () => [
      {
        name: 'keyword',
        labelKey: 'sensitiveWord.search.keyword',
        type: 'input',
        placeholderKey: 'sensitiveWord.form.keywordRequired',
      },
      {
        name: 'type_codes',
        labelKey: 'sensitiveWord.search.type',
        type: 'multiSelect',
        placeholderKey: 'sensitiveWord.form.typeRequired',
        options: typeOptions,
      },
      {
        name: 'status',
        labelKey: 'sensitiveWord.search.status',
        type: 'select',
        placeholderKey: 'sensitiveWord.search.status',
        options: [
          { label: t('sensitiveWord.status.active'), value: 'active' },
          { label: t('sensitiveWord.status.inactive'), value: 'inactive' },
        ],
      },
      {
        name: 'created_at',
        labelKey: 'sensitiveWord.search.createdAt',
        type: 'dateRange',
      },
    ],
    [typeOptions, t],
  )

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

  const loadList = async (
    page = pagination.current,
    pageSize = pagination.pageSize,
    nextFilters = filters,
    nextSortField?: string | null,
    nextSortOrder?: 'ascend' | 'descend' | null,
  ) => {
    setLoading(true)
    try {
      const params: SensitiveWordQueryParams = {
        page,
        page_size: pageSize,
        keyword: nextFilters.keyword || undefined,
        type_codes: nextFilters.type_codes?.length ? nextFilters.type_codes : undefined,
        status: nextFilters.status || undefined,
        sort_by: nextSortField ?? undefined,
        sort_order:
          nextSortOrder === 'ascend' ? 'asc' : nextSortOrder === 'descend' ? 'desc' : undefined,
      }
      if (nextFilters.created_at && nextFilters.created_at.length === 2) {
        params.created_start = dayjs(nextFilters.created_at[0]).startOf('day').toISOString()
        params.created_end = dayjs(nextFilters.created_at[1]).endOf('day').toISOString()
      }
      const data = await getSensitiveWords(params)
      setList(data.items)
      updatePagination(data)
    } finally {
      setLoading(false)
    }
  }

  const loadTypeOptions = async () => {
    try {
      const tree = await getDictTree({ code: 'Sensitive_Word_Type' })
      const findNode = (nodes: DictNodeListItem[]): DictNodeListItem | undefined => {
        for (const node of nodes) {
          if (node.code === 'Sensitive_Word_Type') return node
          const found = findNode(node.children)
          if (found) return found
        }
        return undefined
      }
      const root = findNode(tree)
      if (root && root.children) {
        setTypeOptions(
          root.children
            .filter((c) => c.status === 'active')
            .map((c) => ({ label: c.name, value: c.code })),
        )
      }
    } catch (err) {
      // ignore
    }
  }

  useEffect(() => {
    void loadTypeOptions()
    void loadList(1, 10, {})
  }, [])

  const openCreate = () => {
    setEditingRecord(null)
    itemForm.resetFields()
    itemForm.setFieldsValue({ status: true })
    setModalOpen(true)
  }

  const openEdit = (record: SensitiveWordListItem) => {
    setEditingRecord(record)
    itemForm.setFieldsValue({
      keyword: record.keyword,
      type_code: record.type_code,
      status: record.status === 'active',
    })
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
        const payload: SensitiveWordUpdatePayload = {
          keyword: values.keyword,
          type_code: values.type_code,
          status: values.status ? 'active' : 'inactive',
        }
        await updateSensitiveWord(current.id, payload)
        closeModal()
        message.success(t('sensitiveWord.msg.updated'))
      } else {
        const payload: SensitiveWordCreatePayload = {
          keyword: values.keyword,
          type_code: values.type_code,
          status: values.status ? 'active' : 'inactive',
        }
        await createSensitiveWord(payload)
        closeModal()
        message.success(t('sensitiveWord.msg.created'))
      }
      void loadList(current ? pagination.current : 1, pagination.pageSize, filters, sortField, sortOrder)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record: SensitiveWordListItem) => {
    await deleteSensitiveWord(record.id)
    message.success(t('sensitiveWord.msg.deleted'))
    setSelectedIds(prev => prev.filter(id => id !== record.id))
    void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    await batchDeleteSensitiveWords({ ids: selectedIds })
    message.success(t('sensitiveWord.msg.deleted'))
    setSelectedIds([])
    void loadList(1, pagination.pageSize, filters, sortField, sortOrder)
  }

  const handleToggleStatus = async (record: SensitiveWordListItem) => {
    const newStatus = record.status === 'active' ? 'inactive' : 'active'
    await toggleSensitiveWordStatus(record.id, newStatus)
    message.success(t('sensitiveWord.msg.statusChanged'))
    void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
  }

  const handleBatchStatus = async (status: string) => {
    if (selectedIds.length === 0) return
    const payload: BatchStatusPayload = { ids: selectedIds, status }
    await batchToggleSensitiveWordStatus(payload)
    message.success(t('sensitiveWord.msg.statusChanged'))
    setSelectedIds([])
    void loadList(1, pagination.pageSize, filters, sortField, sortOrder)
  }

  const handleExport = async () => {
    if (selectedIds.length === 0) return
    try {
      const blob = await exportSensitiveWordsExcel(selectedIds)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'sensitive_words.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      message.success(t('sensitiveWord.msg.exportSuccess'))
    } catch (err) {
      if (isHandledError(err)) return
      message.error('Export failed')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const result = await importSensitiveWordsExcel(file)
      message.success(
        t('sensitiveWord.msg.importSuccess') +
          ` (total: ${result.total}, created: ${result.created}, updated: ${result.updated})`,
      )
      void loadList(1, pagination.pageSize, filters, sortField, sortOrder)
    } catch (err) {
      // error handled by axios interceptor
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const columns: ColumnsType<SensitiveWordListItem> = [
    {
      title: t('sensitiveWord.col.keyword'),
      dataIndex: 'keyword',
      key: 'keyword',
      sorter: true,
      sortOrder: sortField === 'keyword' ? sortOrder : null,
    },
    {
      title: t('sensitiveWord.col.type'),
      dataIndex: 'type_code',
      key: 'type_code',
      render: (value: string) => {
        const label = typeOptions.find((o) => o.value === value)?.label ?? value
        return <Tag color="blue">{label}</Tag>
      },
    },
    {
      title: t('sensitiveWord.col.status'),
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (value: string, record) => (
        <Switch
          checked={value === 'active'}
          onChange={() => void handleToggleStatus(record)}
          disabled={!canOperate}
          checkedChildren={t('sensitiveWord.status.active')}
          unCheckedChildren={t('sensitiveWord.status.inactive')}
        />
      ),
    },
    {
      title: t('sensitiveWord.col.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      sorter: true,
      sortOrder: sortField === 'created_at' ? sortOrder : null,
      render: (value: string) => (value ? new Date(value).toLocaleString() : '-'),
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space size={0}>
          {canOperate && (
            <Tooltip title={t('common.edit')}>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              />
            </Tooltip>
          )}
          {canOperate && (
            <Popconfirm
              title={`${t('common.confirm')} ${t('common.delete')} "${record.keyword}"?`}
              onConfirm={() => void handleDelete(record)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
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
              title={`${t('common.confirm')} ${t('sensitiveWord.toolbar.batchDelete')} ${selectedIds.length}?`}
              onConfirm={() => void handleBatchDelete()}
              disabled={selectedIds.length === 0}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button danger disabled={selectedIds.length === 0}>
                {t('sensitiveWord.toolbar.batchDelete')} {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              </Button>
            </Popconfirm>
          )}
          {canOperate && (
            <Button disabled={selectedIds.length === 0} onClick={() => void handleBatchStatus('active')}>
              {t('sensitiveWord.toolbar.batchEnable')}
            </Button>
          )}
          {canOperate && (
            <Button disabled={selectedIds.length === 0} onClick={() => void handleBatchStatus('inactive')}>
              {t('sensitiveWord.toolbar.batchDisable')}
            </Button>
          )}
          <Button disabled={selectedIds.length === 0} onClick={() => void handleExport()}>
            {t('sensitiveWord.toolbar.export')}
          </Button>
          {canOperate && (
            <Button loading={importing} onClick={() => { setImportFile(null); setImportModalOpen(true) }}>
              {t('sensitiveWord.toolbar.import')}
            </Button>
          )}
          {canOperate && (
            <Button type="primary" onClick={openCreate}>
              {t('sensitiveWord.toolbar.new')}
            </Button>
          )}
        </div>

        <Table<SensitiveWordListItem>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={list}
          scroll={{ x: 800 }}
          onChange={handleTableChange}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as number[]),
          }}
          pagination={tablePaginationProps}
          size="small"
        />

      <Modal
        title={editingRecord ? t('sensitiveWord.modal.titleEdit') : t('sensitiveWord.modal.titleCreate')}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={itemForm} layout="vertical">
          <Form.Item
            name="keyword"
            label={t('sensitiveWord.form.keyword')}
            rules={[{ required: true, message: t('sensitiveWord.form.keywordRequired') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
          >
            <TrimInput placeholder={t('sensitiveWord.form.keywordRequired')} />
          </Form.Item>
          <Form.Item
            name="type_code"
            label={t('sensitiveWord.form.type')}
            rules={[{ required: true, message: t('sensitiveWord.form.typeRequired') }]}
          >
            <Select showSearch optionFilterProp="label" placeholder={t('sensitiveWord.form.typeRequired')} options={typeOptions} />
          </Form.Item>
          <Form.Item name="status" label={t('sensitiveWord.form.status')} valuePropName="checked">
            <Switch
              checkedChildren={t('sensitiveWord.status.active')}
              unCheckedChildren={t('sensitiveWord.status.inactive')}
            />
          </Form.Item>
        </Form>
      </Modal>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={(e) => void handleImport(e)}
      />

      <Modal
        title={t('sensitiveWord.toolbar.import')}
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        footer={null}
        destroyOnHidden
        width={480}
      >
        <div style={{ marginBottom: 16 }}>
          <a
            href="/sensitive_words.xlsx"
            download="sensitive_words.xlsx"
            style={{ color: '#1890ff', textDecoration: 'underline' }}
          >
            {t('sensitiveWord.toolbar.importTemplate')}
          </a>
        </div>
        <Upload.Dragger
          accept=".xlsx,.xls"
          showUploadList={false}
          beforeUpload={() => false}
          onChange={({ file }) => {
            setImportFile(file.originFileObj as File)
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{t('sensitiveWord.import.dragHint')}</p>
          <p className="ant-upload-hint">{t('sensitiveWord.import.dragHintSub')}</p>
        </Upload.Dragger>
        {importFile && (
          <div style={{ marginTop: 12, color: '#52c41a' }}>
            {importFile.name}
          </div>
        )}
        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <Button
            style={{ marginRight: 8 }}
            onClick={() => setImportModalOpen(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="primary"
            loading={importing}
            disabled={!importFile}
            onClick={async () => {
              if (!importFile) return
              setImporting(true)
              try {
                const result = await importSensitiveWordsExcel(importFile)
                message.success(
                  t('sensitiveWord.msg.importSuccess') +
                    ` (total: ${result.total}, created: ${result.created}, updated: ${result.updated})`,
                )
                setImportModalOpen(false)
                setImportFile(null)
                void loadList(1, pagination.pageSize, filters, sortField, sortOrder)
              } catch {
                message.error('Import failed')
              } finally {
                setImporting(false)
              }
            }}
          >
            {t('common.confirm')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
