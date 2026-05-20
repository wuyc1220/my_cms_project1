/**
 * ProviderManagement — 供应商管理列表页
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Col,
  Form,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tooltip,
  message,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  FileAddOutlined,
  InfoCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  getProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  batchDeleteProviders,
} from '../../api/providers'
import { getDictTree } from '../../api/dicts'
import { getUsers } from '../../api/users'
import { getConfigs } from '../../api/configs'
import SearchForm from '../../components/SearchForm'
import TrimInput from '../../components/TrimInput'
import { CreateContractModal } from '../../components/ContractModals'
import type { SearchFieldConfig } from '../../types/searchForm'
import type { ProviderListItem, ProviderCreatePayload, ProviderUpdatePayload } from '../../types/trade'
import type { DictNodeListItem } from '../../types/dict'
import { useI18n } from '../../i18n/useI18n'
import { usePermission } from '../../hooks/usePermission'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import { isHandledError } from '../../api'
import { useFormRules } from '../../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../../constants/form'


interface SearchValues {
  provider_code?: string
  name?: string
  country?: string
  notes?: string
}

interface ProviderFormValues {
  provider_code?: string
  name: string
  country?: string
  review_level: string
  l1_assignee_id?: number
  l2_assignee_id?: number
  l3_assignee_id?: number
  notes?: string
}

export default function ProviderManagement() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const formRules = useFormRules()
  const [itemForm] = Form.useForm<ProviderFormValues>()

  const { hasPermission } = usePermission()
  const canViewProvider = hasPermission('menu.trade.providers.view') || hasPermission('menu.trade.providers.operate')
  const canOperateProvider = hasPermission('menu.trade.providers.operate')
  const canOperateContract = hasPermission('menu.trade.contracts.operate')

  const [providers, setProviders] = useState<ProviderListItem[]>([])
  const [loading, setLoading] = useState(false)
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filters, sortField, sortOrder)
    },
  })

  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<ProviderListItem | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  const [reviewLevelOptions, setReviewLevelOptions] = useState<{ label: string; value: string }[]>([])
  const [userOptions, setUserOptions] = useState<{ label: string; value: number }[]>([])

  const currentReviewLevel = Form.useWatch('review_level', itemForm)

  const selectedLevelIndex = reviewLevelOptions.findIndex((o) => o.value === currentReviewLevel)
  const showL1 = selectedLevelIndex >= 1
  const showL2 = selectedLevelIndex >= 2
  const showL3 = selectedLevelIndex >= 3

  // ─── 合同弹窗状态 ───────────────────────────────────────────────────────────────

  const [contractModalOpen, setContractModalOpen] = useState(false)
  const [contractProvider, setContractProvider] = useState<{ id: number; name: string } | null>(null)
  const [platformOptions, setPlatformOptions] = useState<{ label: string; value: string }[]>([])

  // ─── 搜索字段配置 ─────────────────────────────────────────────────────────────

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'provider_code',
      labelKey: 'provider.col.code',
      type: 'input',
    },
    {
      name: 'name',
      labelKey: 'provider.form.name',
      type: 'input',
    },
    {
      name: 'country',
      labelKey: 'provider.form.country',
      type: 'input',
    },
    {
      name: 'notes',
      labelKey: 'common.notes',
      type: 'input',
    },
  ], [])

  // ─── 使用 useSearchForm Hook ─────────────────────────────────────────────────

  const {
    form: searchForm,
    filters,
    setFilters,
    showExpand,
    handleSearch,
    handleReset,
  } = useSearchForm<SearchValues>({
    fieldsCount: searchFields.length,
    onSearch: (values) => {
      setFilters(values)
      setSelectedRowKeys([])
      void loadList(1, pagination.pageSize, values, sortField, sortOrder)
    },
    onReset: () => {
      setFilters({})
      setSelectedRowKeys([])
      resetSort()
      void loadList(1, pagination.pageSize, {}, null, null)
    },
  })

  useEffect(() => {
    void (async () => {
      try {
        const [dicts, users] = await Promise.all([
          getDictTree(),
          getUsers({ page: 1, page_size: 500 }),
        ])

        const reviewRoot = dicts.find((d: DictNodeListItem) => d.code === 'Content_review_level')
        setReviewLevelOptions(
          (reviewRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })),
        )

        const platformRoot = dicts.find((d: DictNodeListItem) => d.code === 'Platform')
        setPlatformOptions(
          (platformRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })),
        )

        setUserOptions(
          users.items.map((u) => ({
            label: u.display_name ?? u.username,
            value: u.id,
          })),
        )
      } catch (err) {
        if (isHandledError(err)) return
        void message.error(t('provider.msg.initFailed'), 5)
      }
    })()
    void loadList(1, pagination.pageSize, {}, null, null)
  }, [])

  const loadList = async (
    targetPage: number,
    targetPageSize: number,
    nextFilters: SearchValues,
    nextSortField?: string | null,
    nextSortOrder?: 'ascend' | 'descend' | null,
  ) => {
    setLoading(true)
    try {
      const data = await getProviders({
        page: targetPage,
        page_size: targetPageSize,
        provider_code: nextFilters.provider_code,
        name: nextFilters.name,
        country: nextFilters.country,
        notes: nextFilters.notes,
        sort_by: nextSortField ?? undefined,
        sort_order: nextSortOrder === 'ascend' ? 'asc' : nextSortOrder === 'descend' ? 'desc' : undefined,
      })
      setProviders(data.items)
      updatePagination(data)
    } catch (err) {
      // 错误已由拦截器处理
    } finally {
      setLoading(false)
    }
  }


  const openCreate = async () => {
    setEditRecord(null)
    itemForm.resetFields()
    try {
      const cfg = await getConfigs({ config_key: 'DEFAULT_REVIEW_LEVEL', page: 1, page_size: 1 })
      const defaultLevelCode = cfg.items[0]?.config_value
      if (defaultLevelCode) {
        itemForm.setFieldsValue({ review_level: defaultLevelCode })
      }
    } catch (err) {
      // 读取失败不影响弹框打开
    }
    setModalOpen(true)
  }

  const openEdit = (record: ProviderListItem) => {
    setEditRecord(record)
    itemForm.setFieldsValue({
      name: record.name,
      country: record.country ?? undefined,
      review_level: record.review_level ?? undefined,
      l1_assignee_id: record.l1_assignee_id ?? undefined,
      l2_assignee_id: record.l2_assignee_id ?? undefined,
      l3_assignee_id: record.l3_assignee_id ?? undefined,
      notes: record.notes ?? undefined,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditRecord(null)
    itemForm.resetFields()
  }

  const handleSubmit = async () => {
    const values = await itemForm.validateFields()
    setModalLoading(true)
    try {
      if (editRecord) {
        const payload: ProviderUpdatePayload = {
          provider_code: values.provider_code?.trim() || undefined,
          name: values.name,
          country: values.country,
          review_level: values.review_level,
          l1_assignee_id: values.l1_assignee_id ?? null,
          l2_assignee_id: values.l2_assignee_id ?? null,
          l3_assignee_id: values.l3_assignee_id ?? null,
          notes: values.notes,
        }
        await updateProvider(editRecord.id, payload)
        void message.success(t('provider.msg.updated'), 3)
      } else {
        const payload: ProviderCreatePayload = {
          provider_code: values.provider_code?.trim() || undefined,
          name: values.name,
          country: values.country,
          review_level: values.review_level,
          l1_assignee_id: values.l1_assignee_id,
          l2_assignee_id: values.l2_assignee_id,
          l3_assignee_id: values.l3_assignee_id,
          notes: values.notes,
        }
        await createProvider(payload)
        void message.success(t('provider.msg.created'), 3)
      }
      closeModal()
      void loadList(editRecord ? pagination.current : 1, pagination.pageSize, filters, sortField, sortOrder)
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      // 处理供应商数量限制错误
      if (detail && detail.startsWith('SUPPLIER_LIMIT_EXCEEDED:')) {
        const limit = detail.split(':')[1]
        void message.error(t('provider.error.supplierLimitExceeded', { limit }), 5)
      } else if (!detail) {
        // 没有 detail 时显示通用提示
        void message.error(editRecord ? t('common.msg.updateFailed') : t('common.msg.createFailed'), 5)
      }
      // 其他有 detail 的错误由拦截器处理
    } finally {
      setModalLoading(false)
    }
  }

  const handleDelete = async (record: ProviderListItem) => {
    try {
      await deleteProvider(record.id)
      void message.success(t('common.msg.deleted'), 3)
      setSelectedRowKeys(prev => prev.filter(id => id !== record.id))
      void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
    } catch (err) {
      // 错误已由拦截器处理
    }
  }

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return
    try {
      await batchDeleteProviders({ ids: selectedRowKeys })
      void message.success(t('common.msg.deleteSuccess'), 3)
      setSelectedRowKeys([])
      void loadList(1, pagination.pageSize, filters, sortField, sortOrder)
    } catch (err) {
      // 错误已由拦截器处理
    }
  }

  // ─── 合同弹窗操作 ─────────────────────────────────────────────────────────────

  const handleAddContract = (record: ProviderListItem) => {
    setContractProvider({ id: record.id, name: record.name })
    setContractModalOpen(true)
  }

  const closeContractModal = () => {
    setContractModalOpen(false)
    setContractProvider(null)
  }

  const handleContractSuccess = () => {
    closeContractModal()
    void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
  }

  // ─── 表格列定义 ───────────────────────────────────────────────────────────────

  const columns: ColumnsType<ProviderListItem> = [
    {
      title: t('provider.col.code'),
      dataIndex: 'provider_code',
      key: 'provider_code',
      width: 220,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'provider_code' ? sortOrder : null,
      render: (val: string | undefined) => <Tooltip title={val ?? ''}><span>{val ?? '—'}</span></Tooltip>,
    },
    {
      title: t('provider.col.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'name' ? sortOrder : null,
      render: (val: string) => <Tooltip autoAdjustOverflow={false} placement={'topLeft'} title={val}><span>{val}</span></Tooltip>,
    },
    {
      title: t('provider.col.country'),
      dataIndex: 'country',
      key: 'country',
      width: 220,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'country' ? sortOrder : null,
      render: (val: string | undefined) => (
        <Tooltip title={val ?? ''}><span>{val ?? '—'}</span></Tooltip>
      ),
    },
    {
      title: t('provider.col.notes'),
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'notes' ? sortOrder : null,
      render: (val: string | undefined) => (
        <Tooltip title={val ?? ''}><span>{val ?? '—'}</span></Tooltip>
      ),
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space size={0}>
          {canViewProvider && (
            <Tooltip title={t('common.detail')}>
              <Button
                type="link"
                size="small"
                icon={<InfoCircleOutlined />}
                onClick={() => navigate(`/trade/providers/${record.id}`)}
              />
            </Tooltip>
          )}
          {canOperateContract && (
            <Tooltip title={t('provider.tooltip.addContract')}>
              <Button
                type="link"
                size="small"
                icon={<FileAddOutlined />}
                onClick={() => handleAddContract(record)}
              />
            </Tooltip>
          )}
          {canOperateProvider && (
            <Tooltip title={t('common.edit')}>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              />
            </Tooltip>
          )}
          {canOperateProvider && (
            <Popconfirm
              title={t('common.confirmDelete', { name: record.name })}
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
        {/* 搜索区域 */}
        <SearchForm
          fields={searchFields}
          form={searchForm}
          showExpand={showExpand}
          onSearch={handleSearch}
          onReset={handleReset}
          loading={loading}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
          {canOperateProvider && (
            <Popconfirm
              title={t('common.confirmDeleteSelected', { count: selectedRowKeys.length })}
              onConfirm={() => void handleBatchDelete()}
              disabled={selectedRowKeys.length === 0}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button danger disabled={selectedRowKeys.length === 0}>
                {t('common.batchDelete')}{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ''}
              </Button>
            </Popconfirm>
          )}
          {canOperateProvider && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => void openCreate()}>
              {t('provider.toolbar.newProvider')}
            </Button>
          )}
        </div>

        <Table<ProviderListItem>
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={providers}
          scroll={{ x: 700 }}
          onChange={handleTableChange}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as number[]),
          }}
          pagination={tablePaginationProps}
        />
      <Modal
        title={editRecord ? t('provider.modal.titleEdit') : t('provider.modal.titleCreate')}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        confirmLoading={modalLoading}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
        width={640}
      >
        <Form form={itemForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="provider_code"
                label={t('provider.form.code')}
                rules={[formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
              >
                <TrimInput placeholder={t('provider.placeholder.code')} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="name"
                label={t('provider.form.name')}
                rules={[
                  { required: true, message: t('provider.rule.nameRequired') },
                  formRules.maxLength(FORM_MAX_LENGTH.INPUT),
                  {
                    validator: (_, value) => {
                      if (value && value.trim() === '') {
                        return Promise.reject(new Error(t('provider.rule.nameWhitespace')))
                      }
                      return Promise.resolve()
                    },
                  },
                ]}
              >
                <TrimInput placeholder={t('provider.placeholder.name')} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item name="country" label={t('provider.form.country')} rules={[formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                <TrimInput placeholder={t('provider.placeholder.country')} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="review_level"
                label={t('provider.form.reviewLevel')}
                rules={[{ required: true, message: t('provider.rule.reviewRequired') }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  allowClear
                  placeholder={t('provider.placeholder.reviewLevel')}
                  options={reviewLevelOptions}
                  style={{ width: '100%' }}
                  onChange={() => {
                    itemForm.setFieldsValue({
                      l1_assignee_id: undefined,
                      l2_assignee_id: undefined,
                      l3_assignee_id: undefined,
                    })
                  }}
                />
              </Form.Item>
            </Col>

            {showL1 && (
              <Col span={12}>
                <Form.Item name="l1_assignee_id" label={t('provider.form.l1Assignee')}>
                  <Select
                    allowClear
                    showSearch
                    placeholder={t('provider.placeholder.l1')}
                    options={userOptions}
                    filterOption={(input, option) =>
                      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            )}

            {showL2 && (
              <Col span={12}>
                <Form.Item name="l2_assignee_id" label={t('provider.form.l2Assignee')}>
                  <Select
                    allowClear
                    showSearch
                    placeholder={t('provider.placeholder.l2')}
                    options={userOptions}
                    filterOption={(input, option) =>
                      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            )}

            {showL3 && (
              <Col span={12}>
                <Form.Item name="l3_assignee_id" label={t('provider.form.l3Assignee')}>
                  <Select
                    allowClear
                    showSearch
                    placeholder={t('provider.placeholder.l3')}
                    options={userOptions}
                    filterOption={(input, option) =>
                      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            )}

            <Col span={24}>
              <Form.Item name="notes" label={t('provider.col.notes')} rules={[formRules.maxLength(FORM_MAX_LENGTH.TEXT_AREA)]}>
                <TrimInput.TextArea rows={3} placeholder={t('provider.placeholder.notesForm')} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 添加合同弹窗 */}
      <CreateContractModal
        open={contractModalOpen}
        platformOptions={platformOptions}
        prefilledProvider={contractProvider}
        onClose={closeContractModal}
        onSuccess={handleContractSuccess}
      />
    </div>
  )
}
