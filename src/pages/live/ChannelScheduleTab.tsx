/**
 * ChannelScheduleTab — 频道详情页节目单 Tab（仅展示当前频道节目单）
 *
 * 功能同节目单管理列表，固定 channel_id 过滤。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
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
  archiveSchedule,
} from '../../api/live'
import { getDictTree } from '../../api/dicts'
import { getContents } from '../../api/contents'
import { getScheduleMetadata } from '../../api/metadata'
import SearchForm from '../../components/SearchForm'
import ScheduleCreateModal from '../../components/ScheduleCreateModal'
import ScheduleImportModal from '../../components/ScheduleImportModal'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import ResizableTable from '../../components/ResizableTable'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'
import type { ScheduleListItem, ScheduleQueryParams } from '../../types/live'
import type { SearchFieldConfig } from '../../types/searchForm'
import type { DictNodeListItem } from '../../types/dict'
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
}

export default function ChannelScheduleTab({ channelId, channelName }: ChannelScheduleTabProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { hasPermission } = usePermission()
  const canScheduleOperate = hasPermission('menu.live.schedules.operate')

  const [schedules, setSchedules] = useState<ScheduleListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
  const [ingestStatusOptions, setIngestStatusOptions] = useState<{ label: string; value: string }[]>([])

  // 待归档数量
  const [toBeArchivedCount, setToBeArchivedCount] = useState(0)
  const [toBeArchivedActive, setToBeArchivedActive] = useState(false)

  // 新增节目单弹框
  const [createModalOpen, setCreateModalOpen] = useState(false)

  // 元数据详情弹框（Archived 列点击查看）
  const [metadataModalOpen, setMetadataModalOpen] = useState(false)
  const [metadataModalLoading, setMetadataModalLoading] = useState(false)
  const [metadataSaving, setMetadataSaving] = useState(false)
  const [metadataContentId, setMetadataContentId] = useState<number>(0)
  const [metadataScheduleName, setMetadataScheduleName] = useState('')
  const [metadataForm] = Form.useForm()
  const seriesTypeValue = Form.useWatch('series_type', metadataForm) ?? 0

  // SeriesType 字典选项
  const [seriesTypeOptions, setSeriesTypeOptions] = useState<{ label: string; value: number }[]>([])

  // Series / Show 搜索
  const [seriesSearchOptions, setSeriesSearchOptions] = useState<{ value: string; label: string; id: number; series_ordinal?: number }[]>([])
  const [showSearchOptions, setShowSearchOptions] = useState<{ value: string; label: string; id: number }[]>([])

  // 导入弹框
  const [importModalOpen, setImportModalOpen] = useState(false)

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
        sort_by: sortBy || 'created_at',
        sort_order: sortOrd ? (sortOrd === 'ascend' ? 'asc' : 'desc') : 'desc',
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
        name: 'statuses',
        labelKey: 'common.col.ingestStatus',
        type: 'multiSelect',
        options: ingestStatusOptions,
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
        name: 'to_be_archived',
        label: ' ',
        type: 'input',
        render: () => (
          <Badge count={toBeArchivedCount > 0 ? toBeArchivedCount : undefined} size="medium" offset={[4, 0]} styles={{
            root: { width: '100%' }
          }}>
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
              block
            >
              {t('live.schedule.btn.toBeArchived')}
            </Button>
          </Badge>
        ),
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
    [ingestStatusOptions, toBeArchivedActive, toBeArchivedCount, channelId, t]
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
    defaultValues: { channel_id: channelId } as Partial<SearchValues>,
    onSearch: (values) => {
      const params: ScheduleQueryParams = { channel_id: channelId }
      if (values.title) params.title = values.title
      if (values.statuses?.length) params.statuses = values.statuses
      if (values.cutv_enable !== undefined) params.cutv_enable = values.cutv_enable
      if (values.begin_range?.[0]) {
        params.begin_from = values.begin_range[0].startOf('day').format('YYYY-MM-DD HH:mm')
        params.begin_to = values.begin_range[1].endOf('day').format('YYYY-MM-DD HH:mm')
      }
      if (values.end_range?.[0]) {
        params.end_from = values.end_range[0].startOf('day').format('YYYY-MM-DD HH:mm')
        params.end_to = values.end_range[1].endOf('day').format('YYYY-MM-DD HH:mm')
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
    void getDictTree().then((dicts) => {
      const ingestRoot = dicts.find((d: DictNodeListItem) => d.code === 'Ingest_Status')
      setIngestStatusOptions((ingestRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })))
      const seriesTypeRoot = dicts.find((d: DictNodeListItem) => d.code === 'SeriesType')
      if (seriesTypeRoot?.children) {
        setSeriesTypeOptions(seriesTypeRoot.children.map((c: DictNodeListItem) => ({ label: c.name, value: Number(c.code) })))
      }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

  // ── 元数据详情弹框处理 ───────────────────────────────────────────
  const handleShowMetadata = async (record: ScheduleListItem) => {
    if (record.status !== 'Published') {
      void message.error(t('live.schedule.msg.scheduleNotPublishedCannotArchive'))
      return
    }
    setMetadataContentId(record.id)
    setMetadataScheduleName(record.title)
    setMetadataModalOpen(true)
    setMetadataModalLoading(true)
    // 清空上一次弹框残留的下拉选项，避免 setFieldsValue 不触发 onChange 时
    // 旧的 SEASON_SERIES 选项串到 Series 类型的 Series Name 下拉中
    setSeriesSearchOptions([])
    setShowSearchOptions([])
    try {
      const meta = await getScheduleMetadata(record.id)
      // 先重置表单，清除上次打开弹窗时的残留输入（setFieldsValue 为合并更新，不会清空未覆盖字段）
      metadataForm.resetFields()
      metadataForm.setFieldsValue({
        series_type: meta?.series_type ?? 0,
        series_name: meta?.series_name ?? '',
        series_id: meta?.series_id ?? '',
        sequence: meta?.sequence ?? undefined,
        series_ordinal: meta?.series_ordinal ?? undefined,
        show_name: meta?.show_name ?? '',
        show_id: meta?.show_id ?? '',
        program_id: meta?.program_id ?? '',
        cutv_enable: true,
      })
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('live.schedule.msg.metadataLoadFailed'), 5)
    } finally {
      setMetadataModalLoading(false)
    }
  }

  const handleSaveMetadata = async () => {
    try {
      const values = await metadataForm.validateFields()
      setMetadataSaving(true)

      // 1. 元数据随归档一次性提交：后端同事务处理，归档校验（如 Sequence 重复）
      // 失败时整体回滚，不会单独修改节目单状态
      await archiveSchedule({
        schedule_id: metadataContentId,
        mode: 'now',
        series_type: values.series_type,
        series_name: values.series_name || undefined,
        series_id: values.series_id || undefined,
        sequence: values.sequence,
        series_ordinal: values.series_ordinal,
        show_name: values.show_name || undefined,
        show_id: values.show_id || undefined,
        program_id: values.program_id || undefined,
        cutv_enable: values.cutv_enable ?? true,
      })

      void message.success(t('live.schedule.msg.metadataSaved'), 3)
      setMetadataModalOpen(false)
      const res = await loadList(pagination.current, pagination.pageSize, { ...filters, channel_id: channelId }, sortField, sortOrder)
      if (res) updatePagination(res)
      void loadToBeArchivedCount()
    } catch (err) {
      console.log('[handleSaveMetadata] error=', err)
      if (isHandledError(err)) return
      void message.error(t('live.schedule.msg.metadataSaveFailed'), 5)
    } finally {
      setMetadataSaving(false)
    }
  }

  // ── Series / Show 搜索 ────────────────────────────────────────────

  const loadInitialSeries = useCallback(() => {
    void getContents({ page: 1, page_size: 1000, content_types: ['SERIES'] })
      .then((res) => {
        setSeriesSearchOptions(res.items.map((item: { title: string; id: number; series_ordinal?: number }) => ({ value: item.title, label: `${item.title} (ID:${item.id})`, id: item.id, series_ordinal: item.series_ordinal })))
      })
      .catch(() => setSeriesSearchOptions([]))
  }, [])

  const loadInitialShow = useCallback(() => {
    void getContents({ page: 1, page_size: 1000, content_types: ['SEASON'] })
      .then((res) => {
        setShowSearchOptions(res.items.map((item: { title: string; id: number }) => ({ value: item.title, label: `${item.title} (ID:${item.id})`, id: item.id })))
      })
      .catch(() => setShowSearchOptions([]))
  }, [])

  const searchSeries = useCallback((keyword: string) => {
    // 清空搜索词时恢复全量选项，避免下拉停留在上次的空结果
    if (!keyword || keyword.trim().length < 1) { loadInitialSeries(); return }
    void getContents({ page: 1, page_size: 1000, title: keyword.trim(), content_types: ['SERIES'] })
      .then((res) => {
        setSeriesSearchOptions(res.items.map((item: { title: string; id: number; series_ordinal?: number }) => ({ value: item.title, label: `${item.title} (ID:${item.id})`, id: item.id, series_ordinal: item.series_ordinal })))
      })
      .catch(() => setSeriesSearchOptions([]))
  }, [])

  const searchShow = useCallback((keyword: string) => {
    // 清空搜索词时恢复全量选项，避免下拉停留在上次的空结果
    if (!keyword || keyword.trim().length < 1) { loadInitialShow(); return }
    void getContents({ page: 1, page_size: 1000, title: keyword.trim(), content_types: ['SEASON'] })
      .then((res) => {
        setShowSearchOptions(res.items.map((item: { title: string; id: number }) => ({ value: item.title, label: `${item.title} (ID:${item.id})`, id: item.id })))
      })
      .catch(() => setShowSearchOptions([]))
  }, [])

  const loadInitialSeriesByShow = useCallback(() => {
    const showId = metadataForm.getFieldValue('show_id')
    if (!showId) { setSeriesSearchOptions([]); return }
    void getContents({ page: 1, page_size: 1000, parent_id: Number(showId), content_types: ['SEASON_SERIES'] })
      .then((res) => {
        setSeriesSearchOptions(res.items.map((item: { title: string; id: number; series_ordinal?: number }) => ({ value: item.title, label: `${item.title} (ID:${item.id})`, id: item.id, series_ordinal: item.series_ordinal })))
      })
      .catch(() => setSeriesSearchOptions([]))
  }, [])

  const searchSeriesByShow = useCallback((keyword: string) => {
    const showId = metadataForm.getFieldValue('show_id')
    if (!showId) { setSeriesSearchOptions([]); return }
    const params: Record<string, unknown> = { page: 1, page_size: 1000, parent_id: Number(showId), content_types: ['SEASON_SERIES'] }
    if (keyword.trim()) params.title = keyword.trim()
    void getContents(params)
      .then((res) => {
        setSeriesSearchOptions(res.items.map((item: { title: string; id: number; series_ordinal?: number }) => ({ value: item.title, label: `${item.title} (ID:${item.id})`, id: item.id, series_ordinal: item.series_ordinal })))
      })
      .catch(() => setSeriesSearchOptions([]))
  }, [])

  // ── 操作处理 ────────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    try {
      await deleteSchedule(id)
      void message.success(t('live.schedule.msg.deleted'), 3)
      setSelectedRowKeys(prev => prev.filter(key => key !== id))
      let page = pagination.current
      const res = await loadList(page, pagination.pageSize, { ...filters, channel_id: channelId }, null, null)
      // 当前页数据被删光后自动回退到上一页（或第一页）
      if (res && res.items.length === 0 && page > 1) {
        page = Math.min(page - 1, Math.ceil((res.total || 0) / pagination.pageSize) || 1)
        const prevRes = await loadList(page, pagination.pageSize, { ...filters, channel_id: channelId }, null, null)
        if (prevRes) updatePagination(prevRes)
      } else if (res) {
        updatePagination(res)
      }
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      void message.error(detail ?? t('common.msg.deleteFailed'), 5)
    }
  }


  // ── 列定义 ──────────────────────────────────────────────────────────────

  const columns: ColumnsType<ScheduleListItem> = [
    {
      title: t('common.col.channelName'),
      dataIndex: 'channel_name',
      key: 'channel_name',
      width: 320,
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
      width: 280,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'title' ? sortOrder : null,
      render: (v: string, record) => (
        <Tooltip title={v}>
          <a onClick={() => navigate(`/live/schedules/${record.id}?mode=${record.is_discarded ? 'view' : 'edit'}`)}>{v}</a>
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
        const text = v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—'
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
        const text = v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—'
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
      width: 200,
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
      title: t('common.col.archived'),
      key: 'archived',
      width: 220,
      render: (_: unknown, record: ScheduleListItem) => {
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
                  navigate(`/contents/${record.archive_content_id}?mode=edit`)
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
        return (
          <Tooltip title={t('common.tooltip.notArchived')}>
            <ExclamationCircleOutlined
              style={{ color: '#8c8c8c', fontSize: 16, cursor: canScheduleOperate ? 'pointer' : 'not-allowed' }}
              onClick={() => {
                if (!canScheduleOperate) return
                void handleShowMetadata(record)
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
            <Button
              type="link"
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
          {canScheduleOperate && (
            <Tooltip title={t('common.edit')}>
              <Button
                type="link"
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
          )}
          {canScheduleOperate && (
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
              icon={<DownloadOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={async () => {
                try {
                  const blob = await exportSchedulesExcel(selectedRowKeys)
                  const url = window.URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  // 带时间戳的默认文件名（与节目单管理页一致）
                  const timestamp = dayjs().format('YYYYMMDDHHmmss')
                  a.download = `schedules_${timestamp}.xlsx`
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

            {canScheduleOperate && (
              <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>
                {t('common.btn.excelImport')}
              </Button>
            )}

          {canScheduleOperate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              {t('live.schedule.btn.new')}
            </Button>
          )}
          </Space>
        </Col>
      </Row>

      <ResizableTable<ScheduleListItem>
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
        channelId={channelId}
        channelName={channelName}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false)
          void message.success(t('live.schedule.msg.created'), 3)
          void (async () => {
            const res = await loadList(1, pagination.pageSize, { ...filters, channel_id: channelId }, null, null)
            if (res) updatePagination(res)
          })()
        }}
      />

      {/* 导入弹框（与节目单管理页共用：模板下载 + 冲突确认 + 校验错误展示） */}
      <ScheduleImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => {
          void (async () => {
            const res = await loadList(1, pagination.pageSize, filters, null, null)
            if (res) updatePagination(res)
          })()
          void loadToBeArchivedCount()
        }}
      />

      {/* 元数据详情弹框 */}
      <Modal
        title={`${metadataScheduleName} - ${t('common.detail')}`}
        open={metadataModalOpen}
        onCancel={() => {
          if (!metadataSaving) setMetadataModalOpen(false)
        }}
        width={640}
        destroyOnClose
        afterClose={() => {
          metadataForm.resetFields()
          setSeriesSearchOptions([])
          setShowSearchOptions([])
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setMetadataModalOpen(false)} disabled={metadataSaving}>
              {t('common.cancel')}
            </Button>
            <Button type="primary" loading={metadataSaving} onClick={() => void handleSaveMetadata()}>
              {t('common.confirm')}
            </Button>
          </div>
        }
      >
        {metadataModalLoading ? (
          <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin />
          </div>
        ) : (
          <Form form={metadataForm} layout="vertical" autoComplete="off" style={{ marginTop: 8 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="cutv_enable" label={t('content.metadata.cutvEnable')} valuePropName="checked">
                  <Switch
                    checkedChildren={t('content.metadata.yes')}
                    unCheckedChildren={t('content.metadata.no')}
                    disabled
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="series_type" label={t('content.metadata.seriesType')}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder={t('common.placeholder.select')}
                    options={seriesTypeOptions}
                    onChange={() => {
                      metadataForm.setFieldsValue({
                        show_name: undefined,
                        show_id: undefined,
                        series_name: undefined,
                        series_id: undefined,
                        sequence: undefined,
                        series_ordinal: undefined,
                      })
                      setSeriesSearchOptions([])
                      setShowSearchOptions([])
                    }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="program_id" hidden>
                  <Input />
                </Form.Item>
              </Col>
            </Row>

            {(seriesTypeValue === 1 || seriesTypeValue === 2) && (
              <Row gutter={16}>
                {seriesTypeValue === 2 && (
                  <Col span={12}>
                    <Form.Item name="show_name" label={t('content.metadata.showName')} rules={[{ required: true, message: t('common.required') }]}>
                      <Select
                        showSearch
                        filterOption={false}
                        placeholder={t('common.placeholder.enterOrSearch')}
                        options={showSearchOptions}
                        onSearch={(val) => searchShow(val)}
                        onOpenChange={(open) => { if (open) loadInitialShow() }}
                        onSelect={(_val, option) => {
                          metadataForm.setFieldsValue({ show_id: String((option as unknown as { id: number }).id) })
                          metadataForm.setFieldsValue({ series_name: undefined, series_id: undefined })
                          setSeriesSearchOptions([])
                          loadInitialSeriesByShow()
                        }}
                      />
                    </Form.Item>
                  </Col>
                )}
                <Col span={12}>
                  <Form.Item name="series_name" label={t('content.metadata.seriesName')} rules={[{ required: true, message: t('common.required') }]}>
                    <Select
                      showSearch
                      filterOption={false}
                      placeholder="Please search & select"
                      options={seriesSearchOptions}
                      onSearch={(val) => seriesTypeValue === 2 ? searchSeriesByShow(val) : searchSeries(val)}
                      onOpenChange={(open) => {
                        if (open) {
                          seriesTypeValue === 2 ? loadInitialSeriesByShow() : loadInitialSeries()
                        }
                      }}
                      onSelect={(_val, option) => {
                        const opt = option as unknown as { id: number; series_ordinal?: number }
                        metadataForm.setFieldsValue({ series_id: String(opt.id), series_ordinal: opt.series_ordinal ?? undefined })
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="sequence" label={t('content.col.sequence')} rules={[{ required: true, message: t('common.required') }]}>
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                </Col>
              </Row>
            )}

            {/* 隐藏字段：随表单提交自动保存 */}
            <Form.Item name="series_id" hidden><Input /></Form.Item>
            <Form.Item name="show_id" hidden><Input /></Form.Item>
            <Form.Item name="series_ordinal" hidden><InputNumber /></Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}
