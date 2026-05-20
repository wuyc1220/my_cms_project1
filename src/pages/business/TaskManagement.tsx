import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Button,
  Form,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { InfoCircleOutlined, UserAddOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  assignTask,
  batchAssignTasks,
  getTasks,
} from '../../api/tasks'
import { getAuthUsers } from '../../api/dataAuth'
import SearchForm from '../../components/SearchForm'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'
import type { TaskListItem, TaskQueryParams } from '../../types/task'
import type { SearchFieldConfig } from '../../types/searchForm'
import type { UserSimpleItem } from '../../types/dataAuth'

// ─── 辅助函数 ─────────────────────────────────────────────────────────

const statusToI18nKey = (status: string): string => {
  const map: Record<string, string> = {
    'Not Assigned': 'task.status.notAssigned',
    'Pending': 'task.status.pending',
    'Completed': 'task.status.completed',
    'Rejected': 'task.status.rejected',
  }
  return map[status] ?? status
}

const getStatusTag = (status: string, translate: (key: string) => string) => {
  const color = status === 'Completed' ? 'success' : status === 'Pending' ? 'processing' : status === 'Rejected' ? 'error' : 'default'
  return <Tag color={color}>{translate(statusToI18nKey(status))}</Tag>
}

const TASK_TYPE_OPTIONS = [
  { label: 'arrangement', value: 'arrangement' },
  { label: 'review L1', value: 'review L1' },
  { label: 'review L2', value: 'review L2' },
  { label: 'review L3', value: 'review L3' },
]

const TASK_STATUS_OPTIONS = [
  { label: 'task.status.notAssigned', value: 'Not Assigned' },
  { label: 'task.status.pending', value: 'Pending' },
  { label: 'task.status.completed', value: 'Completed' },
  { label: 'task.status.rejected', value: 'Rejected' },
]

const CONTENT_TYPE_OPTIONS = [
  { label: 'MOVIE', value: 'MOVIE' },
  { label: 'EPISODE', value: 'EPISODE' },
  { label: 'SEASON', value: 'SEASON' },
  { label: 'SERIES', value: 'SERIES' },
  { label: 'CHANNEL', value: 'CHANNEL' },
  { label: 'SCHEDULE', value: 'SCHEDULE' },
]

// ─── 主组件 ────────────────────────────────────────────────────────────

interface SearchValues extends Record<string, unknown> {
  task_types?: string[]
  task_statuses?: string[]
  assignee_keyword?: string
  assignee_id?: number
  content_name?: string
  content_types?: string[]
  date_range?: [dayjs.Dayjs, dayjs.Dayjs]
  end_date_range?: [dayjs.Dayjs, dayjs.Dayjs]
}

export default function TaskManagement() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useI18n()

  // 列表状态
  const [list, setList] = useState<TaskListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const { pagination, updatePagination, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      // eslint-disable-next-line react-hooks/immutability
      void loadList(page, pageSize, filters, sortField, sortOrder)
    },
  })

  // 用户下拉选项
  const [userOptions, setUserOptions] = useState<{ label: string; value: number }[]>([])

  // 分配弹框
  const [assignModal, setAssignModal] = useState<{
    open: boolean
    taskIds: number[]
    singleTask: TaskListItem | null
  }>({ open: false, taskIds: [], singleTask: null })
  const [assignForm] = Form.useForm()
  const [assignLoading, setAssignLoading] = useState(false)
  const { hasPermission } = usePermission()
  const canView = hasPermission('menu.business.tasks.view') || hasPermission('menu.business.tasks.operate')
  const canOperate = hasPermission('menu.business.tasks.operate')

  // ─── 搜索字段配置 ─────────────────────────────────────────────────────

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'task_types',
      label: t('task.col.taskType'),
      type: 'multiSelect',
      placeholder: t('common.placeholder.select'),
      options: TASK_TYPE_OPTIONS,
    },
    {
      name: 'task_statuses',
      label: t('task.col.taskStatus'),
      type: 'multiSelect',
      placeholder: t('common.placeholder.select'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      options: TASK_STATUS_OPTIONS.map((o) => ({ ...o, label: t(o.label as any) })),
    },
    {
      name: 'assignee_keyword',
      label: t('task.col.assignee'),
      type: 'input',
      placeholder: t('common.placeholder.keyword'),
    },
    {
      name: 'content_name',
      label: t('task.col.contentName'),
      type: 'input',
      placeholder: t('common.placeholder.keyword'),
    },
    {
      name: 'content_types',
      label: t('task.col.contentType'),
      type: 'multiSelect',
      placeholder: t('common.placeholder.select'),
      options: CONTENT_TYPE_OPTIONS,
    },
    {
      name: 'date_range',
      label: t('task.col.startTime'),
      type: 'dateRange',
    },
    {
      name: 'end_date_range',
      label: t('task.col.endTime'),
      type: 'dateRange',
    },
  ], [t])

  // ─── 使用 useSearchForm Hook ─────────────────────────────────────────────

  const {
    form: searchForm,
    filters,
    setFilters,
    expanded,
    setExpanded,
    showExpand,
    handleSearch,
    handleReset,
  } = useSearchForm<SearchValues>({
    onSearch: (values) => {
      setSelectedIds([])
      resetSort()
      void loadList(1, pagination.pageSize, values, null, null)
    },
    onReset: () => {
      setSelectedIds([])
      resetSort()
      void loadList(1, pagination.pageSize, {}, null, null)
    },
    fieldsCount: searchFields.length,
  })

  // ─── 初始化 ──────────────────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      try {
        const users = await getAuthUsers()
        setUserOptions(
          users.map((u: UserSimpleItem) => ({
            label: u.display_name ? `${u.display_name}（${u.username}）` : u.username,
            value: u.id,
          }))
        )
      } catch (err) {
        setUserOptions([])
      }

      // 处理从看板跳转过来的查询条件
      const stateFilters = (location.state as { filters?: Record<string, unknown> } | null)?.filters
      if (stateFilters) {
        // 设置表单值和 filters 状态
        searchForm.setFieldsValue(stateFilters)
        setFilters(stateFilters as SearchValues)
        // 加载列表
        await loadList(1, 10, stateFilters)
        // 清除 state，避免刷新后仍然生效
        navigate(location.pathname, { replace: true })
      } else {
        await loadList(1, 10, {})
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── 列表加载 ─────────────────────────────────────────────────────────

  const loadList = async (
    page = pagination.current,
    pageSize = pagination.pageSize,
    nextFilters = filters,
    nextSortField?: string | null,
    nextSortOrder?: 'ascend' | 'descend' | null,
  ) => {
    setLoading(true)
    try {
      const dateRange = nextFilters.date_range as [dayjs.Dayjs, dayjs.Dayjs] | undefined
      const endDateRange = nextFilters.end_date_range as [dayjs.Dayjs, dayjs.Dayjs] | undefined
      const params: TaskQueryParams = {
        page,
        page_size: pageSize,
        task_types: nextFilters.task_types as string[] | undefined,
        task_statuses: nextFilters.task_statuses as string[] | undefined,
        assignee_keyword: nextFilters.assignee_keyword as string | undefined,
        assignee_id: nextFilters.assignee_id as number | undefined,
        assignee_is_null: nextFilters.assignee_is_null as boolean | undefined,
        content_name: nextFilters.content_name as string | undefined,
        content_types: nextFilters.content_types as string[] | undefined,
        time_start: dateRange?.[0]?.startOf('day').toISOString(),
        time_end: dateRange?.[1]?.endOf('day').toISOString(),
        end_time_start: endDateRange?.[0]?.toISOString(),
        end_time_end: endDateRange?.[1]?.toISOString(),
        sort_by: nextSortField ?? undefined,
        sort_order: nextSortOrder === 'ascend' ? 'asc' : nextSortOrder === 'descend' ? 'desc' : undefined,
      }
      const data = await getTasks(params)
      setList(data.items)
      updatePagination(data)
    } finally {
      setLoading(false)
    }
  }

  // ─── 分配 ─────────────────────────────────────────────────────────────

  const openAssignModal = (record: TaskListItem) => {
    setAssignModal({ open: true, taskIds: [record.id], singleTask: record })
    assignForm.setFieldsValue({ assignee_id: record.assignee_id ?? undefined, update_childs: false })
  }

  const openBatchAssignModal = () => {
    if (selectedIds.length === 0) {
      void message.warning(t('task.msg.noSelection'), 3)
      return
    }
    setAssignModal({ open: true, taskIds: selectedIds, singleTask: null })
    assignForm.setFieldsValue({ assignee_id: undefined, update_childs: false })
  }

  const closeAssignModal = () => {
    setAssignModal({ open: false, taskIds: [], singleTask: null })
    assignForm.resetFields()
  }

  const handleAssignSubmit = async () => {
    try {
      const values = await assignForm.validateFields()
      setAssignLoading(true)
      if (assignModal.singleTask) {
        await assignTask(assignModal.singleTask.id, {
          assignee_id: values.assignee_id,
          update_childs: values.update_childs,
        })
      } else {
        await batchAssignTasks({
          task_ids: assignModal.taskIds,
          assignee_id: values.assignee_id,
          update_childs: values.update_childs,
        })
      }
      void message.success(t('task.msg.assigned'), 3)
      closeAssignModal()
      if (assignModal.singleTask) {
        setSelectedIds(prev => prev.filter(id => id !== assignModal.singleTask!.id))
      } else {
        setSelectedIds([])
      }
      resetSort()
      void loadList(pagination.current, pagination.pageSize, filters, null, null)
    } finally {
      setAssignLoading(false)
    }
  }

  // ─── 表格列定义 ────────────────────────────────────────────────────────

  const columns: ColumnsType<TaskListItem> = [
    {
      title: t('task.col.contentName'),
      dataIndex: 'content_name',
      key: 'content_name',
      ellipsis: { showTitle: false },
      render: (val: string, record: TaskListItem) => {
        // 根据内容类型跳转到不同的详情页
        const getDetailPath = () => {
          if (record.content_type === 'CHANNEL') {
            return `/live/channels/${record.content_id}?mode=edit`
          }
          if (record.content_type === 'SCHEDULE') {
            return `/live/schedules/${record.content_id}?mode=edit`
          }
          // MOVIE/EPISODE/SERIES/SEASON 使用通用详情页
          // 归档和VOD都通过 /contents/:id 访问，详情页内部会根据 is_archived 区分
          return `/contents/${record.content_id}?mode=edit`
        }
        return <a onClick={() => navigate(getDetailPath())}>{val}</a>
      },
    },
    {
      title: t('common.col.type'),
      dataIndex: 'content_type',
      key: 'content_type',
    },
    {
      title: t('task.col.taskType'),
      dataIndex: 'task_type',
      key: 'task_type',
    },
    {
      title: t('task.col.assignee'),
      dataIndex: 'assignee_name',
      key: 'assignee_name',
      render: (val: string | null) => val || '—',
    },
    {
      title: t('task.col.taskStatus'),
      dataIndex: 'task_status',
      key: 'task_status',
      width: 160,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render: (val: string) => getStatusTag(val, (k) => t(k as any)),
    },
    {
      title: t('task.col.startTime'),
      dataIndex: 'start_time',
      key: 'start_time',
      width: 160,
      render: (val: string | null) => val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: t('task.col.endTime'),
      dataIndex: 'end_time',
      key: 'end_time',
      width: 160,
      render: (val: string | null) => val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space size={0}>
          {canOperate && (
            <Tooltip title={t('task.btn.assign')}>
              <Button
                type="link"
                size="small"
                icon={<UserAddOutlined />}
                disabled={record.task_status === 'Completed'}
                onClick={() => openAssignModal(record)}
              />
            </Tooltip>
          )}
          {canView && (
            <Tooltip title={t('task.btn.detail')}>
              <Button
                type="link"
                size="small"
                icon={<InfoCircleOutlined />}
                onClick={() => navigate(`/business/tasks/${record.id}`)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  // ─── JSX ─────────────────────────────────────────────────────────────

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

        {/* 工具栏 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
          {canOperate && (
            <Button
              type="primary"
              ghost
              disabled={selectedIds.length === 0}
              onClick={openBatchAssignModal}
            >
              {t('task.toolbar.batchAssign')}{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
            </Button>
          )}
        </div>

        <Table<TaskListItem>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={list}
          scroll={{ x: 900 }}
          onChange={handleTableChange}
          rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as number[]) }}
          pagination={tablePaginationProps}
          size="small"
        />

      {/* ── 分配弹框 ──────────────────────────────────────────────── */}
      <Modal
        title={assignModal.singleTask ? t('task.modal.assignTitle') : t('task.modal.batchAssignTitle')}
        open={assignModal.open}
        onOk={() => void handleAssignSubmit()}
        onCancel={closeAssignModal}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        confirmLoading={assignLoading}
        destroyOnClose
      >
        <Form form={assignForm} layout="vertical">
          <Form.Item
            name="assignee_id"
            label={t('task.modal.assignTo')}
            rules={[{ required: true, message: t('task.modal.assignToRequired') }]}
          >
            <Select
              placeholder={t('common.placeholder.select')}
              options={userOptions}
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="update_childs" valuePropName="checked" noStyle>
            <Switch
              style={{ display: (assignModal.singleTask?.has_children || (!assignModal.singleTask && list.some((item) => selectedIds.includes(item.id) && item.has_children))) ? 'inline-flex' : 'none' }}
            />
          </Form.Item>
          {(assignModal.singleTask?.has_children || (!assignModal.singleTask && list.some((item) => selectedIds.includes(item.id) && item.has_children))) && (
            <span style={{ marginLeft: 8 }}>{t('task.modal.updateChilds')}</span>
          )}
        </Form>
      </Modal>
    </div>
  )
}
