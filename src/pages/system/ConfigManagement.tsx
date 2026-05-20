import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Descriptions,
  Drawer,
  Form,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { DeleteOutlined, EditOutlined, InfoCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { createConfig, deleteConfig, getConfig, getConfigs, updateConfig } from '../../api/configs'
import type { ConfigCreatePayload, ConfigListItem, ConfigUpdatePayload } from '../../types/config'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import SearchForm from '../../components/SearchForm'
import TrimInput from '../../components/TrimInput'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'
import { useFormRules } from '../../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../../constants/form'

interface SearchValues {
  config_key?: string
  config_name?: string
  description?: string
}

interface ConfigFormValues {
  config_key?: string
  config_name: string
  config_value?: string
  description?: string
}

export default function ConfigManagement() {
  const { t } = useI18n()
  const [configForm] = Form.useForm<ConfigFormValues>()
  const [list, setList] = useState<ConfigListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerRecord, setDrawerRecord] = useState<ConfigListItem | null>(null)
  const [editingRecord, setEditingRecord] = useState<ConfigListItem | null>(null)
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.system.configs.operate')
  const formRules = useFormRules()
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadConfigs(page, pageSize, filters, sortField, sortOrder)
    },
  })

  // 表格容器引用，用于检测是否需要固定列
  const tableWrapperRef = useRef<HTMLDivElement>(null)
  // 是否需要固定首列和操作列
  const [needFixedColumns, setNeedFixedColumns] = useState(false)

  // 搜索字段配置
  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'config_key',
      labelKey: 'system.config.labelKey',
      type: 'input',
      placeholderKey: 'system.config.placeholderKey',
    },
    {
      name: 'config_name',
      labelKey: 'system.config.labelName',
      type: 'input',
      placeholderKey: 'system.config.placeholderSearch',
    },
    {
      name: 'description',
      labelKey: 'common.notes',
      type: 'input',
      placeholderKey: 'system.config.placeholderNotes',
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
      await loadConfigs(1, pagination.pageSize, values, null, null)
    },
    onReset: () => {
      resetSort()
      void loadConfigs(1, pagination.pageSize, {}, null, null)
    },
  })

  const loadConfigs = async (
    page = pagination.current,
    pageSize = pagination.pageSize,
    nextFilters = filters,
    nextSortField?: string | null,
    nextSortOrder?: 'ascend' | 'descend' | null,
  ) => {
    setLoading(true)
    try {
      const data = await getConfigs({
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

  // 表格列宽总和（用于判断是否需要固定列）
  const tableColumnsWidth = 200 + 220 + 150 + 200 + 200 // config_name + config_key + config_value + description + action

  // 使用 ResizeObserver 监听容器宽度，判断是否需要固定列
  useEffect(() => {
    const wrapper = tableWrapperRef.current
    if (!wrapper) return

    const checkOverflow = () => {
      const containerWidth = wrapper.clientWidth
      const hasOverflow = tableColumnsWidth > containerWidth
      setNeedFixedColumns(hasOverflow)
    }

    // 初次检测
    checkOverflow()

    // 监听容器尺寸变化
    const resizeObserver = new ResizeObserver(checkOverflow)
    resizeObserver.observe(wrapper)

    return () => {
      resizeObserver.disconnect()
    }
  }, [tableColumnsWidth])

  useEffect(() => {
    void loadConfigs(1, pagination.pageSize, {}, null, null)
  }, [])

  const openCreateModal = () => {
    setEditingRecord(null)
    configForm.resetFields()
    setModalOpen(true)
  }

  const openEditModal = (record: ConfigListItem) => {
    setEditingRecord(record)
    configForm.setFieldsValue({
      config_key: record.config_key,
      config_name: record.config_name,
      config_value: record.config_value ?? undefined,
      description: record.description ?? undefined,
    })
    setModalOpen(true)
  }

  const openDetailDrawer = async (record: ConfigListItem) => {
    const detail = await getConfig(record.id)
    setDrawerRecord(detail)
    setDrawerOpen(true)
  }

  const handleSubmit = async () => {
    const values = await configForm.validateFields()
    setSubmitting(true)
    try {
      if (editingRecord) {
        const payload: ConfigUpdatePayload = {
          config_name: values.config_name,
          config_value: values.config_value,
          description: values.description ?? null,
        }
        await updateConfig(editingRecord.id, payload)
        message.success(t('system.config.msgUpdated'))

        // 如果修改了 SYSTEM_UI_LANGUAGE，需要刷新页面使语言设置生效
        if (editingRecord.config_key === 'SYSTEM_UI_LANGUAGE') {
          setTimeout(() => window.location.reload(), 500)
          return
        }
      } else {
        const payload: ConfigCreatePayload = {
          config_key: values.config_key!,
          config_name: values.config_name,
          config_value: values.config_value,
          description: values.description ?? null,
        }
        await createConfig(payload)
        message.success(t('system.config.msgCreated'))
      }
      setModalOpen(false)
      await loadConfigs(editingRecord ? pagination.current : 1, pagination.pageSize, filters, sortField, sortOrder)
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnsType<ConfigListItem> = [
    {
      title: t('system.config.colKey'),
      dataIndex: 'config_key',
      key: 'config_key',
      sorter: true,
      sortOrder: sortField === 'config_key' ? sortOrder : null,
      fixed: needFixedColumns ? 'left' : undefined,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: t('system.config.colName'),
      dataIndex: 'config_name',
      key: 'config_name',
      sorter: true,
      sortOrder: sortField === 'config_name' ? sortOrder : null,
    },
    {
      title: t('system.config.colValue'),
      dataIndex: 'config_value',
      key: 'config_value',
      width: 300,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'config_value' ? sortOrder : null,
      render: (value: string | null) =>
        value != null ? (

            <Tooltip title={value}  autoAdjustOverflow={false} placement={'topLeft'}>
              <span
                  style={{
                    padding: '2px 6px',
                  }}
              >
                {value}
              </span>
            </Tooltip>
        ) : (
          <span style={{ color: '#bbb' }}>—</span>
        ),
    },
    {
      title: t('common.notes'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true, // 配合宽度使用
      width: 300,
      sorter: true,
      sortOrder: sortField === 'description' ? sortOrder : null,
      render: (value: string | null) =>
          value != null ? (

              <Tooltip title={value}  autoAdjustOverflow={false} placement={'topLeft'}>
              <span
                  style={{
                    padding: '2px 6px',
                  }}
              >
                {value}
              </span>
              </Tooltip>
          ) : (
              <span style={{ color: '#bbb' }}>—</span>
          ),
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: needFixedColumns ? 'right' : undefined,
      width: 160,
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title={t('common.detail')}>
            <Button
              type="link"
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() => void openDetailDrawer(record)}
            />
          </Tooltip>
          {canOperate && (
            <Tooltip title={t('common.edit')}>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEditModal(record)}
              />
            </Tooltip>
          )}
          {canOperate && (
            <Tooltip title={record.is_system ? t('system.config.tooltipBuiltin') : t('common.delete')}>
              <Popconfirm
                title={t('system.config.confirmDelete')}
                onConfirm={async () => {
                  await deleteConfig(record.id)
                  message.success(t('system.config.msgDeleted'))
                  await loadConfigs(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
                }}
                disabled={record.is_system}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
              >
                <Button type="link" size="small" icon={<DeleteOutlined />} danger disabled={record.is_system} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

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
            <Button type="primary" onClick={openCreateModal}>
              {t('system.config.btnNew')}
            </Button>
          )}
        </div>

        <div ref={tableWrapperRef}>
          <Table<ConfigListItem>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={list}
            scroll={{ x: tableColumnsWidth }}
            onChange={handleTableChange}
          pagination={tablePaginationProps}
          size="small"
        />
        </div>

      {/* Detail Drawer */}
      <Drawer
        title={t('system.config.drawerTitle')}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
        extra={
          canOperate ? (
            <Button
              type="primary"
              onClick={() => {
                setDrawerOpen(false)
                if (drawerRecord) openEditModal(drawerRecord)
              }}
            >
              {t('system.config.btnEditThis')}
            </Button>
          ) : null
        }
      >
        {drawerRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={t('system.config.labelKey')}>
              <Tag color="blue">{drawerRecord.config_key}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('system.config.labelName')}>{drawerRecord.config_name}</Descriptions.Item>
            <Descriptions.Item label={t('system.config.labelValue')}>
              {drawerRecord.config_value != null ? (
                <span
                  style={{
                    fontFamily: 'monospace',
                    background: '#f5f5f5',
                    padding: '2px 6px',
                    borderRadius: 4,
                    display: 'inline-block',
                    wordBreak: 'break-all',
                  }}
                >
                  {drawerRecord.config_value}
                </span>
              ) : (
                <span style={{ color: '#bbb' }}>{t('system.config.emptyValue')}</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('common.notes')}>{drawerRecord.description ?? '—'}</Descriptions.Item>
            <Descriptions.Item label={t('system.config.labelIsBuiltin')}>
              {drawerRecord.is_system ? <Tag color="orange">{t('common.yes')}</Tag> : <Tag>{t('common.no')}</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label={t('system.config.labelCreatedAt')}>
              {drawerRecord.created_at ? new Date(drawerRecord.created_at).toLocaleString() : '—'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* Create / Edit Modal */}
      <Modal
        title={editingRecord ? t('system.config.modalTitleEdit') : t('system.config.modalTitleCreate')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSubmit()}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={configForm} layout="vertical">
          <Form.Item
            name="config_key"
            label={t('system.config.labelKey')}
            rules={editingRecord ? [formRules.maxLength(FORM_MAX_LENGTH.INPUT)] : [{ required: true, message: t('system.config.ruleKey') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
          >
            <TrimInput placeholder={t('system.config.placeholderKey')} disabled={!!editingRecord} />
          </Form.Item>
          <Form.Item
            name="config_name"
            label={t('system.config.labelName')}
            rules={[{ required: true, message: t('system.config.ruleName') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
          >
            <TrimInput placeholder={t('system.config.placeholderName')} />
          </Form.Item>
          <Form.Item name="config_value" label={t('system.config.labelValue')} rules={[{ required: true, message: t('system.config.placeholderValue') }, formRules.maxLength(FORM_MAX_LENGTH.TEXT_AREA)]}>
            <TrimInput.TextArea rows={3} placeholder={t('system.config.placeholderValue')} />
          </Form.Item>
          <Form.Item name="description" label={t('common.notes')} rules={[formRules.maxLength(FORM_MAX_LENGTH.TEXT_AREA)]}>
            <TrimInput.TextArea rows={3} placeholder={t('system.config.placeholderNotes')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
