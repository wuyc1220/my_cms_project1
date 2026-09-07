import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  DatePicker,
  Dropdown,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  TimePicker,
  Tooltip,
  message,
  Form,
} from 'antd'
import api, { isHandledError } from '../../api'
import {
  CloseCircleOutlined,
  EditOutlined,
  ExportOutlined,
  InfoCircleOutlined,
  MinusCircleOutlined,
  ScheduleOutlined,
  SendOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getPublishes,
  batchPublish,
  batchUnpublish,
  publishNow,
  unpublishNow,
  createPublishPlan,
  updatePublishPlan,
  cancelPublishPlan,
  getIngestHistories,
} from '../../api/publishes'
import { getDictTree } from '../../api/dicts'
import SearchForm from '../../components/SearchForm'
import type {
  PublishListItem,
  PublishPlanCreate,
  IngestHistoryItem,
} from '../../types/publish'
import type { DictNodeListItem } from '../../types/dict'
import type { SearchFieldConfig } from '../../types/searchForm'
import type { MessageKey } from '../../i18n/messages'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'
import { useI18n } from '../../i18n/useI18n'

// ═══════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════

const CONTENT_TYPES = [
  { label: 'MOVIE', value: 'MOVIE' },
  { label: 'SEASON', value: 'SEASON' },
  { label: 'SEASON_SERIES', value: 'SEASON_SERIES' },
  { label: 'SERIES', value: 'SERIES' },
  { label: 'SCHEDULE', value: 'SCHEDULE' },
  { label: 'CHANNEL', value: 'CHANNEL' },
  { label: 'EPISODE', value: 'EPISODE' },
]

// ═══════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════

const getPublishStatusTag = (status: string, taskType?: string, scheduledTime?: string, t?: (key: MessageKey) => string) => {
  if (status === 'none') return <Tag>{t ? t('publish.status.none') : 'None'}</Tag>
  if (status === 'plan') {
    const timeStr = scheduledTime ? dayjs(scheduledTime).format('YYYY-MM-DD HH:mm') : ''
    const planKey = taskType === 'unpublish' ? 'publish.plan.unpublish' : 'publish.plan.publish'
    const planLabel = t ? t(planKey) : (taskType === 'unpublish' ? 'Unpublish Plan' : 'Publish Plan')
    if (timeStr) {
      return <Tag color="blue">{planLabel}: {timeStr}</Tag>
    }
    return <Tag color="blue">{planLabel}</Tag>
  }
  if (status === 'publishing') return <Tag color="processing">{t ? t('publish.status.publishing') : 'Publishing'}</Tag>
  if (status === 'success') return <Tag color="success">{t ? t('publish.status.success') : 'Published'}</Tag>
  if (status === 'failure') return <Tag color="error">{t ? t('publish.status.failure') : 'Failed'}</Tag>
  if (status === 'closed') return <Tag>{t ? t('publish.status.closed') : 'Closed'}</Tag>
  return <Tag>{status}</Tag>
}

const getIngestStatusTag = (status?: string, t?: (key: MessageKey) => string) => {
  if (!status) return <Tag>{t ? t('publish.ingestStatus.none') : 'None'}</Tag>
  if (status === 'success') return <Tag color="success">{t ? t('publish.ingestStatus.success') : 'Success'}</Tag>
  if (status === 'failure') return <Tag color="error">{t ? t('publish.ingestStatus.failure') : 'Failure'}</Tag>
  if (status === 'publishing') return <Tag color="processing">{t ? t('publish.ingestStatus.publishing') : 'Publishing'}</Tag>
  return <Tag>{status}</Tag>
}

const getContentTypeLabel = (type?: string, t?: (key: MessageKey) => string) => {
  if (t && type) {
    const key = `publish.contentType.${type}` as MessageKey
    const translated = t(key)
    if (translated !== key) return translated
  }
  return type || '-'
}

// ═══════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════

interface SearchValues extends Record<string, unknown> {
  content_name?: string
  content_types?: string[]
  ingest_statuses?: string[]
  publish_statuses?: string[]
  publish_time_range?: [dayjs.Dayjs, dayjs.Dayjs]
  unpublish_time_range?: [dayjs.Dayjs, dayjs.Dayjs]
}

export default function PublishManagement() {
  const { t } = useI18n()
  const navigate = useNavigate()
  // 列表状态
  const [list, setList] = useState<PublishListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filters, sortField, sortOrder)
    },
  })

  // 下拉选项
  const [ingestStatusOptions, setIngestStatusOptions] = useState<{ label: string; value: string }[]>([])
  const publishStatusOptions = useMemo<{ label: string; value: string }[]>(() => [
    { label: t('publish.status.none'), value: 'none' },
    { label: t('publish.status.plan'), value: 'plan' },
    { label: t('publish.status.publishing'), value: 'publishing' },
    { label: t('publish.status.success'), value: 'success' },
    { label: t('publish.status.failure'), value: 'failure' },
    { label: t('publish.status.closed'), value: 'closed' },
  ], [t])

  // 弹框状态
  const [planModal, setPlanModal] = useState<{
    open: boolean
    type: 'publish' | 'unpublish'
    mode: 'create' | 'edit'
    record?: PublishListItem
    isBatch: boolean
  }>({ open: false, type: 'publish', mode: 'create', isBatch: false })

  const [historyModal, setHistoryModal] = useState<{
    open: boolean
    record?: PublishListItem
  }>({ open: false })

  const [historyList, setHistoryList] = useState<IngestHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPagination, setHistoryPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  const [planForm] = Form.useForm()
  const { hasPermission } = usePermission()
  const canView = hasPermission('menu.business.publishes.view') || hasPermission('menu.business.publishes.operate')
  const canOperate = hasPermission('menu.business.publishes.operate')

  // ═══════════════════════════════════════════════════════════
  // 搜索字段配置
  // ═══════════════════════════════════════════════════════════

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'content_name',
      label: t('publish.col.contentName'),
      type: 'input',
      placeholder: `${t('common.input')} ${t('publish.col.contentName')}`,
    },
    {
      name: 'content_types',
      label: t('publish.col.contentType'),
      type: 'multiSelect',
      placeholder: `${t('common.select')} ${t('publish.col.contentType')}`,
      options: CONTENT_TYPES,
    },
    {
      name: 'ingest_statuses',
      label: t('publish.col.ingestStatus'),
      type: 'multiSelect',
      placeholder: `${t('common.select')} ${t('publish.col.ingestStatus')}`,
      options: ingestStatusOptions,
    },
    {
      name: 'publish_statuses',
      label: t('publish.col.publishStatus'),
      type: 'multiSelect',
      placeholder: `${t('common.select')} ${t('publish.col.publishStatus')}`,
      options: publishStatusOptions,
    },
    {
      name: 'publish_time_range',
      label: t('publish.col.publishTime'),
      type: 'dateRange',
      placeholder: [t('common.startTime'), t('common.endTime')],
    },
    {
      name: 'unpublish_time_range',
      label: t('publish.col.unpublishTime'),
      type: 'dateRange',
      placeholder: [t('common.startTime'), t('common.endTime')],
    },
  ], [ingestStatusOptions, publishStatusOptions, t])

  // ═══════════════════════════════════════════════════════════
  // 使用 useSearchForm Hook
  // ═══════════════════════════════════════════════════════════

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
      resetSort()
      void loadList(1, pagination.pageSize, values)
    },
    onReset: () => {
      setSelectedIds([])
      resetSort()
      void loadList(1, pagination.pageSize, {})
    },
    fieldsCount: searchFields.length,
  })

  // ═══════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    void (async () => {
      const dicts = await getDictTree()

      // Ingest 状态选项
      const ingestStatusRoot = dicts.find((d: DictNodeListItem) => d.code === 'Ingest_Status')
      setIngestStatusOptions((ingestStatusRoot?.children ?? []).map((c: DictNodeListItem) => ({ 
        label: c.name, 
        value: c.code 
      })))

      await loadList(1, 10, {})
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ═══════════════════════════════════════════════════════════
  // 加载列表数据
  // ═══════════════════════════════════════════════════════════

  const loadList = async (
    page: number,
    pageSize: number,
    searchFilters: SearchValues,
    nextSortField?: string | null,
    nextSortOrder?: 'ascend' | 'descend' | null,
  ) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        page,
        page_size: pageSize,
      }

      if (searchFilters.content_name) {
        params.content_name = searchFilters.content_name
      }
      if (searchFilters.content_types?.length) {
        params.content_types = searchFilters.content_types
      }
      if (searchFilters.ingest_statuses?.length) {
        params.ingest_statuses = searchFilters.ingest_statuses
      }
      if (searchFilters.publish_statuses?.length) {
        params.publish_statuses = searchFilters.publish_statuses
      }
      if (searchFilters.publish_time_range?.[0]) {
        params.publish_time_from = searchFilters.publish_time_range[0].startOf('day').format('YYYY-MM-DD HH:mm:ss')
        params.publish_time_to = searchFilters.publish_time_range[1].endOf('day').format('YYYY-MM-DD HH:mm:ss')
      }
      if (searchFilters.unpublish_time_range?.[0]) {
        params.unpublish_time_from = searchFilters.unpublish_time_range[0].startOf('day').format('YYYY-MM-DD HH:mm:ss')
        params.unpublish_time_to = searchFilters.unpublish_time_range[1].endOf('day').format('YYYY-MM-DD HH:mm:ss')
      }
      if (nextSortField) {
        params.sort_by = nextSortField
        params.sort_order = nextSortOrder === 'ascend' ? 'asc' : 'desc'
      }

      const res = await getPublishes(params)
      setList(res.items)
      updatePagination({ total: res.total, page, page_size: pageSize })
    } finally {
      setLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 表格列定义
  // ═══════════════════════════════════════════════════════════

  const columns: ColumnsType<PublishListItem> = [
    {
      title: t('publish.col.contentName'),
      dataIndex: 'entity_name',
      key: 'entity_name',
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'entity_name' ? sortOrder : null,
      render: (text, record) => {
        if (!text) return '-'
        const getContentPath = () => {
          const { entity_type, entity_id, content_type } = record
          if (entity_type === 'Content') {
            // 根据 content_type 判断具体跳转路径
            if (content_type === 'SCHEDULE') {
              return `/live/schedules/${entity_id}?mode=edit`
            }
            // 其他类型默认跳转到 VOD 详情页
            return `/contents/${entity_id}?mode=edit`
          }
          if (entity_type === 'Channel') {
            return `/live/channels/${entity_id}?mode=edit`
          }
          if (entity_type === 'Schedule') {
            return `/live/schedules/${entity_id}?mode=edit`
          }
          return null
        }
        const path = getContentPath()
        if (path) {
          return (
            <Tooltip title={text} autoAdjustOverflow={false} placement="topLeft">
              <span
                style={{ color: '#1677ff', cursor: 'pointer' }}
                onClick={() => navigate(path)}
              >
                {text}
              </span>
            </Tooltip>
          )
        }
        return (
          <Tooltip title={text} autoAdjustOverflow={false} placement="topLeft">
            <span>{text}</span>
          </Tooltip>
        )
      },
    },
    {
      title: t('publish.col.contentType'),
      dataIndex: 'content_type',
      key: 'content_type',
      sorter: true,
      sortOrder: sortField === 'content_type' ? sortOrder : null,
      render: (type) => getContentTypeLabel(type, t),
    },
    {
      title: t('publish.col.ingestStatus'),
      dataIndex: 'ingest_status',
      key: 'ingest_status',
      sorter: true,
      sortOrder: sortField === 'ingest_status' ? sortOrder : null,
      render: (status) => getIngestStatusTag(status, t),
    },
    {
      title: t('publish.col.publishStatus'),
      dataIndex: 'publish_status',
      key: 'publish_status',
      width: 200,
      sorter: true,
      sortOrder: sortField === 'publish_status' ? sortOrder : null,
      ellipsis: { showTitle: false },
      render: (status, record) => {
        const tag = getPublishStatusTag(status, record.task_type, record.scheduled_time, t)
        return <Tooltip title={tag.props.children}>{tag}</Tooltip>
      },
    },
    {
      title: t('publish.col.publishTime'),
      dataIndex: 'publish_time',
      key: 'publish_time',
      sorter: true,
      sortOrder: sortField === 'publish_time' ? sortOrder : null,
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: t('publish.col.unpublishTime'),
      dataIndex: 'unpublish_time',
      key: 'unpublish_time',
      sorter: true,
      sortOrder: sortField === 'unpublish_time' ? sortOrder : null,
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: t('publish.col.action'),
      key: 'action',
      width: 240,
      fixed: 'right',
      render: (_, record) => {
        const { publish_status } = record
        const isNone = publish_status === 'none'
        const isSuccess = publish_status === 'success'
        const isPlan = publish_status === 'plan'
        const isClosed = publish_status === 'closed'
        const isFailure = publish_status === 'failure'

        return (
          <Space size={0}>
            {canView && (
              <Tooltip title={t('publish.tooltip.viewHistory')}>
                <Button
                  type="link"
                  size="small"
                  icon={<InfoCircleOutlined />}
                  onClick={() => handleViewHistory(record)}
                />
              </Tooltip>
            )}

            {canOperate && (isNone || isClosed || isFailure || isSuccess) && (
              <Tooltip title={t('publish.tooltip.publishNow')}>
                <Button
                  type="link"
                  size="small"
                  icon={<SendOutlined />}
                  onClick={() => handlePublishNow(record)}
                />
              </Tooltip>
            )}

            {canOperate && (isNone || isClosed || isFailure || isSuccess) && (
              <Tooltip title={t('publish.tooltip.setPublishPlan')}>
                <Button
                  type="link"
                  size="small"
                  icon={<ScheduleOutlined />}
                  onClick={() => handleOpenPlanModal('publish', 'create', record)}
                />
              </Tooltip>
            )}

            {canOperate && isPlan && record.execution_mode === 'plan' && (
              <>
                <Tooltip title={t('publish.tooltip.publishNow')}>
                  <Button
                    type="link"
                    size="small"
                    icon={<SendOutlined />}
                    onClick={() => handlePublishNow(record)}
                  />
                </Tooltip>
                <Tooltip title={t('publish.tooltip.editPlan')}>
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleOpenPlanModal('publish', 'edit', record)}
                  />
                </Tooltip>
                <Tooltip title={t('publish.tooltip.cancelPlan')}>
                  <Button
                    type="link"
                    size="small"
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => handleCancelPlan(record)}
                  />
                </Tooltip>
              </>
            )}

            {canOperate && isSuccess && (
              <Tooltip title={t('publish.tooltip.unpublishNow')}>
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<ExportOutlined />}
                  onClick={() => handleUnpublishNow(record)}
                />
              </Tooltip>
            )}

            {canOperate && isSuccess && (
              <Tooltip title={t('publish.tooltip.setUnpublishPlan')}>
                <Button
                  type="link"
                  size="small"
                  icon={<ScheduleOutlined />}
                  onClick={() => handleOpenPlanModal('unpublish', 'create', record)}
                />
              </Tooltip>
            )}
          </Space>
        )
      },
    },
  ]

  // ═══════════════════════════════════════════════════════════
  // 事件处理
  // ═══════════════════════════════════════════════════════════

  const handleViewHistory = async (record: PublishListItem) => {
    setHistoryModal({ open: true, record })
    await loadHistory(record, 1, 10)
  }

  const loadHistory = async (record: PublishListItem, page: number, pageSize: number) => {
    setHistoryLoading(true)
    try {
      const res = await getIngestHistories(record.entity_type, record.entity_id, {
        page,
        page_size: pageSize,
      })
      setHistoryList(res.items)
      setHistoryPagination({ current: page, pageSize, total: res.total })
    } finally {
      setHistoryLoading(false)
    }
  }

  const handlePublishNow = async (record: PublishListItem) => {
    try {
      await publishNow(record.entity_type, record.entity_id)
      message.success(t('publish.msg.publishTaskCreated'))
      void loadList(pagination.current, pagination.pageSize, filters)
    } catch (error) {
      // 错误已在拦截器中处理
    }
  }

  const handleUnpublishNow = async (record: PublishListItem) => {
    try {
      await unpublishNow(record.entity_type, record.entity_id)
      message.success(t('publish.msg.unpublishTaskCreated'))
      void loadList(pagination.current, pagination.pageSize, filters)
    } catch (error) {
      // 错误已在拦截器中处理
    }
  }

  const handleOpenPlanModal = (
    type: 'publish' | 'unpublish',
    mode: 'create' | 'edit',
    record?: PublishListItem,
    isBatch = false
  ) => {
    setPlanModal({ open: true, type, mode, record, isBatch })

    if (mode === 'edit' && record) {
      const isPlanMode = record.execution_mode === 'plan'
      planForm.setFieldsValue({
        is_plan: isPlanMode,
        publish_date: isPlanMode && record.scheduled_time ? dayjs(record.scheduled_time) : null,
        publish_time: isPlanMode && record.scheduled_time ? dayjs(record.scheduled_time) : null,
      })
    } else {
      planForm.resetFields()
      planForm.setFieldsValue({
        is_plan: false,
      })
    }
  }

  const handlePlanSubmit = async () => {
    try {
      const values = await planForm.validateFields()

      const isPlanMode = values.is_plan
      let scheduledTime: string | undefined = undefined
      if (isPlanMode && values.publish_date && values.publish_time) {
        const d = dayjs(values.publish_date)
        const tm = dayjs(values.publish_time)
        scheduledTime = d
          .hour(tm.hour())
          .minute(tm.minute())
          .second(0)
          .format('YYYY-MM-DD HH:mm:ss')
      }

      const data: PublishPlanCreate = {
        task_type: planModal.type,
        execution_mode: isPlanMode ? 'plan' : 'now',
        scheduled_time: scheduledTime,
        content_type: planModal.record?.content_type,
        // 发布管理入口：级联发布忽略子内容状态，只要在发布任务表里都再次发布
        cascade_ignore_status: true,
      }

      if (planModal.isBatch) {
        // 批量操作：selectedIds 是表格 rowKey（PublishTask.id），需映射为内容 entity_id
        const entityIds = selectedIds
          .map((id) => list.find((item) => item.id === id)?.entity_id)
          .filter((eid): eid is number => eid !== undefined)
        if (entityIds.length === 0) {
          message.warning(t('publish.msg.selectContentFirst'))
          return
        }

        const batchData: {
          entity_ids: number[]
          entity_type: string
          task_type: 'publish' | 'unpublish'
          execution_mode: 'now' | 'plan'
          scheduled_time: string | undefined
          cascade_ignore_status: boolean
        } = {
          entity_ids: entityIds,
          entity_type: 'Content',
          task_type: planModal.type,
          execution_mode: isPlanMode ? 'plan' : 'now',
          scheduled_time: scheduledTime,
          // 发布管理入口：级联发布忽略子内容状态
          cascade_ignore_status: true,
        }

        const batchResults = planModal.type === 'publish'
          ? await batchPublish(batchData)
          : await batchUnpublish(batchData)
        const failedItems = batchResults.filter((r) => !r.success)
        if (failedItems.length === 0) {
          message.success(t('publish.msg.batchPlanCreated', { type: planModal.type === 'publish' ? t('publish.type.publish') : t('publish.type.unpublish') }))
        } else {
          const failedNames = failedItems.map((r) => r.entity_name || `#${r.entity_id}`).join(', ')
          message.error(`${failedItems.length}/${batchResults.length} ${t('publish.msg.batchFailed')}: ${failedNames}`)
        }
        setSelectedIds([])
      } else if (planModal.mode === 'edit' && planModal.record) {
        // 修改计划
        await updatePublishPlan(planModal.record.id, {
          execution_mode: isPlanMode ? 'plan' : 'now',
          scheduled_time: scheduledTime ?? undefined,
        })
        message.success(t('publish.msg.planModified'))
      } else if (planModal.record) {
        // 新建计划
        await createPublishPlan(planModal.record.entity_type, planModal.record.entity_id, data)
        message.success(t('publish.msg.planCreated'))
      }

      setPlanModal({ ...planModal, open: false })
      void loadList(pagination.current, pagination.pageSize, filters)
    } catch (error) {
      // 错误已在拦截器中处理
    }
  }

  const handleCancelPlan = async (record: PublishListItem) => {
    try {
      await cancelPublishPlan(record.id)
      message.success(t('publish.msg.planCancelled'))
      void loadList(pagination.current, pagination.pageSize, filters)
    } catch (error) {
      // 错误已在拦截器中处理
    }
  }

  const handleBatchPublish = () => {
    if (selectedIds.length === 0) {
      message.warning(t('publish.msg.selectPublishContentFirst'))
      return
    }
    // 与单行发布保持一致：前端不拦截 publish_status，由后端统一校验
    handleOpenPlanModal('publish', 'create', undefined, true)
  }

  const handleBatchUnpublish = () => {
    if (selectedIds.length === 0) {
      message.warning(t('publish.msg.selectUnpublishContentFirst'))
      return
    }
    // 与单行下架保持一致：前端不拦截 ingest_status，由后端统一校验
    handleOpenPlanModal('unpublish', 'create', undefined, true)
  }

  // ═══════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="main-container">
      {/* 搜索表单 */}
      <SearchForm
        form={searchForm}
        fields={searchFields}
        expanded={expanded}
        onExpandChange={setExpanded}
        showExpand={showExpand}
        onSearch={handleSearch}
        onReset={handleReset}
        loading={loading}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
          {canOperate && (
            <Button type="primary" icon={<SendOutlined />} onClick={handleBatchPublish} disabled={selectedIds.length === 0}>
              {t('publish.btn.batchPublish')}
            </Button>
          )}
          {canOperate && (
            <Button danger icon={<MinusCircleOutlined />} onClick={handleBatchUnpublish} disabled={selectedIds.length === 0}>
              {t('publish.btn.batchUnpublish')}
            </Button>
          )}
      </div>

      {/* 数据表格 */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={list}
        loading={loading}
        pagination={tablePaginationProps}
        onChange={handleTableChange}
        rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as number[]) }}
        scroll={{ x: 1200 }}
        size="small"
      />

      {/* 发布/下架计划弹框 */}
      <Modal
        title={planModal.isBatch
          ? t('publish.modal.batchTitle', { type: planModal.type === 'publish' ? t('publish.type.publish') : t('publish.type.unpublish') })
          : planModal.mode === 'edit'
          ? t('publish.modal.editTitle', { type: planModal.type === 'publish' ? t('publish.type.publish') : t('publish.type.unpublish') })
          : t('publish.modal.createTitle', { type: planModal.type === 'publish' ? t('publish.type.publish') : t('publish.type.unpublish') })
        }
        open={planModal.open}
        onOk={handlePlanSubmit}
        onCancel={() => setPlanModal({ ...planModal, open: false })}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
      >
        <Form form={planForm} layout="vertical">
          <Form.Item
            name="is_plan"
            label={t('publish.form.nowOrPlan')}
            initialValue={false}
          >
            <Switch
              checkedChildren="✓"
              unCheckedChildren="✕"
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.is_plan !== curr.is_plan}
          >
            {({ getFieldValue }) => {
              const isPlanChecked = getFieldValue('is_plan')
              return isPlanChecked ? (
                <>
                  <Form.Item
                    name="publish_date"
                    label={t('publish.form.date')}
                    rules={[{ required: true, message: t('publish.rule.dateRequired') }]}
                  >
                    <DatePicker
                      style={{ width: '100%' }}
                      placeholder=""
                      disabledDate={(current) => current && current < dayjs().startOf('day')}
                    />
                  </Form.Item>

                  <Form.Item
                    name="publish_time"
                    label={t('publish.form.time')}
                    rules={[{ required: true, message: t('publish.rule.timeRequired') }]}
                  >
                    <TimePicker
                      style={{ width: '100%' }}
                      format="HH:mm"
                      placeholder=""
                      disabledTime={(_current) => {
                        const selectedDate = getFieldValue('publish_date')
                        if (selectedDate && dayjs(selectedDate).isSame(dayjs(), 'day')) {
                          const now = dayjs()
                          return {
                            disabledHours: () => [...Array(now.hour()).keys()],
                            disabledMinutes: (hour) => hour === now.hour() ? [...Array(now.minute()).keys()] : [],
                          }
                        }
                        return {}
                      }}
                    />
                  </Form.Item>
                </>
              ) : null
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* 注入历史弹框 */}
      <Modal
        title={`${historyModal.record?.entity_name ?? ''} - ${t('publish.ingestHistory.title')}`}
        open={historyModal.open}
        onCancel={() => setHistoryModal({ open: false })}
        width={1000}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {canOperate && (
              <Button onClick={() => {
                if (historyModal.record) void handlePublishNow(historyModal.record)
              }}>
                {t('publish.ingestHistory.btn.reIngest')}
              </Button>
            )}
            <Button type="primary" onClick={() => setHistoryModal({ open: false })}>
              {t('publish.ingestHistory.btn.close')}
            </Button>
          </div>
        }
      >
        <Table
          rowKey="id"
          dataSource={historyList}
          loading={historyLoading}
          size="small"
          pagination={{
            current: historyPagination.current,
            pageSize: historyPagination.pageSize,
            total: historyPagination.total,
            showSizeChanger: true,
            showQuickJumper: true ,
            showTotal: (n: number) => t('pagination.total', { n }),
            onChange: (page, pageSize) => {
              if (historyModal.record) {
                void loadHistory(historyModal.record, page, pageSize)
              }
            },
          }}
          columns={[
            { title: t('publish.ingestHistory.col.type'), dataIndex: 'entity_name', key: 'entity_name' },
            {
              title: t('publish.ingestHistory.col.createDate'),
              dataIndex: 'create_date',
              key: 'create_date',
              render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
            },
            {
              title: t('publish.ingestHistory.col.sendDate'),
              dataIndex: 'send_date',
              key: 'send_date',
              render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
            },
            {
              title: t('publish.ingestHistory.col.endDate'),
              dataIndex: 'end_date',
              key: 'end_date',
              render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
            },
            {
              title: t('publish.ingestHistory.col.status'),
              dataIndex: 'status',
              key: 'status',
              render: (v) => (
                <Tag color={v === 'success' ? 'success' : v === 'failure' ? 'error' : 'default'}>
                  {v === 'success' ? t('publish.ingestHistory.status.success') : v === 'failure' ? t('publish.ingestHistory.status.failure') : v}
                </Tag>
              ),
            },
            {
              title: t('publish.ingestHistory.col.getXml'),
              key: 'getXml',
              align: 'center',
              render: (_, record: IngestHistoryItem) => {
                const handleDownload = async (url: string, filename: string) => {
                  try {
                    // 如果 URL 以 /api/v1 开头，去掉前缀，因为 axios baseURL 已经包含 /api/v1
                    const requestUrl = url.startsWith('/api/v1') ? url.slice(7) : url
                    const response = await api.get(requestUrl, {
                      responseType: 'blob',
                    })
                    const blob = new Blob([response.data])
                    const link = document.createElement('a')
                    link.href = URL.createObjectURL(blob)
                    link.download = filename
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    URL.revokeObjectURL(link.href)
                  } catch (err) {
                    if (!isHandledError(err)) message.error(t('publish.msg.downloadFailed'))
                  }
                }
                const menuItems = []
                if (record.ingest_xml_url) {
                  menuItems.push({
                    key: 'ingest',
                    label: t('publish.ingestHistory.xml.ingest'),
                    onClick: () => {
                      const ingestUrl = record.ingest_xml_url!
                      const urlParams = new URLSearchParams(ingestUrl.split('?')[1])
                      const path = urlParams.get('path') || ''
                      const filename = path.split('/').pop() || 'ingest.xml'
                      void handleDownload(ingestUrl, filename)
                    },
                  })
                }
                if (record.result_xml_url) {
                  menuItems.push({
                    key: 'result',
                    label: t('publish.ingestHistory.xml.result'),
                    onClick: () => {
                      const resultUrl = record.result_xml_url!
                      const urlParams = new URLSearchParams(resultUrl.split('?')[1])
                      const path = urlParams.get('path') || ''
                      const filename = path.split('/').pop() || 'result.xml'
                      void handleDownload(resultUrl, filename)
                    },
                  })
                }
                if (menuItems.length === 0) {
                  return '—'
                }
                return (
                  <Dropdown menu={{ items: menuItems }} placement="bottom" disabled={!canOperate}>
                    <Button type="link" size="small" disabled={!canOperate}>
                      {t('publish.ingestHistory.col.getXml')}
                    </Button>
                  </Dropdown>
                )
              },
            },
          ]}
        />
      </Modal>
    </div>
  )
}
