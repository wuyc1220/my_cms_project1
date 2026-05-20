import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { DeleteOutlined, EditOutlined, NodeExpandOutlined, PlusOutlined, CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { createDictNode, getDictTree, toggleDictStatus, updateDictNode } from '../../api/dicts'
import type { DictNodeCreatePayload, DictNodeListItem, DictNodeUpdatePayload } from '../../types/dict'
import { useI18n } from '../../i18n/useI18n'
import SearchForm from '../../components/SearchForm'
import TrimInput from '../../components/TrimInput'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useSearchForm } from '../../hooks/useSearchForm'
import { useTablePagination } from '../../hooks/useTablePagination'
import { usePermission } from '../../hooks/usePermission'
import { useFormRules } from '../../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../../constants/form'

interface SearchValues {
  name?: string
  code?: string
  remark?: string
}

interface DictFormValues {
  code?: string
  name: string
  sort_order?: number
  remark?: string
}

type ModalMode = 'createRoot' | 'createSibling' | 'createChild' | 'edit'

interface ModalState {
  open: boolean
  mode: ModalMode
  record: DictNodeListItem | null
  parentId: number | null
  parentName: string | null
}

const CLOSED_MODAL: ModalState = { open: false, mode: 'createRoot', record: null, parentId: null, parentName: null }

export default function DictManagement() {
  const { t } = useI18n()
  const [dictForm] = Form.useForm<DictFormValues>()
  const [tree, setTree] = useState<DictNodeListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modal, setModal] = useState<ModalState>(CLOSED_MODAL)
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.system.dicts.operate')
  const formRules = useFormRules()

  const { sortField, sortOrder, resetSort, handleTableChange } = useTablePagination({
    onChange: ({ sortField, sortOrder }) => {
      void loadTree(filters, sortField, sortOrder)
    },
  })

  // 搜索字段配置
  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'name',
      labelKey: 'system.dict.labelName',
      type: 'input',
      placeholderKey: 'system.dict.placeholderName',
    },
    {
      name: 'code',
      labelKey: 'system.dict.labelCode',
      type: 'input',
      placeholderKey: 'system.dict.placeholderCode',
    },
    {
      name: 'remark',
      labelKey: 'common.notes',
      type: 'input',
      placeholderKey: 'system.dict.placeholderNotes',
    },
  ], [t])

  // 使用 useSearchForm Hook
  const {
    form: searchForm,
    filters,
    expanded,
    setExpanded,
    showExpand,
    handleSearch,
    handleReset,
  } = useSearchForm<SearchValues>({
    fieldsCount: searchFields.length,
    onSearch: async (values) => {
      resetSort()
      await loadTree(values, null, null)
    },
    onReset: () => {
      resetSort()
      void loadTree({}, null, null)
    },
  })

  const loadTree = async (nextFilters = filters, nextSortField?: string | null, nextSortOrder?: 'ascend' | 'descend' | null) => {
    setLoading(true)
    try {
      const data = await getDictTree({
        ...nextFilters,
        sort_by: nextSortField ?? undefined,
        sort_order: nextSortOrder === 'ascend' ? 'asc' : nextSortOrder === 'descend' ? 'desc' : undefined,
      })
      setTree(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTree({}, null, null)
  }, [])

  const openModal = (mode: ModalMode, record: DictNodeListItem | null = null) => {
    dictForm.resetFields()
    let parentId: number | null = null
    let parentName: string | null = null

    if (mode === 'createRoot') {
      parentId = null
      parentName = null
    } else if (mode === 'createSibling' && record) {
      parentId = record.parent_id
      parentName = null
    } else if (mode === 'createChild' && record) {
      parentId = record.id
      parentName = record.name
    } else if (mode === 'edit' && record) {
      parentId = record.parent_id
      parentName = null
      dictForm.setFieldsValue({
        code: record.code,
        name: record.name,
        sort_order: record.sort_order,
        remark: record.remark ?? undefined,
      })
    }

    setModal({ open: true, mode, record, parentId, parentName })
  }

  const closeModal = () => {
    dictForm.resetFields()
    setModal({ open: false, mode: 'createRoot', record: null, parentId: null, parentName: null })
  }

  const handleSubmit = async () => {
    const values = await dictForm.validateFields()
    const currentModal = modal
    setSubmitting(true)
    try {
      if (currentModal.mode === 'edit' && currentModal.record) {
        const payload: DictNodeUpdatePayload = {
          name: values.name,
          sort_order: values.sort_order ?? 0,
          remark: values.remark ?? null,
        }
        await updateDictNode(currentModal.record.id, payload)
        closeModal()
        message.success(t('system.dict.msgUpdated'))
      } else {
        const payload: DictNodeCreatePayload = {
          parent_id: currentModal.parentId,
          code: values.code || null,
          name: values.name,
          sort_order: values.sort_order ?? 0,
          remark: values.remark ?? null,
        }
        await createDictNode(payload)
        closeModal()
        message.success(t('system.dict.msgCreated'))
      }

      if (currentModal.mode === 'createChild' && currentModal.record != null) {
        const parentId = currentModal.record.id
        setExpandedKeys((prev) => (prev.includes(parentId) ? prev : [...prev, parentId]))
      }

      void loadTree(filters, sortField, sortOrder)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record: DictNodeListItem) => {
    await toggleDictStatus(record.id, 'deleted')
    message.success(t('common.msg.deleted'))
    await loadTree(filters, sortField, sortOrder)
  }

  const renderName = (record: DictNodeListItem) => {
    const isRoot = record.parent_id === null
    return (
      <span style={{ fontWeight: isRoot ? 600 : undefined }}>
        {record.name}
      </span>
    )
  }

  const renderCode = (record: DictNodeListItem) => (
    <Tag color="blue">{record.code}</Tag>
  )

  const renderActions = (record: DictNodeListItem) => (
    <Space size={0} wrap={false}>
      {canOperate && (
        <Tooltip title={t('system.dict.btnAddPeer')}>
          <Button
            type="link"
            size="small"
            icon={<NodeExpandOutlined />}
            onClick={() => openModal('createSibling', record)}
          />
        </Tooltip>
      )}
      {canOperate && (
        <Tooltip title={t('system.dict.btnAddChild')}>
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => openModal('createChild', record)}
          />
        </Tooltip>
      )}
      {canOperate && (
        <Tooltip title={t('common.edit')}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openModal('edit', record)}
          />
        </Tooltip>
      )}
      {canOperate && (
        <Tooltip title={record.is_system ? t('system.dict.tooltipBuiltin') : t('common.delete')}>
          <Popconfirm
            title={t('system.dict.confirmDelete', { name: record.name })}
            onConfirm={() => void handleDelete(record)}
            disabled={record.is_system}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button type="link" size="small" icon={<DeleteOutlined />} danger disabled={record.is_system} />
          </Popconfirm>
        </Tooltip>
      )}
    </Space>
  )

  const columns: ColumnsType<DictNodeListItem> = [
    {
      title: t('system.dict.colName'),
      key: 'name',
      dataIndex: 'name',
      sorter: true,
      sortOrder: sortField === 'name' ? sortOrder : null,
      render: (_, record) => renderName(record),
    },
    {
      title: t('system.dict.colCode'),
      key: 'code',
      dataIndex: 'code',
      width: 300,
      sorter: true,
      sortOrder: sortField === 'code' ? sortOrder : null,
      render: (_, record) => renderCode(record),
    },
    {
      title: t('system.dict.colSort'),
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 160,
      sorter: true,
      sortOrder: sortField === 'sort_order' ? sortOrder : null,
    },
    {
      title: t('common.notes'),
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      width: 300,
      sorter: true,
      sortOrder: sortField === 'remark' ? sortOrder : null,
      render: (value: string | null) => (
        <span style={{ color: '#8c8c8c' }}>{value || '—'}</span>
      ),
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 240,
      render: (_, record) => renderActions(record),
    },
  ]

  const modalTitle = () => {
    if (modal.mode === 'createRoot') return t('system.dict.modalTitleNewRoot')
    if (modal.mode === 'createSibling') return t('system.dict.modalTitleAddPeer')
    if (modal.mode === 'createChild') return t('system.dict.modalTitleAddChild')
    return t('system.dict.modalTitleEdit')
  }

  const isEdit = modal.mode === 'edit'

  return (
    <div className="main-container">
      {/* 搜索区 */}
      <div style={{ marginBottom: 16 }}>
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
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          {canOperate && (
            <Button type="primary" onClick={() => openModal('createRoot')}>
              {t('system.dict.btnNewRoot')}
            </Button>
          )}
        </div>

        <Table<DictNodeListItem>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={tree}
          scroll={{ x: 900 }}
          onChange={handleTableChange}
          expandable={{
            expandedRowKeys: expandedKeys as number[],
            onExpand: (expanded, record) => {
              setExpandedKeys((prev) =>
                expanded ? [...prev, record.id] : prev.filter((k) => k !== record.id),
              )
            },
            expandIcon: ({ expanded, onExpand, record }) => {
              const hasChildren = 'children' in record && Array.isArray(record.children) && record.children.length > 0
              if (!hasChildren) return <span style={{ display: 'inline-block', width: 17 }} />
              return expanded
                ? <CaretDownOutlined style={{ marginRight: 10 }} onClick={(e) => { e.stopPropagation(); onExpand(record, e) }} />
                : <CaretRightOutlined style={{ marginRight: 10 }} onClick={(e) => { e.stopPropagation(); onExpand(record, e) }} />
            },
          }}
          pagination={false}
          size="small"
        />

      <Modal
        title={modalTitle()}
        open={modal.open}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={dictForm} layout="vertical">
          {(modal.mode === 'createChild' || modal.mode === 'createSibling') && (
            <Form.Item label={t('system.dict.labelParent')}>
              <TrimInput
                value={
                  modal.mode === 'createChild' && modal.parentName
                    ? modal.parentName
                    : modal.mode === 'createSibling' && modal.record
                    ? modal.record.parent_id == null
                      ? t('system.dict.labelParentRootPeer')
                      : `（与"${modal.record.name}"同级）`
                    : t('system.dict.labelParentRoot')
                }
                disabled
              />
            </Form.Item>
          )}
          {modal.mode === 'edit' && modal.record?.parent_id == null && (
            <Form.Item label={t('system.dict.labelParent')}>
              <TrimInput value={t('system.dict.labelParentRoot')} disabled />
            </Form.Item>
          )}
          <Form.Item name="code" label={t('system.dict.labelCode')} rules={[formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
            <TrimInput placeholder={t('system.dict.placeholderCode')} disabled={isEdit} />
          </Form.Item>
          <Form.Item
            name="name"
            label={t('system.dict.labelName')}
            rules={[{ required: true, message: t('system.dict.ruleName') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
          >
            <TrimInput placeholder={t('system.dict.placeholderName')} />
          </Form.Item>
          <Form.Item name="sort_order" label={t('system.dict.labelSort')}>
            <InputNumber min={0} max={99999} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remark" label={t('common.notes')} rules={[formRules.maxLength(FORM_MAX_LENGTH.TEXT_AREA)]}>
            <TrimInput.TextArea rows={3} placeholder={t('system.dict.placeholderNotes')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
