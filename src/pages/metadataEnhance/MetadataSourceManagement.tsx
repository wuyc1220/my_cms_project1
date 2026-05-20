/**
 * 数据源管理页面
 */
import { useState, useEffect, useMemo } from 'react'
import {
  Table, Button, Space, Switch, Modal, Form, Select,
  InputNumber, message, Popconfirm, Tooltip, Tag, Row, Col,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
} from '@ant-design/icons'
import { useI18n } from '../../i18n/useI18n'
import TrimInput from '../../components/TrimInput'
import { useFormRules } from '../../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../../constants/form'
import {
  getMetadataSources,
  createMetadataSource,
  updateMetadataSource,
  toggleMetadataSourceStatus,
  batchEnableSources,
  batchDisableSources,
  batchDeleteMetadataSources,
  deleteMetadataSource,
} from '../../api/metadataSources'
import type {
  MetadataSourceListItem,
  MetadataSourceCreatePayload,
} from '../../types/metadataEnhance'
import type { PaginatedResponse } from '../../types/basic'
import { isHandledError } from '../../api'
import SearchForm from '../../components/SearchForm'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import type { SearchFieldConfig } from '../../types/searchForm'


const CONTENT_TYPES = ['Movie', 'Series', 'Cast']
const AUTH_TYPES = ['API_Key', 'OAuth2.0', 'None']
const COLLECT_TYPES = ['API', '网页爬取']
const RENDER_TYPES = ['StaticHTML', 'HeadlessBrowser']

const COLLECT_TYPE_TAGS: Record<string, string> = {
  API: 'blue',
  '网页爬取': 'green',
}

interface SearchValues {
  name?: string
  content_types?: string[]
  collect_types?: string[]
  statuses?: string[]
}

export default function MetadataSourceManagement() {
  const { t } = useI18n()
  const formRules = useFormRules()
  const [data, setData] = useState<PaginatedResponse<MetadataSourceListItem>>({
    total: 0, page: 1, page_size: 10, items: [],
  })
  const [loading, setLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const collectType = Form.useWatch('collect_type', form)

  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filters, sortField, sortOrder)
    },
  })

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'name',
      labelKey: 'metadataSource.search.namePlaceholder',
      type: 'input',
    },
    {
      name: 'content_types',
      labelKey: 'metadataSource.search.contentTypePlaceholder',
      type: 'multiSelect',
      options: CONTENT_TYPES.map((item) => ({ label: item, value: item })),
    },
    {
      name: 'collect_types',
      labelKey: 'metadataSource.search.collectTypePlaceholder',
      type: 'multiSelect',
      options: COLLECT_TYPES.map((item) => ({ label: item, value: item })),
    },
    {
      name: 'statuses',
      labelKey: 'metadataSource.search.statusPlaceholder',
      type: 'multiSelect',
      options: [
        { label: 'YES', value: 'YES' },
        { label: 'NO', value: 'NO' },
      ],
    },
  ], [])

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

  const loadList = async (
    page: number,
    pageSize: number,
    searchValues: SearchValues,
    nextSortField?: string | null,
    nextSortOrder?: 'ascend' | 'descend' | null,
  ) => {
    setLoading(true)
    try {
      const result = await getMetadataSources({
        page,
        page_size: pageSize,
        name: searchValues.name || undefined,
        content_types: searchValues.content_types?.length ? searchValues.content_types : undefined,
        collect_types: searchValues.collect_types?.length ? searchValues.collect_types : undefined,
        statuses: searchValues.statuses?.length ? searchValues.statuses : undefined,
        sort_by: nextSortField ?? undefined,
        sort_order: nextSortOrder === 'ascend' ? 'asc' : nextSortOrder === 'descend' ? 'desc' : undefined,
      })
      setData(result)
      updatePagination(result)
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('metadataSource.msg.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadList(1, pagination.pageSize, {}, null, null) }, [])

  const handleStatusChange = async (id: number, checked: boolean) => {
    try {
      await toggleMetadataSourceStatus(id, checked ? 'YES' : 'NO')
      message.success(t('metadataSource.msg.statusUpdated'))
      void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
    } catch (err) {
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteMetadataSource(id)
      message.success(t('metadataSource.msg.deleted'))
      setSelectedRowKeys(prev => prev.filter(key => key !== id))
      void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
    } catch (err) {
    }
  }

  const handleBatchEnable = async () => {
    if (selectedRowKeys.length === 0) return
    try {
      await batchEnableSources({ ids: selectedRowKeys, status: 'YES' })
      message.success(t('metadataSource.msg.batchEnabled'))
      setSelectedRowKeys([])
      void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('metadataSource.msg.operationFailed'))
    }
  }

  const handleBatchDisable = async () => {
    if (selectedRowKeys.length === 0) return
    try {
      await batchDisableSources({ ids: selectedRowKeys, status: 'NO' })
      message.success(t('metadataSource.msg.batchDisabled'))
      setSelectedRowKeys([])
      void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
    } catch (err) {
    }
  }

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return
    Modal.confirm({
      title: t('metadataSource.confirm.batchDelete'),
      content: t('metadataSource.confirm.batchDeleteContent', { count: String(selectedRowKeys.length) }),
      onOk: async () => {
        try {
          await batchDeleteMetadataSources(selectedRowKeys)
          message.success(t('metadataSource.msg.batchDeleted'))
          setSelectedRowKeys([])
          void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
        } catch (err) {
          if (isHandledError(err)) return
          message.error(t('metadataSource.msg.deleteFailed'))
        }
      },
    })
  }

  const openCreateModal = () => {
    setEditingId(null)
    form.resetFields()
    form.setFieldsValue({
      collect_type: 'API',
      auth_type: 'API_Key',
      rate_limit: 1000,
      status: 'YES',
    })
    setModalOpen(true)
  }

  const openEditModal = (record: MetadataSourceListItem) => {
    setEditingId(record.id)
    form.resetFields()
    form.setFieldsValue({
      name: record.name,
      content_type: record.content_type,
      collect_type: record.collect_type,
      url: record.url,
      api_endpoint: record.api_endpoint,
      auth_type: record.auth_type,
      rate_limit: record.rate_limit,
      status: record.status,
      page_url_template: record.page_url_template,
      render_type: record.render_type,
      field_extract_rules: record.field_extract_rules,
    })
    setModalOpen(true)
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()
      const payload: MetadataSourceCreatePayload = {
        name: values.name,
        content_type: values.content_type,
        collect_type: values.collect_type || 'API',
        url: values.url,
        rate_limit: values.rate_limit || 1000,
        status: values.status || 'YES',
      }

      if (values.collect_type === 'API') {
        payload.api_endpoint = values.api_endpoint || null
        payload.auth_type = values.auth_type || null
        payload.api_key = values.api_key || null
      } else {
        payload.page_url_template = values.page_url_template || null
        payload.render_type = values.render_type || null
        payload.field_extract_rules = values.field_extract_rules || null
      }

      if (editingId) {
        await updateMetadataSource(editingId, payload)
        message.success(t('metadataSource.msg.updated'))
      } else {
        await createMetadataSource(payload)
        message.success(t('metadataSource.msg.created'))
      }
      setModalOpen(false)
      void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
    } catch (err: any) {
      if (isHandledError(err)) return
      const detail = err?.response?.data?.detail
      if (detail) message.error(detail)
    }
  }

  const columns = [
    {
      title: t('metadataSource.col.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      sortOrder: sortField === 'name' ? sortOrder : null,
    },
    {
      title: t('metadataSource.col.contentType'),
      dataIndex: 'content_type',
      key: 'content_type',
      sorter: true,
      sortOrder: sortField === 'content_type' ? sortOrder : null,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: t('metadataSource.col.collectType'),
      dataIndex: 'collect_type',
      key: 'collect_type',
      sorter: true,
      sortOrder: sortField === 'collect_type' ? sortOrder : null,
      render: (v: string) => <Tag color={COLLECT_TYPE_TAGS[v] || 'default'}>{v}</Tag>,
    },
    {
      title: t('metadataSource.col.url'),
      dataIndex: 'url',
      key: 'url',
      sorter: true,
      sortOrder: sortField === 'url' ? sortOrder : null,
      ellipsis: true,
    },
    {
      title: t('metadataSource.col.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      sorter: true,
      sortOrder: sortField === 'status' ? sortOrder : null,
      render: (status: string, record: MetadataSourceListItem) => (
        <Switch
          checked={status === 'YES'}
          onChange={(checked) => handleStatusChange(record.id, checked)}
          checkedChildren="YES"
          unCheckedChildren="NO"
        />
      ),
    },
    {
      title: t('metadataSource.col.action'),
      key: 'action',
      width: 140,
      render: (_: unknown, record: MetadataSourceListItem) => (
        <Space>
          <Tooltip title={t('metadataSource.action.edit')}>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
          </Tooltip>
          <Popconfirm
            title={t('metadataSource.confirm.delete')}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            onConfirm={() => handleDelete(record.id)}
          >
            <Tooltip title={t('metadataSource.action.delete')}>
              <Button type="link" size="small" danger><DeleteOutlined /></Button>
            </Tooltip>
          </Popconfirm>
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
        showExpand={showExpand}
        onSearch={handleSearch}
        onReset={handleReset}
        loading={loading}
      />

      {/* 工具栏 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
        <Button onClick={handleBatchEnable} disabled={selectedRowKeys.length === 0}>
          {t('metadataSource.toolbar.batchEnable')}
        </Button>
        <Button onClick={handleBatchDisable} disabled={selectedRowKeys.length === 0}>
          {t('metadataSource.toolbar.batchDisable')}
        </Button>
        <Popconfirm
          title={t('metadataSource.confirm.batchDelete')}
          onConfirm={() => void handleBatchDelete()}
          disabled={selectedRowKeys.length === 0}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
        >
          <Button danger disabled={selectedRowKeys.length === 0}>
            {t('metadataSource.toolbar.batchDelete')}{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ''}
          </Button>
        </Popconfirm>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          {t('metadataSource.toolbar.newSource')}
        </Button>
      </div>

      {/* 表格 */}
      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={data.items}
        loading={loading}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as number[]),
        }}
        pagination={tablePaginationProps}
        onChange={handleTableChange}
      />

      {/* 新增/编辑弹框 */}
      <Modal
        title={editingId ? t('metadataSource.modal.titleEdit') : t('metadataSource.modal.titleCreate')}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        width={680}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label={t('metadataSource.form.nameLabel')} rules={[{ required: true, message: t('metadataSource.form.nameRequired') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                <TrimInput />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="content_type" label={t('metadataSource.form.contentTypeLabel')} rules={[{ required: true, message: t('metadataSource.form.contentTypeRequired') }]}>
                <Select showSearch optionFilterProp="label" options={CONTENT_TYPES.map((t) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="collect_type" label={t('metadataSource.form.collectTypeLabel')} rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" options={COLLECT_TYPES.map((t) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="url" label={t('metadataSource.form.urlLabel')} rules={[{ required: true, message: t('metadataSource.form.urlRequired') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                <TrimInput />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="rate_limit" label={t('metadataSource.form.rateLimitLabel')}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label={t('metadataSource.form.statusLabel')}>
                <Select showSearch optionFilterProp="label" options={[{ label: 'YES', value: 'YES' }, { label: 'NO', value: 'NO' }]} />
              </Form.Item>
            </Col>
          </Row>

          {/* API方式专属配置 */}
          {collectType === 'API' && (
            <>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="api_endpoint" label={t('metadataSource.form.apiEndpointLabel')} rules={[formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                    <TrimInput />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="auth_type" label={t('metadataSource.form.authTypeLabel')}>
                    <Select showSearch optionFilterProp="label" options={AUTH_TYPES.map((t) => ({ label: t, value: t }))} allowClear />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="api_key"
                    label={t('metadataSource.form.apiKeyLabel')}
                    rules={[{
                      validator: (_, value) => {
                        const authType = form.getFieldValue('auth_type')
                        if (authType === 'API_Key' && !value && !editingId) {
                          return Promise.reject(t('metadataSource.form.apiKeyRequired'))
                        }
                        return Promise.resolve()
                      },
                    }]}
                  >
                    <TrimInput.Password />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {/* 网页爬取方式专属配置 */}
          {collectType === '网页爬取' && (
            <>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="page_url_template"
                    label={t('metadataSource.form.pageUrlTemplateLabel')}
                    rules={[{ required: true, message: t('metadataSource.form.pageUrlTemplateRequired') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
                  >
                    <TrimInput placeholder="https://example.com/search?q={{query}}" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="render_type"
                    label={t('metadataSource.form.renderTypeLabel')}
                    rules={[{ required: true, message: t('metadataSource.form.renderTypeRequired') }]}
                  >
                    <Select showSearch optionFilterProp="label" options={RENDER_TYPES.map((t) => ({ label: t, value: t }))} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    name="field_extract_rules"
                    label={t('metadataSource.form.fieldExtractRulesLabel')}
                    rules={[{ required: true, message: t('metadataSource.form.fieldExtractRulesRequired') }, formRules.maxLength(FORM_MAX_LENGTH.TEXT_AREA)]}
                    extra={t('metadataSource.form.fieldExtractRulesExtra')}
                  >
                    <TrimInput.TextArea rows={8} placeholder={'[\n  {"key": "title", "selector": "h1 span", "attr": "text"},\n  {"key": "score", "selector": "strong.rating_num", "attr": "text"}\n]'} />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}
