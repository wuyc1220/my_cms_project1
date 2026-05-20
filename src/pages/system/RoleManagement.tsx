import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Form,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Tree,
  message,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  SafetyOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  batchDeleteRoles,
  batchUpdateRoleStatus,
  createRole,
  deleteRole,
  getRoles,
  toggleRoleStatus,
  updateRole,
} from '../../api/roles'
import { getRoleMenuIds, assignRoleMenus } from '../../api/menus'
import { getMenuTree } from '../../api/menus'
import type { RoleCreatePayload, RoleListItem, RoleUpdatePayload } from '../../types/user'
import type { MenuItem } from '../../types/menu'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import SearchForm from '../../components/SearchForm'
import TrimInput from '../../components/TrimInput'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'
import { useFormRules } from '../../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../../constants/form'
import { getIcon } from '../../constants/iconMap'
import { isHandledError } from '../../api'


interface SearchValues {
  code?: string
  name?: string
  description?: string
  status?: string
}

interface RoleFormValues {
  code?: string
  name: string
  description?: string
  status: boolean
}

export default function RoleManagement() {
  const { t } = useI18n()
  const [roleForm] = Form.useForm<RoleFormValues>()
  const [list, setList] = useState<RoleListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<RoleListItem | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [permModalOpen, setPermModalOpen] = useState(false)
  const [permRole, setPermRole] = useState<RoleListItem | null>(null)
  const [permMenuTree, setPermMenuTree] = useState<MenuItem[]>([])
  const [permCheckedKeys, setPermCheckedKeys] = useState<React.Key[]>([])
  const [permLoading, setPermLoading] = useState(false)
  const [permSaving, setPermSaving] = useState(false)
  const navigate = useNavigate()
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.system.roles.operate')
  const formRules = useFormRules()
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadRoles(page, pageSize, filters, sortField, sortOrder)
    },
  })

  const statusOptions = useMemo(() => [
    { label: t('common.enabled'), value: 'active' },
    { label: t('common.disabled'), value: 'inactive' },
  ], [t])

  // 搜索字段配置
  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'code',
      labelKey: 'system.role.labelCode',
      type: 'input',
      placeholderKey: 'system.role.placeholderCode',
    },
    {
      name: 'name',
      labelKey: 'system.role.labelName',
      type: 'input',
      placeholderKey: 'system.role.placeholderName',
    },
    {
      name: 'description',
      labelKey: 'common.notes',
      type: 'input',
      placeholderKey: 'system.role.placeholderNotes',
    },
    {
      name: 'status',
      labelKey: 'common.status',
      type: 'select',
      options: statusOptions,
      placeholderKey: 'common.placeholder.all',
    },
  ], [statusOptions, t])

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
      setSelectedRowKeys([])
      resetSort()
      await loadRoles(1, pagination.pageSize, values, null, null)
    },
    onReset: () => {
      setSelectedRowKeys([])
      resetSort()
      void loadRoles(1, pagination.pageSize, {}, null, null)
    },
  })

  // 打开菜单权限分配弹窗
  const openPermModal = async (record: RoleListItem) => {
    setPermRole(record)
    setPermLoading(true)
    setPermModalOpen(true)
    try {
      const [tree, ids] = await Promise.all([
        getMenuTree(),
        getRoleMenuIds(record.id),
      ])
      setPermMenuTree(tree)
      setPermCheckedKeys(ids)
    } catch (err) {
      // error handled by axios interceptor
    } finally {
      setPermLoading(false)
    }
  }

  // 保存菜单权限
  const handlePermSave = async () => {
    if (!permRole) return
    setPermSaving(true)
    try {
      await assignRoleMenus(permRole.id, permCheckedKeys as number[])
      message.success(t('common.msg.updateSuccess'))
      setPermModalOpen(false)
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('common.msg.updateFailed'))
    } finally {
      setPermSaving(false)
    }
  }

  // 将菜单树转换为 Ant Design Tree 的 treeData 格式
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const permTreeData: any = useMemo(() => {
    const convert = (items: MenuItem[]): any[] =>
      items.map((item) => ({
        key: item.id,
        title: (
          <span>
            {getIcon(item.icon)}{' '}
            {t(item.i18n_key as Parameters<typeof t>[0])}
          </span>
        ),
        children: item.children?.length ? convert(item.children) : undefined,
      }))
    return convert(permMenuTree)
  }, [permMenuTree, t])

  const loadRoles = async (
    page = pagination.current,
    pageSize = pagination.pageSize,
    nextFilters = filters,
    nextSortField?: string | null,
    nextSortOrder?: 'ascend' | 'descend' | null,
  ) => {
    setLoading(true)
    try {
      const data = await getRoles({
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
    void loadRoles(1, pagination.pageSize, {}, null, null)
  }, [])

  const openCreateModal = () => {
    setEditingRecord(null)
    roleForm.resetFields()
    roleForm.setFieldsValue({ status: true })
    setModalOpen(true)
  }

  const openEditModal = (record: RoleListItem) => {
    setEditingRecord(record)
    roleForm.setFieldsValue({
      code: record.code,
      name: record.name,
      description: record.description || undefined,
      status: record.status === 'active',
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await roleForm.validateFields()
    setSubmitting(true)
    try {
      if (editingRecord) {
        const payload: RoleUpdatePayload = {
          name: values.name,
          description: values.description || null,
          status: values.status ? 'active' : 'inactive',
        }
        await updateRole(editingRecord.id, payload)
        message.success(t('system.role.msgUpdated'))
      } else {
        const payload: RoleCreatePayload = {
          code: values.code || null,
          name: values.name,
          description: values.description || null,
          status: values.status ? 'active' : 'inactive',
        }
        await createRole(payload)
        message.success(t('system.role.msgCreated'))
      }
      setModalOpen(false)
      await loadRoles(editingRecord ? pagination.current : 1, pagination.pageSize, filters, sortField, sortOrder)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string; error_code?: string } } }
      const errorCode = error.response?.data?.error_code
      if (errorCode === 'ROLE_NAME_EXISTS') {
        roleForm.setFields([{ name: 'name', errors: [t('system.role.msgNameExists')] }])
      } else if (errorCode === 'ROLE_CODE_EXISTS') {
        roleForm.setFields([{ name: 'code', errors: [t('system.role.msgCodeExists')] }])
      } else if (!isHandledError(err)) {
        void message.error(t('common.msg.createFailed'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleBatchStatus = async (status: string) => {
    if (!selectedRowKeys.length) {
      message.warning(t('system.role.msgSelectFirst'))
      return
    }
    await batchUpdateRoleStatus({ ids: selectedRowKeys as number[], status })
    message.success(t('system.role.msgBatchSuccess'))
    setSelectedRowKeys([])
    await loadRoles(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
  }

  const handleBatchDelete = async () => {
    if (!selectedRowKeys.length) {
      message.warning(t('system.role.msgSelectFirst'))
      return
    }
    const hasSystemRole = list.some((r) => selectedRowKeys.includes(r.id) && r.is_system)
    if (hasSystemRole) {
      message.warning(t('system.role.systemRoleCannotDelete'))
      return
    }
    await batchDeleteRoles(selectedRowKeys as number[])
    message.success(t('system.role.msgDeleted'))
    setSelectedRowKeys([])
    await loadRoles(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
  }

  const columns: ColumnsType<RoleListItem> = [
    {
      title: t('system.role.colCode'),
      dataIndex: 'code',
      key: 'code',
      sorter: true,
      sortOrder: sortField === 'code' ? sortOrder : null,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: t('system.role.colName'),
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      sortOrder: sortField === 'name' ? sortOrder : null,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 160,
      sorter: true,
      sortOrder: sortField === 'status' ? sortOrder : null,
      render: (_, record: RoleListItem) => (
        <Tooltip title={record.code === 'ADMIN' ? t('system.role.adminCannotModify') : ''}>
          <Popconfirm
            title={record.status === 'active' ? t('system.role.confirmToggle.disable') : t('system.role.confirmToggle.enable')}
            onConfirm={async () => {
              await toggleRoleStatus(record.id, record.status === 'active' ? 'inactive' : 'active')
              message.success(t('system.role.msgStatusUpdated'))
              await loadRoles(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
            }}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Switch
              checked={record.status === 'active'}
              checkedChildren={t('common.enabled')}
              unCheckedChildren={t('common.disabled')}
              disabled={record.code === 'ADMIN'}
              size="small"
            />
          </Popconfirm>
        </Tooltip>
      ),
    },
    {
      title: t('common.notes'),
      dataIndex: 'description',
      key: 'description',
      sorter: true,
      sortOrder: sortField === 'description' ? sortOrder : null,
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space size={0}>
          {canOperate && (
            <Tooltip title={record.code === 'ADMIN' ? t('system.role.adminCannotModify') : t('menuManagement.menuPermission')}>
              <Button
                type="link"
                size="small"
                icon={<SafetyOutlined />}
                onClick={() => void openPermModal(record)}
                disabled={record.code === 'ADMIN'}
              />
            </Tooltip>
          )}
          <Tooltip title={t('common.detail')}>
            <Button type="link" size="small" icon={<InfoCircleOutlined />} onClick={() => navigate(`/system/roles/${record.id}`)} />
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
            <Popconfirm
              title={t('system.role.confirmDelete')}
              onConfirm={async () => {
                await deleteRole(record.id)
                message.success(t('system.role.msgDeleted'))
                await loadRoles(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
              }}
              disabled={record.is_system || record.code === 'ADMIN'}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Tooltip title={record.code === 'ADMIN' ? t('system.role.adminCannotModify') : t('common.delete')}>
                <Button type="link" size="small" icon={<DeleteOutlined />} danger disabled={record.is_system || record.code === 'ADMIN'} />
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
        {canOperate && <Button onClick={() => void handleBatchStatus('active')}>{t('system.role.btnBatchEnable')}</Button>}
        {canOperate && <Button onClick={() => void handleBatchStatus('inactive')}>{t('system.role.btnBatchDisable')}</Button>}
        {canOperate && (
          <Popconfirm title={t('system.role.confirmBatchDelete')} onConfirm={() => void handleBatchDelete()} okText={t('common.confirm')} cancelText={t('common.cancel')}>
            <Button danger>{t('system.role.btnBatchDelete')}</Button>
          </Popconfirm>
        )}
        {canOperate && (
          <Button type="primary" onClick={openCreateModal}>
            {t('system.role.btnNew')}
          </Button>
        )}
      </div>

      <Table<RoleListItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={list}
        scroll={{ x: 1000 }}
        onChange={handleTableChange}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        pagination={tablePaginationProps}
        size="small"
      />

      <Modal
        title={editingRecord ? t('system.role.modalTitleEdit') : t('system.role.modalTitleCreate')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item name="code" label={t('system.role.labelCode')} rules={[formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
            <TrimInput placeholder={t('system.role.placeholderCode')} disabled={!!editingRecord} />
          </Form.Item>
          <Form.Item name="name" label={t('system.role.labelName')} rules={[{ required: true, message: t('system.role.ruleName') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
            <TrimInput placeholder={t('system.role.placeholderName')} />
          </Form.Item>
          <Form.Item name="description" label={t('common.notes')} rules={[formRules.maxLength(FORM_MAX_LENGTH.TEXT_AREA)]}>
            <TrimInput.TextArea rows={4} placeholder={t('system.role.placeholderNotes')} />
          </Form.Item>
          <Form.Item name="status" label={t('common.status')} valuePropName="checked">
            <Switch checkedChildren={t('common.enabled')} unCheckedChildren={t('common.disabled')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 菜单权限分配弹窗 */}
      <Modal
        title={`${t('menuManagement.menuPermission')} - ${permRole?.name || ''}`}
        open={permModalOpen}
        onCancel={() => setPermModalOpen(false)}
        onOk={() => void handlePermSave()}
        confirmLoading={permSaving}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        width={520}
        destroyOnClose
      >
        {permLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>{t('common.loading')}</div>
        ) : (
          <Tree
            checkable
            defaultExpandAll
            checkedKeys={permCheckedKeys}
            onCheck={(keys) => setPermCheckedKeys(keys as React.Key[])}
            treeData={permTreeData}
          />
        )}
      </Modal>


    </div>
  )
}
