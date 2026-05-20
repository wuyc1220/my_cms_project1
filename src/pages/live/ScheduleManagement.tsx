/**
 * ScheduleManagement — 直播管理 节目单管理列表页
 *
 * 需求规范（3.5.2.2）：
 *  - 仅展示 Content Type = SCHEDULE 的内容
 *  - 搜索：Channel Name（文本/下拉）/ Program Name / CUTV Enable（多选下拉 YES/NO）/
 *          To Be Archived（快捷统计按钮）/ Begin Time（范围）/ End Time（范围）
 *  - 列表列：Channel Name / Program Name / Ingest Status / Begin Time / End Time /
 *            CUTV Enable / Archived / Action
 *  - 操作按钮：New Schedule / Excel Export / Excel Import / Batch Delete / Batch Publish
 *  - Action：Detail(i) / Edit(铅笔) / Delete(垃圾桶)
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Col,
  DatePicker,
  Form,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  TimePicker,
  Tooltip,
  Upload,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getSchedules, deleteSchedule, exportSchedulesExcel, importSchedulesExcel, archiveSchedule, getChannelsSimple } from '../../api/live'
import { updateContent } from '../../api/contents'
import SearchForm from '../../components/SearchForm'
import PublishPlanModal from '../../components/PublishPlanModal'
import ScheduleCreateModal from '../../components/ScheduleCreateModal'
import type { ScheduleListItem, ScheduleQueryParams } from '../../types/live'
import type { ContentSimpleItem } from '../../types/content'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'
import { isHandledError } from '../../api'

const STATUS_COLOR: Record<string, string> = {
  Published: 'success',
  Processing: 'processing',
  WaitingForMaterials: 'warning',
  Failed: 'error',
  None: 'default',
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function ScheduleManagement() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.live.schedules.operate')

  const [schedules, setSchedules] = useState<ScheduleListItem[]>([])
  const [loading, setLoading] = useState(false)
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filters, sortField, sortOrder)
    },
  })

  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])

  const [channelOptions, setChannelOptions] = useState<ContentSimpleItem[]>([])

  // 待归档数量
  const [toBeArchivedCount, setToBeArchivedCount] = useState(0)
  const [toBeArchivedActive, setToBeArchivedActive] = useState(false)

  // 新增节目单弹框
  const [createModalOpen, setCreateModalOpen] = useState(false)

  // 归档计划弹框
  const [archiveModalOpen, setArchiveModalOpen] = useState(false)
  const [archiveModalLoading, setArchiveModalLoading] = useState(false)
  const [archiveRecord, setArchiveRecord] = useState<ScheduleListItem | null>(null)
  const [archiveForm] = Form.useForm()
  const [archiveIsPlan, setArchiveIsPlan] = useState(false)

  // 批量发布弹框
  const [publishModalOpen, setPublishModalOpen] = useState(false)

  // Excel 导入状态
  const [importing, setImporting] = useState(false)

  // ─── 搜索字段配置 ───────────────────────────────────────────────────────────

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'channel_name',
      labelKey: 'common.col.channelName',
      type: 'select',
      render: () => (
        <Select
          placeholder={t('common.placeholder.selectChannel')}
          options={channelOptions.map((c) => ({ label: c.title, value: c.title }))}
          allowClear
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          style={{ width: '100%' }}
        />
      ),
    },
    {
      name: 'title',
      labelKey: 'common.col.programName',
      type: 'input',
      placeholderKey: 'common.placeholder.programKeyword',
    },
    {
      name: 'cutv_enables',
      labelKey: 'common.col.cutvEnable',
      type: 'multiSelect',
      options: [
        { label: 'YES', value: 'YES' },
        { label: 'NO', value: 'NO' },
      ],
    },
    {
      name: 'begin_range',
      labelKey: 'common.col.beginTime',
      type: 'dateRange',
      showTime: true,
    },
    {
      name: 'end_range',
      labelKey: 'common.col.endTime',
      type: 'dateRange',
      showTime: true,
    },
  ], [channelOptions, t])

  // ─── 使用 useSearchForm Hook ─────────────────────────────────────────────────

  const {
    form: searchForm,
    filters,
    setFilters,
    expanded,
    setExpanded,
    showExpand,
    handleSearch,
    handleReset,
  } = useSearchForm<ScheduleQueryParams>({
    onSearch: (values) => {
      // 将表单字段转换为 API 查询参数
      const params: ScheduleQueryParams = {}
      if (values.channel_name) params.channel_name = values.channel_name
      if (values.title) params.title = values.title
      if (values.cutv_enables?.length) params.cutv_enables = values.cutv_enables
      // begin_range / end_range 是表单日期范围字段，需拆分为 from/to
      const beginRange = (values as Record<string, unknown>).begin_range as [dayjs.Dayjs, dayjs.Dayjs] | undefined
      if (beginRange?.[0]) {
        params.begin_from = beginRange[0].format('YYYY-MM-DD HH:mm')
        params.begin_to = beginRange[1].format('YYYY-MM-DD HH:mm')
      }
      const endRange = (values as Record<string, unknown>).end_range as [dayjs.Dayjs, dayjs.Dayjs] | undefined
      if (endRange?.[0]) {
        params.end_from = endRange[0].format('YYYY-MM-DD HH:mm')
        params.end_to = endRange[1].format('YYYY-MM-DD HH:mm')
      }
      setFilters(params)
      resetSort()
      setSelectedRowKeys([])
      void loadList(1, pagination.pageSize, params, null, null)
    },
    onReset: () => {
      setFilters({})
      setToBeArchivedActive(false)
      resetSort()
      setSelectedRowKeys([])
      void loadList(1, pagination.pageSize, {}, null, null)
    },
    fieldsCount: searchFields.length,
  })

  // ─── 初始化 ────────────────────────────────────────────────────────────────

  const loadToBeArchivedCount = async () => {
    try {
      const res = await getSchedules({ cutv_enable: true, is_archived: false, page: 1, page_size: 1 })
      setToBeArchivedCount(res.total)
    } catch (err) {
      setToBeArchivedCount(0)
    }
  }

  useEffect(() => {
    void getChannelsSimple().then(setChannelOptions).catch(() => {})
    void loadList(1, pagination.pageSize, {})
    void loadToBeArchivedCount()
  }, [])

  const loadList = async (p: number, ps: number, params: ScheduleQueryParams, sortBy?: string | null, sortOrd?: 'ascend' | 'descend' | null) => {
    setLoading(true)
    try {
      const res = await getSchedules({
        ...params,
        page: p,
        page_size: ps,
        sort_by: sortBy ?? undefined,
        sort_order: sortOrd ? (sortOrd === 'ascend' ? 'asc' : 'desc') : undefined,
      })
      setSchedules(res.items)
      updatePagination(res)
    } catch (err) {
    } finally {
      setLoading(false)
    }
  }


  const handleDelete = async (id: number) => {
    try {
      await deleteSchedule(id)
      void message.success(t('live.schedule.msg.deleted'), 3)
      setSelectedRowKeys(prev => prev.filter(key => key !== id))
      void loadList(pagination.current, pagination.pageSize, filters)
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      void message.error(detail ?? t('common.msg.deleteFailed'), 5)
    }
  }

  const handleBatchDelete = async () => {
    if (!selectedRowKeys.length) return
    try {
      await Promise.all(selectedRowKeys.map((id) => deleteSchedule(id)))
      void message.success(t('customField.msg.batchDeleted', { count: selectedRowKeys.length }), 3)
      setSelectedRowKeys([])
      void loadList(1, pagination.pageSize, filters)
    } catch (err) {
    }
  }

  const handleCutvChange = async (record: ScheduleListItem, checked: boolean) => {
    try {
      await updateContent(record.id, { cutv_enable: checked })
      void message.success(t('common.msg.updateSuccess'), 3)
      setSchedules((prev) =>
        prev.map((item) => (item.id === record.id ? { ...item, cutv_enable: checked } : item))
      )
    } catch (err) {
    }
  }

  // Excel 导入流程：首次请求 force=false，若后端返回 conflicts 则弹窗让用户确认覆盖，确认后重调 force=true
  const handleImportFlow = async (f: File, force: boolean) => {
    setImporting(true)
    try {
      const result = await importSchedulesExcel(f, force)
      if (!force && result.conflicts && result.conflicts.length > 0) {
        const preview = result.conflicts
          .slice(0, 5)
          .map((c) => `• ${c.channel_name ?? ''} ${c.begin_time ?? ''} ~ ${c.end_time ?? ''} (${c.title ?? ''})`)
          .join('\n')
        const more = result.conflicts.length > 5 ? `\n...(+${result.conflicts.length - 5})` : ''
        Modal.confirm({
          title: t('live.schedule.msg.importConflictTitle'),
          content: (
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {t('live.schedule.msg.importConflictContent').replace('{n}', String(result.conflicts.length))}
              {'\n'}
              {preview}
              {more}
            </div>
          ),
          okText: t('common.confirm'),
          cancelText: t('common.cancel'),
          okButtonProps: { danger: true },
          onOk: () => handleImportFlow(f, true),
        })
        return
      }
      void message.success(
        `${t('live.schedule.msg.importSuccess')} (total: ${result.total}, created: ${result.created}, updated: ${result.updated})`,
      )
      void loadList(1, pagination.pageSize, filters)
    } catch (err) {
    } finally {
      setImporting(false)
    }
  }

  const handleArchivePlan = async () => {
    if (!archiveRecord) return
    try {
      await archiveForm.validateFields()
      setArchiveModalLoading(true)

      let scheduledTime: string | undefined = undefined
      if (archiveIsPlan) {
        const planDate = archiveForm.getFieldValue('plan_date') as dayjs.Dayjs | undefined
        const planTime = archiveForm.getFieldValue('plan_time') as dayjs.Dayjs | undefined
        if (planDate && planTime) {
          const combined = planDate
            .hour(planTime.hour())
            .minute(planTime.minute())
            .second(0)
            .millisecond(0)
          scheduledTime = combined.toISOString()
        }
      }

      const mode = archiveIsPlan ? 'plan' : 'now'
      const result = await archiveSchedule({
        schedule_id: archiveRecord.id,
        mode,
        scheduled_time: scheduledTime,
      })
      if (result.success) {
        if (mode === 'plan') {
          void message.success(t('live.schedule.msg.archiveScheduled'), 3)
          setSchedules((prev) =>
            prev.map((item) =>
              item.id === archiveRecord.id ? { ...item, archive_scheduled_time: scheduledTime } : item
            )
          )
        } else {
          void message.success(t('live.schedule.msg.archivePlanSaved'), 3)
          setSchedules((prev) =>
            prev.map((item) =>
              item.id === archiveRecord.id ? { ...item, is_archived: true } : item
            )
          )
        }
        setArchiveModalOpen(false)
      } else {
        void message.error(result.message || t('live.schedule.msg.archivePlanSaveFailed'), 5)
      }
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      void message.error(detail || t('live.schedule.msg.archivePlanSaveFailed'), 5)
    } finally {
      setArchiveModalLoading(false)
    }
  }

  // ─── 列定义 ───────────────────────────────────────────────────────────────

  const columns: ColumnsType<ScheduleListItem> = [
    {
      title: t('common.col.channelName'),
      dataIndex: 'channel_name',
      key: 'channel_name',
      width: 160,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'channel_name' ? sortOrder : null,
      render: (v?: string) => <Tooltip title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
    },
    {
      title: t('common.col.programName'),
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'title' ? sortOrder : null,
      render: (v: string, record) => (
        <Tooltip title={v}>
          <a
            onClick={() => {
              sessionStorage.removeItem('schedule_list_context')
              sessionStorage.setItem(
                'schedule_list_context',
                JSON.stringify({ ids: schedules.map((s) => s.id) }),
              )
              navigate(`/live/schedules/${record.id}?mode=view`)
            }}
          >
            {v}
          </a>
        </Tooltip>
      ),
    },
    {
      title: t('common.col.ingestStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 150,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'status' ? sortOrder : null,
      render: (v: string) => (
        <Tooltip title={v}>
          <Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag>
        </Tooltip>
      ),
    },
    {
      title: t('common.col.beginTime'),
      dataIndex: 'begin_time',
      key: 'begin_time',
      width: 160,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'begin_time' ? sortOrder : null,
      render: (v?: string) => {
        const text = v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—'
        return <Tooltip title={text}><span>{text}</span></Tooltip>
      },
    },
    {
      title: t('common.col.endTime'),
      dataIndex: 'end_time',
      key: 'end_time',
      width: 160,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'end_time' ? sortOrder : null,
      render: (v?: string) => {
        const text = v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—'
        return <Tooltip title={text}><span>{text}</span></Tooltip>
      },
    },
    {
      title: t('common.col.cutvEnable'),
      key: 'cutv',
      width: 110,
      render: (_: unknown, record: ScheduleListItem) => (
        <Switch
          size="small"
          checked={record.cutv_enable ?? false}
          onChange={(checked) => void handleCutvChange(record, checked)}
          disabled={!canOperate}
        />
      ),
    },
    {
      title: t('common.col.archived'),
      key: 'archived',
      width: 90,
      render: (_: unknown, record: ScheduleListItem) => {
        if (!record.cutv_enable) {
          return (
            <Tooltip title={t('common.tooltip.cutvDisabledNoArchive')}>
              <CloseCircleOutlined style={{ color: '#faad14', fontSize: 16 }} />
            </Tooltip>
          )
        }
        if (record.is_archived) {
          const clickable = canOperate && !!record.archive_content_id
          return (
            <Tooltip title={t('common.tooltip.archived')}>
              <span
                onClick={() => {
                  if (clickable) {
                    navigate(`/contents/${record.archive_content_id}?mode=view`)
                  }
                }}
              >
                <CheckCircleOutlined
                  style={{ color: '#52c41a', fontSize: 16, cursor: clickable ? 'pointer' : 'default' }}
                />
              </span>
            </Tooltip>
          )
        }
        if (record.archive_scheduled_time) {
          return (
            <Tooltip title={`${t('live.schedule.archivePlan.plan')}: ${dayjs(record.archive_scheduled_time).format('YYYY-MM-DD HH:mm')}`}>
              <ExclamationCircleOutlined
                style={{ color: '#1890ff', fontSize: 16, cursor: canOperate ? 'pointer' : 'not-allowed' }}
                onClick={() => {
                  if (!canOperate) return
                  setArchiveRecord(record)
                  archiveForm.resetFields()
                  setArchiveIsPlan(true)
                  archiveForm.setFieldsValue({
                    is_plan: true,
                    plan_date: dayjs(record.archive_scheduled_time),
                    plan_time: dayjs(record.archive_scheduled_time),
                  })
                  setArchiveModalOpen(true)
                }}
              />
            </Tooltip>
          )
        }
        return (
          <Tooltip title={t('common.tooltip.notArchived')}>
            <ExclamationCircleOutlined
              style={{ color: '#8c8c8c', fontSize: 16, cursor: canOperate ? 'pointer' : 'not-allowed' }}
              onClick={() => {
                if (!canOperate) return
                setArchiveRecord(record)
                archiveForm.resetFields()
                setArchiveIsPlan(false)
                setArchiveModalOpen(true)
              }}
            />
          </Tooltip>
        )
      },
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 110,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title={t('common.detail')}>
            <Button type="link" size="small" icon={<InfoCircleOutlined />}
              onClick={() => {
                sessionStorage.removeItem('schedule_list_context')
                sessionStorage.setItem('schedule_list_context', JSON.stringify({ ids: schedules.map((s) => s.id) }))
                navigate(`/live/schedules/${record.id}?mode=view`)
              }} />
          </Tooltip>
          {canOperate && (
            <Tooltip title={t('common.edit')}>
              <Button type="link" size="small" icon={<EditOutlined />}
                onClick={() => {
                  sessionStorage.removeItem('schedule_list_context')
                  sessionStorage.setItem('schedule_list_context', JSON.stringify({ ids: schedules.map((s) => s.id) }))
                  navigate(`/live/schedules/${record.id}?mode=edit`)
                }} />
            </Tooltip>
          )}
          {canOperate && (
            <Popconfirm
              title={t('live.schedule.confirm.delete')}
              onConfirm={() => void handleDelete(record.id)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Tooltip title={t('common.delete')}>
                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  // ─── 渲染 ─────────────────────────────────────────────────────────────────

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
      {/* 列表区 */}
      {/* 工具栏 */}
      <Row justify="end" style={{ marginBottom: 12 }}>
          <Col>
            <Space>
              {/* 快捷统计按钮 */}
              <Button
                type={toBeArchivedActive ? 'primary' : 'default'}
                onClick={() => {
                  if (toBeArchivedActive) {
                    setToBeArchivedActive(false)
                    setFilters({})
                    resetSort()
                    void loadList(1, pagination.pageSize, {}, null, null)
                  } else {
                    setToBeArchivedActive(true)
                    const params: ScheduleQueryParams = { cutv_enable: true, is_archived: false }
                    setFilters(params)
                    resetSort()
                    void loadList(1, pagination.pageSize, params, null, null)
                  }
                }}
              >
                {t('live.schedule.btn.toBeArchived')} {toBeArchivedCount}
              </Button>
              
              {canOperate && (
                <Popconfirm
                  title={t('live.schedule.confirm.batchDelete').replace('{n}', String(selectedRowKeys.length))}
                  onConfirm={handleBatchDelete}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                >
                  <Button disabled={selectedRowKeys.length === 0}>{t('common.batchDelete')}</Button>
                </Popconfirm>
              )}
              {canOperate && (
                <Button icon={<CheckCircleOutlined />}
                  disabled={selectedRowKeys.length === 0 || !selectedRowKeys.length}
                  onClick={() => {
                    const notReady = selectedRowKeys.some((id) => {
                      const item = schedules.find((s) => s.id === id)
                      return !item || item.status !== 'ReadyForPublish'
                    })
                    if (notReady) {
                      void message.warning(t('live.schedule.msg.notReadyForPublish'))
                      return
                    }
                    setPublishModalOpen(true)
                  }}>
                  {t('common.btn.batchPublish')}
                </Button>
              )}
              <Button icon={<DownloadOutlined />}
                onClick={async () => {
                  try {
                    const blob = await exportSchedulesExcel(selectedRowKeys)
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'schedules.xlsx'
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    window.URL.revokeObjectURL(url)
                    void message.success(t('live.schedule.msg.exportSuccess'))
                  } catch (err) {
                    if (isHandledError(err)) return
                    void message.error(t('live.schedule.msg.importFailed'))
                  }
                }}>
                {t('common.btn.excelExport')}
              </Button>
              {canOperate && (
                <Upload
                  accept=".xlsx,.xls"
                  showUploadList={false}
                  beforeUpload={() => false}
                  onChange={({ file }) => {
                    const f = file.originFileObj as File
                    if (!f) return
                    void handleImportFlow(f, false)
                  }}
                >
                  <Button icon={<UploadOutlined />} loading={importing}>
                    {t('common.btn.excelImport')}
                  </Button>
                </Upload>
              )}
              {canOperate && (
                <Button type="primary" icon={<PlusOutlined />}
                  onClick={() => setCreateModalOpen(true)}>
                  {t('live.schedule.btn.new')}
                </Button>
              )}
            </Space>
          </Col>
        </Row>

        <Table<ScheduleListItem>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={schedules}
          loading={loading}
          scroll={{ x: 1200 }}
          rowSelection={{
            type: 'checkbox',
            fixed: true,
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as number[]),
          }}
          pagination={tablePaginationProps}
          onChange={handleTableChange}
        />

      {/* 新增节目单弹框 */}
      <ScheduleCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false)
          void message.success(t('live.schedule.msg.created'), 3)
          void loadList(1, pagination.pageSize, filters)
        }}
      />

      {/* 归档计划弹框 */}
      <Modal
        title={t('live.schedule.archivePlan.title')}
        open={archiveModalOpen}
        onCancel={() => setArchiveModalOpen(false)}
        destroyOnHidden
        maskClosable={false}
        width={520}
        footer={
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <Button onClick={() => setArchiveModalOpen(false)} disabled={archiveModalLoading} style={{ minWidth: 100 }}>
              {t('live.schedule.archivePlan.cancel')}
            </Button>
            <Button type="primary" onClick={handleArchivePlan} loading={archiveModalLoading} style={{ minWidth: 100 }}>
              {t('live.schedule.archivePlan.confirm')}
            </Button>
          </div>
        }
      >
        <Form
          form={archiveForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          autoComplete="off"
        >
          <Form.Item
            name="is_plan"
            label={t('live.schedule.archivePlan.executionMode')}
            initialValue={false}
          >
            <Switch
              checked={archiveIsPlan}
              onChange={(checked) => {
                setArchiveIsPlan(checked)
                archiveForm.setFieldsValue({ is_plan: checked })
                if (!checked) {
                  archiveForm.setFieldsValue({ plan_date: undefined, plan_time: undefined })
                }
              }}
              checkedChildren={t('live.schedule.archivePlan.plan')}
              unCheckedChildren={t('live.schedule.archivePlan.now')}
            />
          </Form.Item>

          {archiveIsPlan && (
            <>
              <Form.Item
                name="plan_date"
                label={t('live.schedule.archivePlan.scheduledDate')}
                rules={[{ required: true, message: t('live.schedule.archivePlan.dateRequired') }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder=""
                />
              </Form.Item>

              <Form.Item
                name="plan_time"
                label={t('live.schedule.archivePlan.scheduledClock')}
                rules={[{ required: true, message: t('live.schedule.archivePlan.timeRequired') }]}
              >
                <TimePicker
                  style={{ width: '100%' }}
                  format="HH:mm"
                  placeholder=""
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* 批量发布弹框 */}
      <PublishPlanModal
        open={publishModalOpen}
        contentIds={selectedRowKeys}
        onClose={() => setPublishModalOpen(false)}
        onSuccess={() => {
          setSelectedRowKeys([])
          void loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
        }}
      />
    </div>
  )
}
