/**
 * ScheduleManagement — 直播管理 节目单管理列表页
 *
 * 需求规范（3.5.2.2）：
 *  - 仅展示 Content Type = SCHEDULE 的内容
 *  - 搜索：Channel Name（文本/下拉）/ Content Name / CUTV Enable（多选下拉 YES/NO）/
 *          To Be Archived（快捷统计按钮）/ Begin Time（范围）/ End Time（范围）
 *  - 列表列：Channel Name / Content Name / Ingest Status / Begin Time / End Time /
 *            CUTV Enable / Archived / Action
 *  - 操作按钮：New Schedule / Excel Export / Excel Import / Batch Delete / Batch Publish
 *  - Action：Detail(i) / Edit(铅笔) / Delete(垃圾桶)
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Button,
  Col,
  DatePicker,
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
  Table,
  Tag,
  TimePicker,
  Tooltip,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
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
import { getSchedules, deleteSchedule, exportSchedulesExcel, archiveSchedule, getChannelDetail, getChannels } from '../../api/live'
import { getContents } from '../../api/contents'
import { getScheduleMetadata } from '../../api/metadata'
import { updateScheduleMetadata } from '../../api/metadata'
import { getDictTree } from '../../api/dicts'
import SearchForm from '../../components/SearchForm'
import PublishPlanModal from '../../components/PublishPlanModal'
import ScheduleCreateModal from '../../components/ScheduleCreateModal'
import ScheduleImportModal from '../../components/ScheduleImportModal'
import { EditContentModal } from '../../components/ContentModals'
import { checkPicturesPublishStatus } from '../../api/pictures'
import { checkPackagesPublishStatus } from '../../api/packages'
import type { ScheduleListItem, ScheduleQueryParams } from '../../types/live'
import type { DictNodeListItem } from '../../types/dict'
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

  const [ingestStatusOptions, setIngestStatusOptions] = useState<{ label: string; value: string }[]>([])
  const [channelOptions, setChannelOptions] = useState<{ label: string; value: number }[]>([])

  // 待归档数量
  const [toBeArchivedCount, setToBeArchivedCount] = useState(0)
  const [toBeArchivedActive, setToBeArchivedActive] = useState(false)

  // 新增节目单弹框
  const [createModalOpen, setCreateModalOpen] = useState(false)

  // 编辑弹框
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editContentId, setEditContentId] = useState<number | null>(null)

  // 归档计划弹框
  const [archiveModalOpen, setArchiveModalOpen] = useState(false)
  const [archiveModalLoading, setArchiveModalLoading] = useState(false)
  const [archiveRecord, _setArchiveRecord] = useState<ScheduleListItem | null>(null)
  const [archiveForm] = Form.useForm()
  const [archiveIsPlan, setArchiveIsPlan] = useState(false)

  // 批量发布弹框
  const [publishModalOpen, setPublishModalOpen] = useState(false)

  // 导入弹框
  const [importModalOpen, setImportModalOpen] = useState(false)

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

  // ─── 元数据详情弹框处理 ───────────────────────────────────────────
  const handleShowMetadata = async (record: ScheduleListItem) => {
    if (!record.is_published) {
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
      console.log('[handleSaveMetadata] values=', values)
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
      window.dispatchEvent(new CustomEvent('scheduleMetadataUpdated'))
      await loadList(pagination.current, pagination.pageSize, filters, sortField, sortOrder)
      setMetadataModalOpen(false)
      void loadToBeArchivedCount()
    } catch (err) {
      console.log('[handleSaveMetadata] error=', err)
      if (isHandledError(err)) return
      void message.error(t('live.schedule.msg.metadataSaveFailed'), 5)
    } finally {
      setMetadataSaving(false)
    }
  }

  // ─── 搜索字段配置 ───────────────────────────────────────────────────────────

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'channel_id',
      labelKey: 'common.col.channelName',
      type: 'select',
      options: channelOptions,
      placeholderKey: 'common.placeholder.selectChannel',
    },
    {
      name: 'title',
      labelKey: 'common.col.contentName',
      type: 'input',
      placeholderKey: 'common.placeholder.keyword',
    },
    {
      name: 'statuses',
      labelKey: 'common.col.ingestStatus',
      type: 'multiSelect',
      options: ingestStatusOptions,
    },
    {
      name: 'is_archived',
      labelKey: 'common.col.archived',
      type: 'select',
      options: [
        { label: t('common.yes'), value: 'YES' },
        { label: t('common.no'), value: 'NO' },
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
                setFilters({})
                resetSort()
                void loadList(1, pagination.pageSize, {}, 'created_at', 'descend')
              } else {
                setToBeArchivedActive(true)
                const params: ScheduleQueryParams = { cutv_enable: true, is_archived: false }
                setFilters(params)
                resetSort()
                void loadList(1, pagination.pageSize, params, 'created_at', 'descend')
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
      name: 'is_discarded',
      labelKey: 'common.col.deleted',
      type: 'select',
      options: [
        { label: t('common.no'), value: 'NO' },
        { label: t('common.yes'), value: 'YES' },
      ],
      defaultValue: 'NO',
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
  ], [ingestStatusOptions, channelOptions, toBeArchivedActive, toBeArchivedCount, t])

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
      if (values.channel_id) params.channel_id = values.channel_id
      if (values.title) params.title = values.title
      const statuses = (values as Record<string, unknown>).statuses as string[] | undefined
      if (statuses?.length) params.statuses = statuses
      const isArchived = (values as Record<string, unknown>).is_archived as string | undefined
      if (isArchived) params.is_archived = isArchived === 'YES'
      const isDiscarded = (values as Record<string, unknown>).is_discarded as string | undefined
      if (isDiscarded) params.is_discarded = isDiscarded === 'YES'
      // begin_range / end_range 是表单日期范围字段，需拆分为 from/to
      const beginRange = (values as Record<string, unknown>).begin_range as [dayjs.Dayjs, dayjs.Dayjs] | undefined
      if (beginRange?.[0]) {
        params.begin_from = beginRange[0].startOf('day').format('YYYY-MM-DD HH:mm')
        params.begin_to = beginRange[1].endOf('day').format('YYYY-MM-DD HH:mm')
      }
      const endRange = (values as Record<string, unknown>).end_range as [dayjs.Dayjs, dayjs.Dayjs] | undefined
      if (endRange?.[0]) {
        params.end_from = endRange[0].startOf('day').format('YYYY-MM-DD HH:mm')
        params.end_to = endRange[1].endOf('day').format('YYYY-MM-DD HH:mm')
      }
      setFilters(params)
      resetSort()
      setSelectedRowKeys([])
      void loadList(1, pagination.pageSize, params, 'created_at', 'descend')
    },
    onReset: () => {
      setFilters({ is_discarded: false })
      setToBeArchivedActive(false)
      resetSort()
      setSelectedRowKeys([])
      void loadList(1, pagination.pageSize, { is_discarded: false }, 'created_at', 'descend')
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
    void getDictTree().then((dicts) => {
      const ingestRoot = dicts.find((d: DictNodeListItem) => d.code === 'Ingest_Status')
      setIngestStatusOptions((ingestRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })))
      const seriesTypeRoot = dicts.find((d: DictNodeListItem) => d.code === 'SeriesType')
      if (seriesTypeRoot?.children) {
        setSeriesTypeOptions(seriesTypeRoot.children.map((c: DictNodeListItem) => ({ label: c.name, value: Number(c.code) })))
      }
    }).catch(() => {})
    // 加载频道列表（下拉候选项，来源于频道管理模块）
    void getChannels({ page: 1, page_size: 1000 }).then((data) => {
      setChannelOptions(data.items.map((c) => ({ label: c.title, value: c.id })))
    }).catch(() => {})
    void loadList(1, pagination.pageSize, { is_discarded: false }, 'created_at', 'descend')
    void loadToBeArchivedCount()
  }, [])

  useEffect(() => {
    const handleScheduleMetadataUpdated = () => {
      void loadToBeArchivedCount()
    }
    window.addEventListener('scheduleMetadataUpdated', handleScheduleMetadataUpdated)
    return () => {
      window.removeEventListener('scheduleMetadataUpdated', handleScheduleMetadataUpdated)
    }
  }, [])

  const loadList = async (p: number, ps: number, params: ScheduleQueryParams, sortBy?: string | null, sortOrd?: 'ascend' | 'descend' | null) => {
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
      void loadToBeArchivedCount()
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
      void loadToBeArchivedCount()
    } catch (err) {
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
          // 归档成功后，将生成的 archive_content_id 回写到元数据 program_id
          if (result.archive_content_id) {
            try {
              await updateScheduleMetadata(archiveRecord.id, {
                program_id: String(result.archive_content_id),
              })
            } catch {
              // 静默处理，不影响主流程
            }
          }
        }
        setArchiveModalOpen(false)
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
      render: (_: string, record: ScheduleListItem) => {
        const name = record.channel_name ?? '—'
        return <Tooltip title={name}><span>{name}</span></Tooltip>
      },
    },
    {
      title: t('common.col.contentName'),
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'title' ? sortOrder : null,
      render: (v: string, record) => (
        <Tooltip autoAdjustOverflow={false} placement="topLeft" title={v}>
          <a
            onClick={() => {
              sessionStorage.removeItem('schedule_list_context')
              sessionStorage.setItem(
                'schedule_list_context',
                JSON.stringify({ ids: schedules.map((s) => s.id) }),
              )
              navigate(`/live/schedules/${record.id}?mode=${record.is_discarded ? 'view' : 'edit'}`)
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
        const text = v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—'
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
        const text = v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—'
        return <Tooltip title={text}><span>{text}</span></Tooltip>
      },
    },
    {
      title: t('common.col.archived'),
      key: 'archived',
      width: 120,
      render: (_: unknown, record: ScheduleListItem) => {
        if (record.is_archived) {
          const clickable = canOperate && !!record.archive_content_id
          return (
            <Tooltip title={t('common.tooltip.archived')}>
              <span
                onClick={() => {
                  if (clickable) {
                    navigate(`/contents/${record.archive_content_id}?mode=edit`)
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
        return (
          <Tooltip title={t('common.tooltip.notArchived')}>
            <ExclamationCircleOutlined
              style={{ color: '#8c8c8c', fontSize: 16, cursor: 'pointer' }}
              onClick={() => {
                handleShowMetadata(record)
              }}
            />
          </Tooltip>
        )
      },
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title={t('common.detail')}>
            <Button type="link" size="small" icon={<InfoCircleOutlined />}
              onClick={() => {
                navigate(`/trade/contents/${record.id}`)
              }} />
          </Tooltip>
          {canOperate && (
            <Tooltip title={t('common.edit')}>
              <Button type="link" size="small" icon={<EditOutlined />}
                onClick={() => { setEditContentId(record.id); setEditModalOpen(true) }} />
            </Tooltip>
          )}
          {canOperate && !record.is_discarded && (
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
                  onClick={async () => {
                    console.log('[BatchPublish] clicked, selectedRowKeys=', selectedRowKeys)
                    const notReady = selectedRowKeys.some((id) => {
                      const item = schedules.find((s) => s.id === id)
                      return !item || item.status !== 'ReadyForPublish'
                    })
                    if (notReady) {
                      void message.warning(t('live.schedule.msg.notReadyForPublish'))
                      return
                    }

                    // 批量校验海报是否已发布
                    const failedChecks: { id: number; name: string; total: number; unpublished: number }[] = []
                    for (const id of selectedRowKeys) {
                      const item = schedules.find((s) => s.id === id)
                      if (!item) continue
                      try {
                        const checkResult = await checkPicturesPublishStatus('Content', id, 'SCHEDULE')
                        if (!checkResult.can_publish) {
                          failedChecks.push({
                            id,
                            name: item.title || String(id),
                            total: checkResult.total_count,
                            unpublished: checkResult.unpublished_count,
                          })
                        }
                      } catch {
                        // 校验失败时跳过，由后端再次校验
                      }
                    }

                    if (failedChecks.length > 0) {
                      const names = failedChecks.map(f => `${f.name}(${f.unpublished}/${f.total})`).join(', ')
                      void message.error(
                        t('live.schedule.msg.picturesNotPublished') + ': ' + names,
                        5
                      )
                      return
                    }

                    // 批量校验服务包是否已发布
                    console.log('[BatchPublish] checking packages...')
                    const packageFailed: { id: number; name: string; total: number; unpublished: number }[] = []
                    for (const id of selectedRowKeys) {
                      const item = schedules.find((s) => s.id === id)
                      if (!item) continue
                      try {
                        const checkResult = await checkPackagesPublishStatus(id)
                        if (!checkResult.can_publish) {
                          packageFailed.push({
                            id,
                            name: item.title || String(id),
                            total: checkResult.total_count,
                            unpublished: checkResult.unpublished_count,
                          })
                        }
                      } catch {
                        // 校验失败时跳过，由后端再次校验
                      }
                    }

                    if (packageFailed.length > 0) {
                      const names = packageFailed.map(f => `${f.name}(${f.unpublished}/${f.total})`).join(', ')
                      void message.error(
                        t('live.schedule.msg.packagesNotPublished') + ': ' + names,
                        5
                      )
                      return
                    }

                    // 批量校验父频道是否已发布
                    console.log('[BatchPublish] checking parent channels...')
                    const parentFailed: { id: number; name: string; channelName: string }[] = []
                    for (const id of selectedRowKeys) {
                      const item = schedules.find((s) => s.id === id)
                      const channelId = item?.parent_id || item?.channel_id
                      console.log('[BatchPublish] item=', item?.title, 'parent_id=', item?.parent_id, 'channel_id=', item?.channel_id)
                      if (!item || !channelId) continue
                      try {
                        console.log('[BatchPublish] fetching channel detail, channelId=', channelId)
                        const channel = await getChannelDetail(channelId)
                        console.log('[BatchPublish] channel=', channel?.title, 'status=', channel?.status)
                        if (channel && channel.status !== 'Published') {
                          parentFailed.push({
                            id,
                            name: item.title || String(id),
                            channelName: channel.title || String(channelId),
                          })
                        }
                      } catch (err) {
                        console.log('[BatchPublish] getChannelDetail error:', err)
                        // 校验失败时跳过，由后端再次校验
                      }
                    }
                    console.log('[BatchPublish] parentFailed=', parentFailed)
                    if (parentFailed.length > 0) {
                      const names = parentFailed.map(f => `${f.name}(${f.channelName})`).join(', ')
                      console.log('[BatchPublish] showing error:', names)
                      void message.error(
                        t('live.schedule.msg.parentChannelNotPublished') + ': ' + names,
                        5
                      )
                      return
                    }

                    console.log('[BatchPublish] all checks passed, opening modal')
                    setPublishModalOpen(true)
                  }}>
                  {t('common.btn.batchPublish')}
                </Button>
              )}
              <Button icon={<DownloadOutlined />}
                disabled={selectedRowKeys.length === 0}
                onClick={async () => {
                  try {
                    const blob = await exportSchedulesExcel(selectedRowKeys)
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    // 从 Content-Disposition 提取文件名，或使用带时间戳的默认名
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
                }}>
                {t('common.btn.excelExport')}
              </Button>
              {canOperate && (
                <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>
                  {t('common.btn.excelImport')}
                </Button>
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
          void loadToBeArchivedCount()
        }}
      />

      {/* 归档计划弹框 */}
      <Modal
        title={t('live.schedule.archivePlan.title')}
        open={archiveModalOpen}
        onCancel={() => setArchiveModalOpen(false)}
        destroyOnHidden
        mask={{ closable: false }}
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
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
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
                  disabledTime={() => {
                    const planDate = archiveForm.getFieldValue('plan_date')
                    if (planDate && planDate.isSame(dayjs(), 'day')) {
                      const currentHour = dayjs().hour()
                      const currentMinute = dayjs().minute()
                      return {
                        disabledHours: () => Array.from({ length: currentHour }, (_, i) => i),
                        disabledMinutes: (hour: number) =>
                          hour === currentHour ? Array.from({ length: currentMinute + 1 }, (_, i) => i) : [],
                      }
                    }
                    return {}
                  }}
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

      {/* 导入弹框 */}
      <ScheduleImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => {
          void loadList(1, pagination.pageSize, filters)
          void loadToBeArchivedCount()
        }}
      />

      {/* 已归档元数据详情弹框 */}
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

      {/* 编辑内容弹窗 */}
      <EditContentModal
        open={editModalOpen}
        contentId={editContentId}
        onClose={() => { setEditModalOpen(false); setEditContentId(null) }}
        onSuccess={() => { setEditModalOpen(false); setEditContentId(null); void loadList(pagination.current, pagination.pageSize, filters) }}
      />
    </div>
  )
}
