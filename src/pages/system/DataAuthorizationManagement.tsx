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
import { ClearOutlined, TeamOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  batchAuthorize,
  batchClear,
  getAuthContents,
  getAuthRoles,
  getAuthUsers,
} from '../../api/dataAuth'
import { getDictChildren } from '../../api/dicts'
import SearchForm from '../../components/SearchForm'
import type { SearchFieldConfig } from '../../types/searchForm'
import type {
  ContentAuthListItem,
  ContentAuthQueryParams,
  RoleSimpleItem,
  UserSimpleItem,
} from '../../types/dataAuth'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'
import { isHandledError } from '../../api'


interface SearchValues {
  content_name?: string
  content_types?: string[]
  ingest_statuses?: string[]
  authorized_user?: string
  authorized_role?: string
}

interface AuthorizeFormValues {
  role_ids: number[]
  user_ids: number[]
}

export default function DataAuthorizationManagement() {
  const { t } = useI18n()
  const [list, setList] = useState<ContentAuthListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'single' | 'batch'>('single')
  const [currentRecord, setCurrentRecord] = useState<ContentAuthListItem | null>(null)
  const [authorizeForm] = Form.useForm<AuthorizeFormValues>()
  const [roleOptions, setRoleOptions] = useState<RoleSimpleItem[]>([])
  const [userOptions, setUserOptions] = useState<UserSimpleItem[]>([])
  const [ingestStatusOptions, setIngestStatusOptions] = useState<{ label: string; value: string }[]>([])
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.system.dataAuth.operate')

  const searchFields: SearchFieldConfig[] = useMemo(
    () => [
      {
        name: 'content_name',
        labelKey: 'system.dataAuth.search.contentName',
        type: 'input',
        placeholderKey: 'system.dataAuth.search.contentNamePlaceholder',
      },
      {
        name: 'content_types',
        labelKey: 'system.dataAuth.search.contentType',
        type: 'multiSelect',
        placeholderKey: 'system.dataAuth.search.contentTypePlaceholder',
        options: [
          { label: 'MOVIE', value: 'MOVIE' },
          { label: 'EPISODE', value: 'EPISODE' },
          { label: 'SERIES', value: 'SERIES' },
          { label: 'SEASON', value: 'SEASON' },
          { label: 'CHANNEL', value: 'CHANNEL' },
          { label: 'SCHEDULE', value: 'SCHEDULE' },
        ],
      },
      {
        name: 'ingest_statuses',
        labelKey: 'system.dataAuth.search.ingestStatus',
        type: 'multiSelect',
        placeholderKey: 'system.dataAuth.search.ingestStatusPlaceholder',
        options: ingestStatusOptions,
      },
      {
        name: 'authorized_role',
        labelKey: 'system.dataAuth.search.authorizedRole',
        type: 'input',
        placeholderKey: 'system.dataAuth.search.authorizedRolePlaceholder',
      },
      {
        name: 'authorized_user',
        labelKey: 'system.dataAuth.search.authorizedUser',
        type: 'input',
        placeholderKey: 'system.dataAuth.search.authorizedUserPlaceholder',
      },
    ],
    [t, ingestStatusOptions]
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
    fieldsCount: searchFields.length,
    onSearch: async (values) => {
      setSelectedIds([])
      resetPagination()
      await loadList(1, pagination.pageSize, values, sortField, sortOrder)
    },
    onReset: () => {
      setSelectedIds([])
      resetPagination()
      resetSort()
      void loadList(1, pagination.pageSize, {}, null, null)
    },
  })

  const { pagination, updatePagination, sortField, sortOrder, resetSort, resetPagination, tablePaginationProps, handleTableChange } =
    useTablePagination({
      onChange: ({ page, pageSize, sortField, sortOrder }) => {
        void loadList(page, pageSize, filters, sortField, sortOrder)
      },
    })

  // 加载列表
  async function loadList(
    page: number = pagination.current,
    pageSize: number = pagination.pageSize,
    queryFilters: SearchValues = filters,
    nextSortField?: string | null,
    nextSortOrder?: 'ascend' | 'descend' | null,
  ) {
    setLoading(true)
    try {
      const params: ContentAuthQueryParams = {
        page,
        page_size: pageSize,
        ...queryFilters,
        sort_by: nextSortField ?? undefined,
        sort_order: nextSortOrder === 'ascend' ? 'asc' : nextSortOrder === 'descend' ? 'desc' : undefined,
      }
      const res = await getAuthContents(params)
      setList(res.items)
      updatePagination(res)
    } catch (err) {
      // API 未就绪，展示空数据
      setList([])
    } finally {
      setLoading(false)
    }
  }

  // 加载角色和用户选项
  async function loadOptions() {
    try {
      const [roles, users, ingestStatuses] = await Promise.all([
        getAuthRoles(),
        getAuthUsers(),
        getDictChildren('Ingest_Status'),
      ])
      setRoleOptions(roles)
      setUserOptions(users)
      setIngestStatusOptions(ingestStatuses.map((item) => ({ label: item.name, value: item.code })))
    } catch (err) {
      setRoleOptions([])
      setUserOptions([])
      setIngestStatusOptions([])
    }
  }

  useEffect(() => {
    void loadList()
    void loadOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 打开授权弹框（单条）
  const openAuthorizeModal = (record: ContentAuthListItem) => {
    setModalMode('single')
    setCurrentRecord(record)
    authorizeForm.setFieldsValue({
      role_ids: record.authorized_roles.map((r) => r.id),
      user_ids: record.authorized_users.map((u) => u.id),
    })
    setModalOpen(true)
  }

  // 打开授权弹框（批量）
  const openBatchAuthorizeModal = () => {
    if (selectedIds.length === 0) {
      message.warning(t('system.dataAuth.msg.selectFirst'))
      return
    }
    setModalMode('batch')
    setCurrentRecord(null)
    authorizeForm.resetFields()
    setModalOpen(true)
  }

  // 确认授权
  const handleAuthorize = async () => {
    // 角色和用户均可不选（代表不绑定），无需 validateFields
    const values = authorizeForm.getFieldsValue()
    const roleIds = values.role_ids?.length ? values.role_ids : null
    const userIds = values.user_ids?.length ? values.user_ids : null
    const contentIds = modalMode === 'single' && currentRecord ? [currentRecord.id] : selectedIds

    if (modalMode === 'batch') {
      Modal.confirm({
        title: t('system.dataAuth.confirm.batchOverwrite'),
        content: t('system.dataAuth.confirm.batchOverwriteDesc'),
        onOk: async () => {
          setSubmitting(true)
          try {
            await batchAuthorize({
              content_ids: contentIds,
              role_ids: roleIds,
              user_ids: userIds,
            })
            message.success(t('system.dataAuth.msg.batchAuthorized'))
            setModalOpen(false)
            void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
          } catch (err) {
            if (isHandledError(err)) return
            message.error(t('system.dataAuth.msg.authorizeFailed'))
          } finally {
            setSubmitting(false)
          }
        },
      })
    } else {
      setSubmitting(true)
      try {
        await batchAuthorize({
          content_ids: contentIds,
          role_ids: roleIds,
          user_ids: userIds,
        })
        message.success(t('system.dataAuth.msg.authorized'))
        setModalOpen(false)
        void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
      } catch (err) {
        // error handled by axios interceptor
      } finally {
        setSubmitting(false)
      }
    }
  }

  // 清除授权
  const handleClear = async (record: ContentAuthListItem) => {
    try {
      await batchClear({ content_ids: [record.id] })
      message.success(t('system.dataAuth.msg.cleared'))
      void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
    } catch (err) {
      // error handled by axios interceptor
    }
  }

  // 批量清除
  const handleBatchClear = () => {
    if (selectedIds.length === 0) {
      message.warning(t('system.dataAuth.msg.selectFirst'))
      return
    }
    Modal.confirm({
      title: t('system.dataAuth.confirm.batchClear'),
      content: t('system.dataAuth.confirm.batchClearDesc'),
      onOk: async () => {
        try {
          await batchClear({ content_ids: selectedIds })
          message.success(t('system.dataAuth.msg.batchCleared'))
          setSelectedIds([])
          void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
        } catch (err) {
          // error handled by axios interceptor
        }
      },
    })
  }

  const columns: ColumnsType<ContentAuthListItem> = [
    {
      title: t('system.dataAuth.col.contentName'),
      dataIndex: 'content_name',
      key: 'content_name',
      sorter: true,
      sortOrder: sortField === 'content_name' ? sortOrder : null,
    },
    {
      title: t('system.dataAuth.col.contentType'),
      dataIndex: 'content_type',
      key: 'content_type',
      width: 180,
      sorter: true,
      sortOrder: sortField === 'content_type' ? sortOrder : null,
    },
    {
      title: t('system.dataAuth.col.ingestStatus'),
      dataIndex: 'ingest_status',
      key: 'ingest_status',
      width: 180,
      sorter: true,
      sortOrder: sortField === 'ingest_status' ? sortOrder : null,
    },
    {
      title: t('system.dataAuth.col.authorizedRoles'),
      dataIndex: 'authorized_roles',
      key: 'authorized_roles',
      width: 300,
      render: (roles: ContentAuthListItem['authorized_roles']) => (
        <Space size={[0, 4]} wrap>
          {roles.map((role) => (
            <Tag key={role.id} color="blue">
              {role.name}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t('system.dataAuth.col.authorizedUsers'),
      dataIndex: 'authorized_users',
      key: 'authorized_users',
      width: 300,
      render: (users: ContentAuthListItem['authorized_users']) => (
        <Space size={[0, 4]} wrap>
          {users.map((user) => (
            <Tag key={user.id} color="green">
              {user.display_name}（{user.username}）
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 140,
      render: (_, record) => (
        <Space size={0}>
          {canOperate && (
            <Tooltip title={t('system.dataAuth.btn.authorize')}>
              <Button
                type="link"
                size="small"
                icon={<TeamOutlined />}
                onClick={() => openAuthorizeModal(record)}
              />
            </Tooltip>
          )}
          {canOperate && (
            <Popconfirm
              title={t('system.dataAuth.confirm.clear')}
              onConfirm={() => void handleClear(record)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Tooltip title={t('system.dataAuth.btn.clear')}>
                <Button type="link" size="small" icon={<ClearOutlined />} danger />
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

      {/* 工具栏 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
        {canOperate && (
          <Button onClick={openBatchAuthorizeModal}>
            {t('system.dataAuth.btn.batchAuthorize')}
          </Button>
        )}
        {canOperate && (
          <Button danger onClick={handleBatchClear}>
            {t('system.dataAuth.btn.batchClear')}
          </Button>
        )}
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={list}
        loading={loading}
        pagination={tablePaginationProps}
        onChange={handleTableChange}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as number[]),
        }}
        scroll={{ x: 1000 }}
        size="small"
      />

      <Modal
        title={t('system.dataAuth.modal.authorizeTitle')}
        open={modalOpen}
        onOk={handleAuthorize}
        onCancel={() => setModalOpen(false)}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={authorizeForm} layout="vertical">
          <Form.Item name="role_ids" label={t('system.dataAuth.form.authorizeToRole')}>
            <Select
              showSearch
              optionFilterProp="label"
              mode="multiple"
              placeholder={t('system.dataAuth.form.authorizeToRolePlaceholder')}
              options={roleOptions.map((r) => ({ label: r.name, value: r.id }))}
              allowClear
            />
          </Form.Item>
          <Form.Item name="user_ids" label={t('system.dataAuth.form.authorizeToUser')}>
            <Select
              showSearch
              optionFilterProp="label"
              mode="multiple"
              placeholder={t('system.dataAuth.form.authorizeToUserPlaceholder')}
              options={userOptions.map((u) => ({
                label: `${u.display_name}（${u.username}）`,
                value: u.id,
              }))}
              allowClear
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
