/**
 * ChannelScheduleTab — 频道详情页节目单 Tab（仅展示当前频道节目单）
 *
 * 功能同节目单管理列表，固定 channel_id 过滤。
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
  Radio,
  Row,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Upload,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
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
import {
  getSchedules,
  deleteSchedule,
  exportSchedulesExcel,
  importSchedulesExcel,
  archiveSchedule,
} from '../../api/live'
import { updateContent } from '../../api/contents'
import SearchForm from '../../components/SearchForm'
import ScheduleCreateModal from '../../components/ScheduleCreateModal'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import type { ScheduleListItem, ScheduleQueryParams } from '../../types/live'
import type { SearchFieldConfig } from '../../types/searchForm'
import { isHandledError } from '../../api'


const STATUS_COLOR: Record<string, string> = {
  Published: 'success',
  Processing: 'processing',
  WaitingForMaterials: 'warning',
  Failed: 'error',
  None: 'default',
}

interface SearchValues extends ScheduleQueryParams {
  begin_range?: [dayjs.Dayjs, dayjs.Dayjs]
  end_range?: [dayjs.Dayjs, dayjs.Dayjs]
}

interface ChannelScheduleTabProps {
  channelId: number
  channelName: string
  mode: 'view' | 'edit'
}

export default function ChannelScheduleTab({ channelId, channelName, mode }: ChannelScheduleTabProps) {
  const { t } = useI18n()
  const navigate = useNavigate()

  const [schedules, setSchedules] = useState<ScheduleListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])

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

  // Excel 导入状态
  const [importing, setImporting] = useState(false)

  // ── 加载函数（定义在 useTablePagination 之前，返回数据供 onChange 更新分页）──
  const loadList = async (
    p: number,
    ps: number,
    params: ScheduleQueryParams,
    sortBy?: string | null,
    sortOrd?: 'ascend' | 'descend' | null
  ) => {
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
      return res
    } catch (err) {
      return null
    } finally {
      setLoading(false)
    }
  }

  const {
    pagination,
    updatePagination,
    sortField,
    sortOrder,
    resetSort,
    tablePaginationProps,
    handleTableChange,
  } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void (async () => {
        const res = await loadList(page, pageSize, filters, sortField, sortOrder)
        if (res) updatePagination(res)
      })()
    },
  })

  // ── 搜索字段配置 ─────────────────────────────────────────────────────────

  const searchFields: SearchFieldConfig[] = useMemo(
    () => [
      {
        name: 'title',
        labelKey: 'common.col.programName',
        type: 'input',
        placeholderKey: 'common.placeholder.programKeyword',
      },
      {
        name: 'cutv_enable',
        labelKey: 'common.col.cutvEnable',
        type: 'select',
        placeholderKey: 'common.placeholder.select',
        options: [
          { label: '是', labelKey: 'common.yes', value: true },
          { label: '否', labelKey: 'common.no', value: false },
        ],
      },
      {
        name: 'begin_range',
        labelKey: 'common.col.beginTime',
        type: 'dateRange',
      },
      {
        name: 'end_range',
        labelKey: 'common.col.endTime',
        type: 'dateRange',
      },
    ],
    []
  )

  // ── 使用 useSearchForm Hook ──────────────────────────────────────────────

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
      const params: ScheduleQueryParams = { channel_id: channelId }
      if (values.title) params.title = values.title
      if (values.cutv_enable !== undefined) params.cutv_enable = values.cutv_enable
      if (values.begin_range?.[0]) {
        params.begin_from = values.begin_range[0].format('YYYY-MM-DD HH:mm')
        params.begin_to = values.begin_range[1].format('YYYY-MM-DD HH:mm')
      }
      if (values.end_range?.[0]) {
        params.end_from = values.end_range[0].format('YYYY-MM-DD HH:mm')
        params.end_to = values.end_range[1].format('YYYY-MM-DD HH:mm')
      }
      setFilters(params)
      resetSort()
      void (async () => {
        const res = await loadList(1, pagination.pageSize, params, null, null)
        if (res) updatePagination(res)
      })()
    },
    onReset: () => {
      setFilters({ channel_id: channelId })
      setToBeArchivedActive(false)
      resetSort()
      void (async () => {
        const res = await loadList(1, pagination.pageSize, { channel_id: channelId }, null, null)
        if (res) updatePagination(res)
      })()
    },
    fieldsCount: searchFields.length,
  })

  // ── 初始化 ──────────────────────────────────────────────────────────────

  const loadToBeArchivedCount = async () => {
    try {
      const res = await getSchedules({
        channel_id: channelId,
        cutv_enable: true,
        is_archived: false,
        page: 1,
        page_size: 1,
      })
      setToBeArchivedCount(res.total)
    } catch (err) {
      setToBeArchivedCount(0)
    }
  }

  useEffect(() => {
    void (async () => {
      const res = await loadList(1, pagination.pageSize, { channel_id: channelId }, null, null)
      if (res) updatePagination(res)
    })()
    void loadToBeArchivedCount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

  // ── 操作处理 ────────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    try {
      await deleteSchedule(id)
      void message.success(t('live.schedule.msg.deleted'), 3)
      setSelectedRowKeys(prev => prev.filter(key => key !== id))
      const res = await loadList(pagination.current, pagination.pageSize, filters, null, null)
      if (res) updatePagination(res)
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      void message.error(detail ?? t('common.msg.deleteFailed'), 5)
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

  const handleArchivePlan = async () => {
    if (!archiveRecord) return
    try {
      await archiveForm.validateFields()
      setArchiveModalLoading(true)
      const mode = (archiveForm.getFieldValue('mode') as 'now' | 'plan') || 'now'
      const scheduledTime = archiveForm.getFieldValue('scheduled_time') as dayjs.Dayjs | undefined
      // 调用归档 API：根据 SeriesType 创建 MOVIE/EPISODE/SERIES/SEASON 归档产物
      const result = await archiveSchedule({
        schedule_id: archiveRecord.id,
        mode,
        scheduled_time:
          mode === 'plan' && scheduledTime ? scheduledTime.toISOString() : undefined,
      })
      if (result.success) {
        void message.success(t('live.schedule.msg.archivePlanSaved'), 3)
        setArchiveModalOpen(false)
        // 重新拉列表以获取最新 archive_content_id / archive_published
        const res = await loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
        if (res) updatePagination(res)
        void loadToBeArchivedCount()
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

  // ── 列定义 ──────────────────────────────────────────────────────────────

  const columns: ColumnsType<ScheduleListItem> = [
    {
      title: t('common.col.channelName'),
      dataIndex: 'channel_name',
      key: 'channel_name',
      width: 160,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'channel_name' ? sortOrder : null,
      render: (v?: string) => (
        <Tooltip title={v ?? '—'}>
          <span>{v ?? '—'}</span>
        </Tooltip>
      ),
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
          <a onClick={() => navigate(`/trade/contents/${record.id}`)}>{v}</a>
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
        return (
          <Tooltip title={text}>
            <span>{text}</span>
          </Tooltip>
        )
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
        return (
          <Tooltip title={text}>
            <span>{text}</span>
          </Tooltip>
        )
      },
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
      title: t('common.col.cutvEnable'),
      key: 'cutv',
      width: 110,
      render: (_: unknown, record: ScheduleListItem) => (
        <Switch
          size="small"
          disabled={mode === 'view'}
          checked={record.cutv_enable ?? false}
          onChange={(checked) => void handleCutvChange(record, checked)}
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
        if (record.is_archived && record.archive_content_id) {
          const isPublished = record.archive_published
          const icon = isPublished ? (
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16, cursor: 'pointer' }} />
          ) : (
            <ClockCircleOutlined style={{ color: '#1677ff', fontSize: 16, cursor: 'pointer' }} />
          )
          const tipKey = isPublished
            ? 'common.tooltip.archivedPublished'
            : 'common.tooltip.archivedInProgress'
          return (
            <Tooltip title={t(tipKey)}>
              <span
                onClick={() => {
                  navigate(`/contents/${record.archive_content_id}?mode=view`)
                }}
              >
                {icon}
              </span>
            </Tooltip>
          )
        }
        if (record.is_archived) {
          return (
            <Tooltip title={t('common.tooltip.archived')}>
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
            </Tooltip>
          )
        }
        if (mode === 'view') {
          return (
            <Tooltip title={t('common.tooltip.notArchived')}>
              <ExclamationCircleOutlined style={{ color: '#8c8c8c', fontSize: 16 }} />
            </Tooltip>
          )
        }
        return (
          <Tooltip title={t('common.tooltip.notArchived')}>
            <ExclamationCircleOutlined
              style={{ color: '#8c8c8c', fontSize: 16, cursor: 'pointer' }}
              onClick={() => {
                setArchiveRecord(record)
                archiveForm.resetFields()
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
        <Space size={4}>
          <Tooltip title={t('common.detail')}>
            <Button
              type="text"
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() => {
                sessionStorage.removeItem('schedule_list_context')
                sessionStorage.setItem(
                  'schedule_list_context',
                  JSON.stringify({ ids: schedules.map((s) => s.id) })
                )
                navigate(`/live/schedules/${record.id}?mode=view`)
              }}
            />
          </Tooltip>
          {mode === 'edit' && (
            <>
              <Tooltip title={t('common.edit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    sessionStorage.removeItem('schedule_list_context')
                    sessionStorage.setItem(
                      'schedule_list_context',
                      JSON.stringify({ ids: schedules.map((s) => s.id) })
                    )
                    navigate(`/live/schedules/${record.id}?mode=edit`)
                  }}
                />
              </Tooltip>
              <Popconfirm
                title={t('live.schedule.confirm.delete')}
                onConfirm={() => void handleDelete(record.id)}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
              >
                <Tooltip title={t('common.delete')}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  // ── 渲染 ────────────────────────────────────────────────────────────────

  return (
    <div>
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
      <Row justify="end" style={{ marginBottom: 12 }}>
        <Col>
          <Space>
            <Button
              type={toBeArchivedActive ? 'primary' : 'default'}
              onClick={() => {
                if (toBeArchivedActive) {
                  setToBeArchivedActive(false)
                  setFilters({ channel_id: channelId })
                  resetSort()
                  void (async () => {
                    const res = await loadList(1, pagination.pageSize, { channel_id: channelId }, null, null)
                    if (res) updatePagination(res)
                  })()
                } else {
                  setToBeArchivedActive(true)
                  const params: ScheduleQueryParams = {
                    channel_id: channelId,
                    cutv_enable: true,
                    is_archived: false,
                  }
                  setFilters(params)
                  resetSort()
                  void (async () => {
                    const res = await loadList(1, pagination.pageSize, params, null, null)
                    if (res) updatePagination(res)
                  })()
                }
              }}
            >
              {t('live.schedule.btn.toBeArchived')} {toBeArchivedCount}
            </Button>

            <Button
              icon={<DownloadOutlined />}
              disabled={selectedRowKeys.length === 0}
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
              }}
            >
              {t('common.btn.excelExport')}
            </Button>

            <Upload
              accept=".xlsx,.xls"
              showUploadList={false}
              beforeUpload={() => false}
              onChange={({ file }) => {
                const f = file.originFileObj as File
                if (!f) return
                setImporting(true)
                importSchedulesExcel(f)
                  .then((result) => {
                    void message.success(
                      `${t('live.schedule.msg.importSuccess')} (total: ${result.total}, created: ${result.created}, updated: ${result.updated})`
                    )
                    void (async () => {
                      const res = await loadList(1, pagination.pageSize, filters, null, null)
                      if (res) updatePagination(res)
                    })()
                  })
                  .catch(() => void message.error(t('live.schedule.msg.importFailed')))
                  .finally(() => setImporting(false))
              }}
            >
              <Button icon={<UploadOutlined />} loading={importing} disabled={mode === 'view'}>
                {t('common.btn.excelImport')}
              </Button>
            </Upload>

            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={mode === 'view'}
              onClick={() => setCreateModalOpen(true)}
            >
              {t('live.schedule.btn.new')}
            </Button>
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
        rowSelection={
          mode === 'edit'
            ? {
                type: 'checkbox',
                fixed: true,
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys as number[]),
              }
            : undefined
        }
        pagination={tablePaginationProps}
        onChange={handleTableChange}
      />

      {/* 新增节目单弹框 */}
      <ScheduleCreateModal
        open={createModalOpen}
        channelId={channelId}
        channelName={channelName}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false)
          void message.success(t('live.schedule.msg.created'), 3)
          void (async () => {
            const res = await loadList(1, pagination.pageSize, filters, null, null)
            if (res) updatePagination(res)
          })()
        }}
      />

      {/* 归档计划弹框 */}
      <Modal
        title={t('live.schedule.archivePlan.title')}
        open={archiveModalOpen}
        onOk={handleArchivePlan}
        onCancel={() => setArchiveModalOpen(false)}
        confirmLoading={archiveModalLoading}
        destroyOnHidden
        width={480}
      >
        <Form form={archiveForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="mode" label={t('live.schedule.archivePlan.executionMode')} initialValue="now">
            <Radio.Group>
              <Radio.Button value="now">{t('live.schedule.archivePlan.now')}</Radio.Button>
              <Tooltip title={t('common.placeholder.comingSoon')}>
                <Radio.Button value="plan" disabled>
                  {t('live.schedule.archivePlan.plan')}
                </Radio.Button>
              </Tooltip>
            </Radio.Group>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.mode !== curr.mode}>
            {({ getFieldValue }) =>
              getFieldValue('mode') === 'plan' ? (
                <Form.Item
                  name="scheduled_time"
                  label={t('live.schedule.archivePlan.scheduledTime')}
                  rules={[{ required: true, message: t('live.schedule.archivePlan.timeRequired') }]}
                >
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
