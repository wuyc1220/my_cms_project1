/**
 * WorkflowConfigList — 流程配置列表页面
 *
 * URL: /workflow/configs
 *
 * 功能：
 * - 列表展示所有流程配置
 * - 支持按所属模块、状态筛选
 * - 新建、编辑、删除、发布、取消发布操作
 * - 批量发布、版本历史、复制新版本
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Drawer,
  Form,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from 'antd'
import TrimInput from '../../components/TrimInput'
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  StopOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  getWorkflowConfigs,
  createWorkflowConfig,
  updateWorkflowConfig,
  deleteWorkflowConfig,
  publishWorkflowConfig,
  unpublishWorkflowConfig,
  getVersionHistory,
  createNewVersion,
  batchPublishWorkflowConfigs,
} from '../../api/workflow'
import SearchForm from '../../components/SearchForm'
import type { SearchFieldConfig } from '../../types/searchForm'
import type { WorkflowConfigListItem, WorkflowConfigQueryParams } from '../../types/workflow'
import { useI18n } from '../../i18n/useI18n'
import type { MessageKey } from '../../i18n/messages'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import { useFormRules } from '../../hooks/useFormRules'
import { isHandledError } from '../../api'
import { FORM_MAX_LENGTH } from '../../constants/form'

const { Title } = Typography

interface SearchValues {
  process_code?: string
  process_name?: string
  belonging?: string[]
  status?: string
}

const BELONGING_OPTIONS = [
  { label: 'PROGRAM', value: 'PROGRAM' },
  { label: 'SEASON', value: 'SEASON' },
  { label: 'SERIES', value: 'SERIES' },
  { label: 'CHANNEL', value: 'CHANNEL' },
  { label: 'SCHEDULE', value: 'SCHEDULE' },
  { label: 'ARCHIVED', value: 'ARCHIVED' },
]

const STATUS_OPTIONS = [
  { labelKey: 'workflow.status.draft', value: 'draft' },
  { labelKey: 'workflow.status.published', value: 'published' },
  { labelKey: 'workflow.status.unpublished', value: 'unpublished' },
]

const BELONGING_I18N_MAP: Record<string, MessageKey> = {
  PROGRAM: 'workflow.belonging.PROGRAM',
  SEASON: 'workflow.belonging.SEASON',
  SERIES: 'workflow.belonging.SERIES',
  CHANNEL: 'workflow.belonging.CHANNEL',
  SCHEDULE: 'workflow.belonging.SCHEDULE',
  ARCHIVED: 'workflow.belonging.ARCHIVED',
}

export default function WorkflowConfigList() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const formRules = useFormRules()
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<WorkflowConfigListItem[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editingRecord, setEditingRecord] = useState<WorkflowConfigListItem | null>(null)

  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false)
  const [versionHistory, setVersionHistory] = useState<Array<{
    id: number
    version: number
    status: string
    published_version: number | null
    created_at: string | null
    updated_at: string | null
  }>>([])

  // ─── 搜索字段配置 ─────────────────────────────────────────────────────────────

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'process_code',
      labelKey: 'workflow.processCode',
      type: 'input',
      placeholderKey: 'workflow.placeholder.processCode',
    },
    {
      name: 'process_name',
      labelKey: 'workflow.processName',
      type: 'input',
      placeholderKey: 'workflow.placeholder.processName',
    },
    {
      name: 'belonging',
      labelKey: 'workflow.belonging',
      type: 'multiSelect',
      placeholderKey: 'workflow.placeholder.belonging',
      options: BELONGING_OPTIONS.map((o) => ({
        labelKey: `workflow.belonging.${o.value}`,
        value: o.value,
        label: o.label,
      })),
    },
    {
      name: 'status',
      labelKey: 'workflow.status',
      type: 'select',
      options: STATUS_OPTIONS.map((o) => ({
        labelKey: o.labelKey,
        value: o.value,
        label: o.value,
      })),
    },
  ], [])

  // ─── 使用 useTablePagination Hook ────────────────────────────────────────────

  const {
    pagination,
    updatePagination,
    sortField,
    sortOrder,
    resetSort,
    tablePaginationProps,
    handleTableChange,
    getParams,
  } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filters, sortField, sortOrder)
    },
  })

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

  // ─── 数据加载 ────────────────────────────────────────────────────────────────

  const loadList = async (
    targetPage: number,
    targetPageSize: number,
    nextFilters: SearchValues,
    nextSortField?: string | null,
    nextSortOrder?: 'ascend' | 'descend' | null,
  ) => {
    setLoading(true)
    try {
      const params: WorkflowConfigQueryParams = {
        page: targetPage,
        page_size: targetPageSize,
        process_code: nextFilters.process_code,
        process_name: nextFilters.process_name,
        belonging: nextFilters.belonging,
        status: nextFilters.status,
        sort_by: nextSortField ?? undefined,
        sort_order: nextSortOrder === 'ascend' ? 'asc' : nextSortOrder === 'descend' ? 'desc' : undefined,
      }
      console.log('loadList params:', params)
      const resp = await getWorkflowConfigs(params)
      setData(resp.items)
      updatePagination(resp)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('workflow.msg.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadList(1, pagination.pageSize, {}, null, null)
  }, [])

  const reloadCurrentPage = useCallback(() => {
    const { page, page_size } = getParams()
    void loadList(page, page_size, filters, sortField, sortOrder)
  }, [getParams, filters, sortField, sortOrder])

  // ─── 删除 ────────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteWorkflowConfig(id)
        void message.success(t('workflow.msg.deleteSuccess'))
        setSelectedRowKeys(prev => prev.filter(key => key !== id))
        reloadCurrentPage()
      } catch (err) {
        if (isHandledError(err)) return
        void message.error(t('workflow.msg.deleteFailed'))
      }
    },
    [reloadCurrentPage, t],
  )

  // ─── 发布 / 取消发布 ─────────────────────────────────────────────────────────

  const handlePublish = useCallback(
    async (id: number) => {
      try {
        await publishWorkflowConfig(id)
        void message.success(t('workflow.msg.publishSuccess'))
        reloadCurrentPage()
      } catch (err) {
        if (isHandledError(err)) return
        void message.error(t('workflow.msg.publishFailed'))
      }
    },
    [reloadCurrentPage, t],
  )

  const handleUnpublish = useCallback(
    async (id: number) => {
      try {
        await unpublishWorkflowConfig(id)
        void message.success(t('workflow.msg.unpublishSuccess'))
        reloadCurrentPage()
      } catch (err) {
        if (isHandledError(err)) return
        void message.error(t('workflow.msg.unpublishFailed'))
      }
    },
    [reloadCurrentPage, t],
  )

  // ─── 批量发布 ────────────────────────────────────────────────────────────────

  const handleBatchPublish = useCallback(async () => {
    if (selectedRowKeys.length === 0) return
    try {
      await batchPublishWorkflowConfigs(selectedRowKeys)
      void message.success(t('workflow.msg.publishSuccess'))
      setSelectedRowKeys([])
      reloadCurrentPage()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('workflow.msg.publishFailed'))
    }
  }, [selectedRowKeys, reloadCurrentPage, t])

  // ─── 复制新版本 ──────────────────────────────────────────────────────────────

  const handleCopy = useCallback(
    async (record: WorkflowConfigListItem) => {
      try {
        const result = await createNewVersion(record.id)
        void message.success(`${t('workflow.msg.createVersionSuccess')} v${result.version}`)
        navigate(`/workflow/editor/${result.id}`)
      } catch (err: unknown) {
        if (isHandledError(err)) return
        const errorMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || t('workflow.msg.createVersionFailed')
        void message.error(errorMsg)
      }
    },
    [navigate, t],
  )

  // ─── 新建 ────────────────────────────────────────────────────────────────────

  const handleCreate = useCallback(() => {
    void createForm
      .validateFields()
      .then(async (values) => {
        setCreating(true)
        try {
          const result = await createWorkflowConfig(values)
          setCreateModalOpen(false)
          createForm.resetFields()
          void message.success(t('workflow.msg.createSuccess'))
          navigate(`/workflow/editor/${result.id}`)
        } catch (err) {
          if (isHandledError(err)) return
          void message.error(t('workflow.msg.createFailed'))
        } finally {
          setCreating(false)
        }
      })
      .catch(() => {})
  }, [createForm, navigate, t])

  // ─── 编辑 ────────────────────────────────────────────────────────────────────

  const handleOpenEdit = useCallback(
    (record: WorkflowConfigListItem) => {
      setEditingRecord(record)
      editForm.setFieldsValue({
        process_code: record.process_code,
        process_name: record.process_name,
        belonging: record.belonging,
      })
      setEditModalOpen(true)
    },
    [editForm],
  )

  const handleEdit = useCallback(() => {
    if (!editingRecord) return
    void editForm
      .validateFields()
      .then(async (values) => {
        setEditing(true)
        try {
          await updateWorkflowConfig(editingRecord.id, values)
          setEditModalOpen(false)
          editForm.resetFields()
          setEditingRecord(null)
          void message.success(t('workflow.msg.editSuccess'))
          reloadCurrentPage()
        } catch (err) {
          if (isHandledError(err)) return
        } finally {
          setEditing(false)
        }
      })
      .catch(() => {})
  }, [editForm, editingRecord, reloadCurrentPage, t])

  // ─── 版本历史 ────────────────────────────────────────────────────────────────

  const handleShowVersionHistory = useCallback(async (id: number) => {
    setVersionDrawerOpen(true)
    try {
      const history = await getVersionHistory(id)
      setVersionHistory(history)
    } catch (err) {
      if (isHandledError(err)) return
      setVersionHistory([])
    }
  }, [])

  // ─── 所属模块选项 ────────────────────────────────────────────────────────────

  const belongingOptions = useMemo(() =>
    BELONGING_OPTIONS.map((o) => ({
      label: t(BELONGING_I18N_MAP[o.value]),
      value: o.value,
    })),
    [t],
  )

  // ─── 表格列定义 ──────────────────────────────────────────────────────────────

  const columns: ColumnsType<WorkflowConfigListItem> = useMemo(() => [
    {
      title: t('workflow.processCode'),
      dataIndex: 'process_code',
      key: 'process_code',
      sorter: true,
      sortOrder: sortField === 'process_code' ? sortOrder : null,
      ellipsis: { showTitle: false },
      render: (val: string) => <Tooltip title={val}><span>{val}</span></Tooltip>,
    },
    {
      title: t('workflow.processName'),
      dataIndex: 'process_name',
      key: 'process_name',
      sorter: true,
      sortOrder: sortField === 'process_name' ? sortOrder : null,
      ellipsis: { showTitle: false },
      render: (val: string) => <Tooltip title={val}><span>{val}</span></Tooltip>,
    },
    {
      title: t('workflow.belonging'),
      dataIndex: 'belonging',
      key: 'belonging',
      width: 140,
      sorter: true,
      sortOrder: sortField === 'belonging' ? sortOrder : null,
      render: (val: string) => {
        const labelMap: Record<string, string> = {
          PROGRAM: t('workflow.belonging.PROGRAM'),
          SEASON: t('workflow.belonging.SEASON'),
          SERIES: t('workflow.belonging.SERIES'),
          CHANNEL: t('workflow.belonging.CHANNEL'),
          SCHEDULE: t('workflow.belonging.SCHEDULE'),
          ARCHIVED: t('workflow.belonging.ARCHIVED'),
        }
        return <Tag color="blue">{labelMap[val] || val}</Tag>
      },
    },
    {
      title: t('workflow.status'),
      dataIndex: 'status',
      key: 'status',
      width: 140,
      sorter: true,
      sortOrder: sortField === 'status' ? sortOrder : null,
      render: (val: string) => (
        <Tag color={val === 'published' ? 'green' : val === 'unpublished' ? 'default' : 'orange'}>
          {val === 'published' ? t('workflow.status.published') : val === 'unpublished' ? t('workflow.status.unpublished') : t('workflow.status.draft')}
        </Tag>
      ),
    },
    {
      title: t('workflow.version'),
      dataIndex: 'version',
      key: 'version',
      width: 140,
      sorter: true,
      sortOrder: sortField === 'version' ? sortOrder : null,
    },
    {
      title: t('workflow.publishedVersion'),
      dataIndex: 'published_version',
      key: 'published_version',
      width: 120,
      sorter: true,
      sortOrder: sortField === 'published_version' ? sortOrder : null,
      render: (val: number | null) => (val ? `v${val}` : '-'),
    },
    {
      title: t('workflow.updatedTime'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      sorter: true,
      sortOrder: sortField === 'updated_at' ? sortOrder : null,
      render: (val: string) => (val ? new Date(val).toLocaleString() : '-'),
    },
    {
      title: t('workflow.action'),
      key: 'action',
      fixed: 'right',
      width: 160,
      render: (_: unknown, record: WorkflowConfigListItem) => (
        <Space size={0}>
          <Tooltip title={t('workflow.btn.edit')}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(record)}
            />
          </Tooltip>
          <Tooltip title={record.status === 'published' ? t('workflow.btn.view') : t('workflow.btn.orchestrate')}>
            <Button
              type="link"
              size="small"
              icon={record.status === 'published' ? <InfoCircleOutlined /> : <EditOutlined />}
              onClick={() => navigate(`/workflow/editor/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title={t('workflow.version')}>
            <Button
              type="link"
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => handleShowVersionHistory(record.id)}
            />
          </Tooltip>
          <Tooltip title={t('workflow.copy')}>
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopy(record)}
            />
          </Tooltip>
          {record.status !== 'published' && (
            <Popconfirm
              title={t('workflow.confirmPublish')}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              onConfirm={() => handlePublish(record.id)}
            >
              <Tooltip title={t('workflow.btn.publish')}>
                <Button type="link" size="small" icon={<PlayCircleOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
          {record.status === 'published' && (
            <Popconfirm
              title={t('workflow.confirmUnpublish')}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              onConfirm={() => handleUnpublish(record.id)}
            >
              <Tooltip title={t('workflow.btn.unpublish')}>
                <Button type="link" size="small" icon={<StopOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
          {record.status !== 'published' && (
            <Popconfirm
              title={t('workflow.confirmDelete')}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              onConfirm={() => handleDelete(record.id)}
            >
              <Tooltip title={t('workflow.btn.delete')}>
                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ], [t, navigate, handleOpenEdit, handleShowVersionHistory, handleCopy, handlePublish, handleUnpublish, handleDelete, sortField, sortOrder])

  return (
    <div className="main-container">
      <SearchForm
        fields={searchFields}
        form={searchForm}
        showExpand={showExpand}
        onSearch={handleSearch}
        onReset={handleReset}
        loading={loading}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('menu.workflow.processConfig')}
        </Title>
        <Space>
          <Popconfirm
            title={t('workflow.confirmPublish')}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            onConfirm={() => void handleBatchPublish()}
            disabled={selectedRowKeys.length === 0}
          >
            <Button disabled={selectedRowKeys.length === 0} icon={<PlayCircleOutlined />}>
              {t('workflow.btn.batchPublish')}{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ''}
            </Button>
          </Popconfirm>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            {t('workflow.btn.new')}
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        size="small"
        loading={loading}
        scroll={{ x: 1200 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as number[]),
          getCheckboxProps: (record) => ({
            disabled: record.status === 'published',
          }),
        }}
        onChange={handleTableChange}
        pagination={tablePaginationProps}
      />

      <Modal
        title={t('workflow.btn.new')}
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalOpen(false)
          createForm.resetFields()
        }}
        confirmLoading={creating}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="process_code"
            label={t('workflow.processCode')}
            rules={[{ required: true, message: t('workflow.placeholder.processCode') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
          >
            <TrimInput placeholder={t('workflow.placeholder.processCode')} />
          </Form.Item>
          <Form.Item
            name="process_name"
            label={t('workflow.processName')}
            rules={[{ required: true, message: t('workflow.placeholder.processName') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
          >
            <TrimInput placeholder={t('workflow.placeholder.processName')} />
          </Form.Item>
          <Form.Item
            name="belonging"
            label={t('workflow.belonging')}
            rules={[{ required: true, message: t('workflow.placeholder.belonging') }]}
          >
            <Select showSearch optionFilterProp="label" options={belongingOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('workflow.btn.edit')}
        open={editModalOpen}
        onOk={handleEdit}
        onCancel={() => {
          setEditModalOpen(false)
          editForm.resetFields()
          setEditingRecord(null)
        }}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        confirmLoading={editing}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="process_code"
            label={t('workflow.processCode')}
            rules={[{ required: true, message: t('workflow.placeholder.processCode') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
          >
            <TrimInput disabled placeholder={t('workflow.placeholder.processCode')} />
          </Form.Item>
          <Form.Item
            name="process_name"
            label={t('workflow.processName')}
            rules={[{ required: true, message: t('workflow.placeholder.processName') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
          >
            <TrimInput placeholder={t('workflow.placeholder.processName')} />
          </Form.Item>
          <Form.Item
            name="belonging"
            label={t('workflow.belonging')}
            rules={[{ required: true, message: t('workflow.placeholder.belonging') }]}
          >
            <Select disabled showSearch optionFilterProp="label" options={belongingOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={t('workflow.versionHistory')}
        placement="right"
        width={400}
        open={versionDrawerOpen}
        onClose={() => setVersionDrawerOpen(false)}
      >
        {versionHistory.length === 0 ? (
          <Typography.Text type="secondary">{t('workflow.noVersionHistory')}</Typography.Text>
        ) : (
          <Timeline
            items={versionHistory.map((v) => ({
              color: v.status === 'published' ? 'green' : v.status === 'unpublished' ? 'gray' : 'blue',
              children: (
                <div>
                  <div>
                    <Tag color={v.status === 'published' ? 'green' : v.status === 'unpublished' ? 'default' : 'orange'}>
                      v{v.version} {v.status === 'published' ? t('workflow.status.published') : v.status === 'unpublished' ? t('workflow.status.unpublished') : t('workflow.status.draft')}
                    </Tag>
                    {v.published_version === v.version && (
                      <Tag color="blue">{t('workflow.currentPublished')}</Tag>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                    {t('workflow.createTime')}: {v.created_at ? new Date(v.created_at).toLocaleString() : '-'}
                  </div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {t('workflow.updateTime')}: {v.updated_at ? new Date(v.updated_at).toLocaleString() : '-'}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Button
                      type="link"
                      size="small"
                      icon={v.status === 'published' ? <InfoCircleOutlined /> : <EditOutlined />}
                      onClick={() => {
                        navigate(`/workflow/editor/${v.id}`)
                        setVersionDrawerOpen(false)
                      }}
                    >
                      {v.status === 'published' ? t('workflow.btn.view') : t('workflow.editVersion')}
                    </Button>
                  </div>
                </div>
              ),
            }))}
          />
        )}
      </Drawer>
    </div>
  )
}
