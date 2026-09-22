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
  Switch,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { DeleteOutlined, EditOutlined, InfoCircleOutlined, KeyOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  batchDeleteUsers,
  batchUpdateUserStatus,
  createUser,
  deleteUser,
  getUser,
  getUsers,
  resetPassword,
  toggleUserStatus,
  updateUser,
} from '../../api/users'
import { getAllRoles } from '../../api/roles'
import { getPasswordPatternMinLen } from '../../api/configs'
import type { RoleListItem, UserCreatePayload, UserListItem, UserUpdatePayload } from '../../types/user'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import SearchForm from '../../components/SearchForm'
import ResizableTable from '../../components/ResizableTable'
import TrimInput from '../../components/TrimInput'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'
import { useFormRules } from '../../hooks/useFormRules'
import { isHandledError } from '../../api'
import { FORM_MAX_LENGTH } from '../../constants/form'
import { validatePassword, PASSWORD_ERROR_I18N_KEYS } from '../../utils/passwordValidation'

interface SearchValues {
  username?: string
  display_name?: string
  email?: string
  phone_number?: string
  status?: string
  role_ids?: number[]
}

interface UserFormValues {
  username: string
  password?: string
  display_name?: string
  email?: string
  phone_number?: string
  status: boolean
  role_ids?: number[]
}

export default function UserManagement() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [userForm] = Form.useForm<UserFormValues>()
  const [list, setList] = useState<UserListItem[]>([])
  const [roles, setRoles] = useState<RoleListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [patternMinLen, setPatternMinLen] = useState(6)
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<UserListItem | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [resetPwdModalOpen, setResetPwdModalOpen] = useState(false)
  const [resetPwdRecord, setResetPwdRecord] = useState<UserListItem | null>(null)
  const [resetPwdSubmitting, setResetPwdSubmitting] = useState(false)
  const [resetPwdForm] = Form.useForm()
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.system.users.operate')
  const formRules = useFormRules()
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadUsers(page, pageSize, filters, sortField, sortOrder)
    },
  })

  const statusOptions = useMemo(() => [
    { label: t('common.enabled'), value: 'active' },
    { label: t('common.disabled'), value: 'inactive' },
  ], [t])

  const roleOptions = useMemo(
    () => roles.map((role) => ({ label: role.name, value: role.id })),
    [roles],
  )

  const roleNameMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const r of roles) map.set(r.id, r.name)
    for (const r of editingRecord?.roles ?? []) map.set(r.id, r.name)
    return map
  }, [roles, editingRecord])

  // 搜索字段配置
  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'username',
      labelKey: 'system.user.labelUsername',
      type: 'input',
      placeholderKey: 'system.user.placeholderUsername',
    },
    {
      name: 'display_name',
      labelKey: 'system.user.labelDisplayName',
      type: 'input',
      placeholderKey: 'system.user.placeholderDisplayName',
    },
    {
      name: 'phone_number',
      labelKey: 'system.user.labelPhone',
      type: 'input',
      placeholderKey: 'system.user.placeholderPhone',
    },
    {
      name: 'email',
      labelKey: 'system.user.labelEmail',
      type: 'input',
      placeholderKey: 'system.user.placeholderEmail',
    },
    {
      name: 'status',
      labelKey: 'common.status',
      type: 'select',
      options: statusOptions,
      placeholderKey: 'common.placeholder.all',
    },
    {
      name: 'role_ids',
      labelKey: 'system.user.labelRole',
      type: 'multiSelect',
      options: roleOptions,
      placeholderKey: 'system.user.placeholderRole',
    },
  ], [statusOptions, roleOptions])

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
      await loadUsers(1, pagination.pageSize, values, null, null)
    },
    onReset: () => {
      setSelectedRowKeys([])
      resetSort()
      void loadUsers(1, pagination.pageSize, {}, null, null)
    },
  })

  const loadRoles = async () => {
    const data = await getAllRoles()
    setRoles(data)
  }

  const loadUsers = async (
    page = pagination.current,
    pageSize = pagination.pageSize,
    nextFilters = filters,
    nextSortField?: string | null,
    nextSortOrder?: 'ascend' | 'descend' | null,
  ) => {
    setLoading(true)
    try {
      const data = await getUsers({
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRoles()
    void loadUsers(1, pagination.pageSize, {}, null, null)
    getPasswordPatternMinLen()
      .then((v) => {
        setPatternMinLen(v)
      })
      .catch(() => {
        // 获取配置失败时保持默认值 6
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 密码强度校验（与后端 password_validator 规则一致）
  const passwordStrengthValidator =
    (getUsername: () => string | undefined) => (_: unknown, value: string) => {
      if (!value) return Promise.resolve()
      const errorCode = validatePassword(value, { username: getUsername(), patternMinLen })
      if (errorCode) {
        return Promise.reject(new Error(t(PASSWORD_ERROR_I18N_KEYS[errorCode])))
      }
      return Promise.resolve()
    }

  const openCreateModal = () => {
    setEditingRecord(null)
    userForm.resetFields()
    userForm.setFieldsValue({ status: true, role_ids: [] })
    setModalOpen(true)
  }

  const openResetPwdModal = (record: UserListItem) => {
    setResetPwdRecord(record)
    resetPwdForm.resetFields()
    setResetPwdModalOpen(true)
  }

  const handleResetPwdSubmit = async () => {
    const values = await resetPwdForm.validateFields()
    if (values.new_password !== values.repeat_password) {
      resetPwdForm.setFields([
        { name: 'repeat_password', errors: [t('system.user.rulePasswordMismatch')] },
      ])
      return
    }
    if (!resetPwdRecord) return
    setResetPwdSubmitting(true)
    try {
      await resetPassword(resetPwdRecord.id, values.new_password, values.repeat_password)
      message.success(t('system.user.msgPasswordReset'))
      setResetPwdModalOpen(false)
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const error = err as { response?: { data?: { error_code?: string; detail?: string } } }
      const errorCode = error.response?.data?.error_code
      const detail = error.response?.data?.detail
      if (errorCode === 'PASSWORDS_DO_NOT_MATCH') {
        resetPwdForm.setFields([
          { name: 'repeat_password', errors: [t('system.user.rulePasswordMismatch')] },
        ])
      } else if (detail) {
        resetPwdForm.setFields([
          { name: 'new_password', errors: [detail] },
        ])
      } else {
        void message.error(t('common.msg.updateFailed'))
      }
    } finally {
      setResetPwdSubmitting(false)
    }
  }

  const openEditModal = async (record: UserListItem) => {
    setSubmitting(true)
    try {
      const detail = await getUser(record.id)
      setEditingRecord(detail)
      userForm.setFieldsValue({
        username: detail.username,
        display_name: detail.display_name || undefined,
        email: detail.email || undefined,
        phone_number: detail.phone_number || undefined,
        status: detail.status === 'active',
        role_ids: detail.roles.map((role) => role.id),
      })
      setModalOpen(true)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    const values = await userForm.validateFields()
    setSubmitting(true)
    try {
      if (editingRecord) {
        const payload: UserUpdatePayload = {
          display_name: values.display_name ?? null,
          email: values.email ?? null,
          phone_number: values.phone_number ?? null,
          status: values.status ? 'active' : 'inactive',
          role_ids: values.role_ids ?? [],
        }
        await updateUser(editingRecord.id, payload)
        message.success(t('system.user.msgUpdated'))
      } else {
        const payload: UserCreatePayload = {
          username: values.username,
          password: values.password || '',
          display_name: values.display_name ?? null,
          email: values.email ?? null,
          phone_number: values.phone_number ?? null,
          status: values.status ? 'active' : 'inactive',
          role_ids: values.role_ids ?? [],
        }
        await createUser(payload)
        message.success(t('system.user.msgCreated'))
      }
      setModalOpen(false)
      await loadUsers(editingRecord ? pagination.current : 1, pagination.pageSize, filters, sortField, sortOrder)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string; error_code?: string } } }
      const errorCode = error.response?.data?.error_code
      if (errorCode === 'USERNAME_EXISTS') {
        userForm.setFields([{ name: 'username', errors: [t('system.user.msgUsernameExists')] }])
      } else if (!isHandledError(err)) {
        void message.error(t('common.msg.createFailed'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleBatchStatus = async (status: string) => {
    if (!selectedRowKeys.length) {
      message.warning(t('system.user.msgSelectFirst'))
      return
    }
    // 跳过已处于目标状态的用户（批量启用跳过已启用、批量禁用跳过已禁用）
    const targetIds = list
      .filter((u) => selectedRowKeys.includes(u.id) && u.status !== status)
      .map((u) => u.id)
    if (!targetIds.length) {
      message.info(t('system.user.msgBatchNoChange'))
      return
    }
    await batchUpdateUserStatus({ ids: targetIds, status })
    message.success(t('system.user.msgBatchSuccess'))
    setSelectedRowKeys([])
    await loadUsers(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
  }

  const handleBatchDelete = async () => {
    if (!selectedRowKeys.length) {
      message.warning(t('system.user.msgSelectFirst'))
      return
    }
    Modal.confirm({
      title: t('system.user.confirmBatchDelete'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        await batchDeleteUsers(selectedRowKeys as number[])
        message.success(t('system.user.msgBatchDeleteSuccess'))
        setSelectedRowKeys([])
        await loadUsers(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
      },
    })
  }

  const columns: ColumnsType<UserListItem> = [
    {
      title: t('system.user.colAccount'),
      dataIndex: 'username',
      key: 'username',
      width: 260,
      sorter: true,
      sortOrder: sortField === 'username' ? sortOrder : null,
    },
    {
      title: t('system.user.colDisplayName'),
      dataIndex: 'display_name',
      key: 'display_name',
      width: 320,
      sorter: true,
      sortOrder: sortField === 'display_name' ? sortOrder : null,
    },
    {
      title: t('system.user.colPhone'),
      dataIndex: 'phone_number',
      key: 'phone_number',
      width: 160,
      sorter: true,
      sortOrder: sortField === 'phone_number' ? sortOrder : null,
    },
    {
      title: t('system.user.colEmail'),
      dataIndex: 'email',
      key: 'email',
      width: 200,
      sorter: true,
      sortOrder: sortField === 'email' ? sortOrder : null,
    },
    {
      title: t('system.user.colRole'),
      dataIndex: 'roles',
      key: 'roles',
      width: 300,
      render: (value: RoleListItem[]) =>
        value?.length ? (
          <Tooltip
            title={
              <Space size={[4, 4]} wrap>
                {value.map((role) => (
                  <Tag key={role.id}>{role.name}</Tag>
                ))}
              </Space>
            }
            overlayStyle={{ maxWidth: 480 }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
              {value.map((role) => role.name).join('、')}
            </span>
          </Tooltip>
        ) : '-',
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      sorter: true,
      sortOrder: sortField === 'status' ? sortOrder : null,
      render: (_, record) => (
        <Popconfirm
          title={record.status === 'active' ? t('system.user.confirmToggle.disable') : t('system.user.confirmToggle.enable')}
          onConfirm={async () => {
            await toggleUserStatus(record.id, record.status === 'active' ? 'inactive' : 'active')
            message.success(t('system.user.msgStatusUpdated'))
            await loadUsers(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
          }}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
        >
          <Switch
            checked={record.status === 'active'}
            checkedChildren={t('common.enabled')}
            unCheckedChildren={t('common.disabled')}
            size="small"
          />
        </Popconfirm>
      ),
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 140,
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title={t('common.detail')}>
            <Button type="link" size="small" icon={<InfoCircleOutlined />} onClick={() => navigate(`/system/users/${record.id}`)} />
          </Tooltip>
          {canOperate && (
            <Tooltip title={t('common.edit')}>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => void openEditModal(record)}
              />
            </Tooltip>
          )}
          {canOperate && (
            <Tooltip title={t('system.user.btnResetPwd')}>
              <Button type="link" size="small" icon={<KeyOutlined />} onClick={() => openResetPwdModal(record)} />
            </Tooltip>
          )}
          {canOperate && (
            <Popconfirm
              title={t('system.user.confirmDelete')}
              onConfirm={async () => {
                await deleteUser(record.id)
                message.success(t('system.user.msgDeleted'))
                await loadUsers(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
              }}
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
          {canOperate && <Button disabled={!selectedRowKeys.length} onClick={() => void handleBatchStatus('active')}>{t('system.user.btnBatchEnable')}</Button>}
          {canOperate && <Button disabled={!selectedRowKeys.length} onClick={() => void handleBatchStatus('inactive')}>{t('system.user.btnBatchDisable')}</Button>}
          {canOperate && (
            <Button danger disabled={!selectedRowKeys.length} onClick={handleBatchDelete}>
              {t('system.user.btnBatchDelete')}
            </Button>
          )}
          {canOperate && (
            <Button type="primary" onClick={openCreateModal}>
              {t('system.user.btnNew')}
            </Button>
          )}
        </div>

        <ResizableTable<UserListItem>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={list}
          scroll={{ x: 1240 }}
          onChange={handleTableChange}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={tablePaginationProps}
          size="small"
        />

      <Modal
        title={editingRecord ? t('system.user.modalTitleEdit') : t('system.user.modalTitleCreate')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        width={700}
        destroyOnHidden
      >
        <Form form={userForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="username" label={t('system.user.labelUsername')} rules={[{ required: true, message: t('system.user.ruleUsername') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                <TrimInput placeholder={t('system.user.placeholderUsername')} disabled={!!editingRecord} autoComplete="off" />
              </Form.Item>
            </Col>
            {!editingRecord && (
              <Col span={12}>
                <Form.Item
                  name="password"
                  label={t('system.user.labelPassword')}
                  dependencies={['username']}
                  rules={[
                    { required: true, message: t('system.user.rulePassword') },
                    { validator: passwordStrengthValidator(() => userForm.getFieldValue('username')) },
                  ]}
                >
                  <TrimInput.Password placeholder={t('system.user.placeholderPassword')} autoComplete="new-password" />
                </Form.Item>
              </Col>
            )}
            <Col span={12}>
              <Form.Item name="display_name" label={t('system.user.labelDisplayName')} rules={[{ required: true, message: t('system.user.ruleDisplayName') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                <TrimInput placeholder={t('system.user.placeholderDisplayName')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label={t('system.user.labelEmail')}  rules={[{ type: 'email', message: t('system.user.ruleEmail') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                <TrimInput placeholder={t('system.user.placeholderEmail')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone_number" label={t('system.user.labelPhone')} rules={[{ pattern: /^\+?[\d\s\-()]{6,20}$/, message: t('system.user.rulePhone') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                <TrimInput placeholder={t('system.user.placeholderPhone')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="role_ids" label={t('system.user.labelRole')}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  mode="multiple"
                  allowClear
                  options={roleOptions}
                  placeholder={t('system.user.placeholderRole')}
                  tagRender={(props) => {
                    const { value, closable, onClose } = props
                    const name = roleNameMap.get(value as number) ?? String(value)
                    return (
                      <Tag closable={closable} onClose={onClose} style={{ marginRight: 3 }}>
                        {name}
                      </Tag>
                    )
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label={t('common.status')} valuePropName="checked">
                <Switch checkedChildren={t('common.enabled')} unCheckedChildren={t('common.disabled')} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={t('system.user.modalTitleResetPwd')}
        open={resetPwdModalOpen}
        onCancel={() => setResetPwdModalOpen(false)}
        onOk={() => void handleResetPwdSubmit()}
        confirmLoading={resetPwdSubmitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
      >
        <Form form={resetPwdForm} layout="vertical">
          <Form.Item
            name="new_password"
            label={t('system.user.labelNewPassword')}
            rules={[
              { required: true, message: t('system.user.ruleNewPassword') },
              { validator: passwordStrengthValidator(() => resetPwdRecord?.username) },
            ]}
          >
            <TrimInput.Password placeholder={t('system.user.placeholderNewPassword')} />
          </Form.Item>
          <Form.Item
            name="repeat_password"
            label={t('system.user.labelRepeatPassword')}
            rules={[
              { required: true, message: t('system.user.ruleRepeatPassword') },
            ]}
          >
            <TrimInput.Password placeholder={t('system.user.placeholderRepeatPassword')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
