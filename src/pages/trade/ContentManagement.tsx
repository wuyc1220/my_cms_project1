/**
 * ContentManagement — 内容管理列表页（交易视角）
 *
 * 需求规范（4.2.4）：
 *  - 列表列：ID / Content Name / Content Type / Ingest Status / Genre / Creation Date
 *             / Licence（图标，含 Add License to Content 弹框）/ License Start / License End / Action
 *  - Action：Assign（占位）/ 详情(i) / 编辑 / 删除
 *  - 新增/编辑内容弹框：动态表单随 content_type 变化
 *  - Add License to Content 弹框（左右两栏）
 *  - "Without License" 快捷统计按钮
 *  - 搜索区支持折叠/展开
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Button,
  Col,
  DatePicker,
  Divider,
  Empty,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import {
  CheckCircleFilled,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  InfoCircleOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getContents,
  createContent,
  deleteContent,
  batchDeleteContents,
  getWithoutLicenseContentCount,
  getSeriesSimple,
  getChannelsSimple,
  getContentLicenses,
} from '../../api/contents'
import { getLicenses } from '../../api/licenses'
import {
  addContentsToLicense,
  removeContentFromLicense,
} from '../../api/licenses'
import { getGenres } from '../../api/genres'
import { getCustomTags } from '../../api/customTags'
import { getMultiLanguageOptions } from '../../api/i18n'
import { getProvidersSimple } from '../../api/providers'
import { getContractsSimple } from '../../api/contracts'
import { getTasks, assignTask } from '../../api/tasks'
import { getUsers } from '../../api/users'
import { getDictTree } from '../../api/dicts'
import SearchForm from '../../components/SearchForm'
import TrimInput from '../../components/TrimInput'
import type { SearchFieldConfig } from '../../types/searchForm'
import type { ContentListItem, ContentCreatePayload, ContentSimpleItem, ContentLicenseRef, SeasonDetailRow } from '../../types/content'
import type { LicenseListItem, ProviderSimpleItem, ContractSimpleItem } from '../../types/trade'
import type { GenreListItem, CustomTagListItem } from '../../types/basic'
import type { TaskListItem } from '../../types/task'
import type { UserListItem } from '../../types/user'
import type { DictNodeListItem } from '../../types/dict'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'
import { CreateLicenseModal, EditContentModal } from '../../components/ContentModals'
import { isHandledError } from '../../api'
import { useFormRules } from '../../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../../constants/form'


// ─── 常量 ────────────────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { label: 'MOVIE', value: 'MOVIE' },
  { label: 'EPISODE', value: 'EPISODE' },
  { label: 'SEASON', value: 'SEASON' },
  { label: 'SERIES', value: 'SERIES' },
  { label: 'CHANNEL', value: 'CHANNEL' },
  { label: 'SCHEDULE', value: 'SCHEDULE' },
]

// ─── 内部类型 ─────────────────────────────────────────────────────────────────

interface SearchValues {
  content_id?: number
  title?: string
  content_types?: string[]
  statuses?: string[]
  genre_ids?: number[]
  custom_tag_ids?: number[]
  created_range?: [dayjs.Dayjs, dayjs.Dayjs]
  license_start_range?: [dayjs.Dayjs, dayjs.Dayjs]
  license_end_range?: [dayjs.Dayjs, dayjs.Dayjs]
  is_discarded?: boolean
}

interface ContentFormValues {
  title: string
  content_type: string
  genre_id?: number
  custom_tag_ids?: number[]
  parent_id?: number
  sequence?: number
  series_type?: number
  volumn_count?: number
  season_details?: { series_ordinal: number; episode_count: number }[]
  begin_time?: dayjs.Dayjs
  end_time?: dayjs.Dayjs
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function ContentManagement() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const formRules = useFormRules()
  const [itemForm] = Form.useForm<ContentFormValues>()

  // 列表
  const [contents, setContents] = useState<ContentListItem[]>([])
  const [loading, setLoading] = useState(false)
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filters, withoutLicenseActive, sortField, sortOrder)
    },
  })

  // 搜索
  const [filters, setFilters] = useState<Record<string, unknown>>({})

  // 批量选择
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [deleteLoading, setDeleteLoading] = useState(false)

  // 无许可证统计
  const [withoutLicenseCount, setWithoutLicenseCount] = useState(0)
  const [withoutLicenseActive, setWithoutLicenseActive] = useState(false)

  // 新增弹框
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const currentType = Form.useWatch('content_type', itemForm)
  const volumnCount = Form.useWatch('volumn_count', itemForm)

  // 编辑弹框
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editContentId, setEditContentId] = useState<number | null>(null)

  // 下拉候选项
  const [genreOptions, setGenreOptions] = useState<{ label: string; value: number }[]>([])
  const [customTagOptions, setCustomTagOptions] = useState<{ label: string; value: number }[]>([])
  const [seriesOptions, setSeriesOptions] = useState<ContentSimpleItem[]>([])
  const [channelOptions, setChannelOptions] = useState<ContentSimpleItem[]>([])
  const [ingestStatusOptions, setIngestStatusOptions] = useState<{ label: string; value: string }[]>([])
  const [ingestStatusMap, setIngestStatusMap] = useState<Record<string, string>>({})

  // Add License to Content 弹框
  const [licenseModalOpen, setLicenseModalOpen] = useState(false)
  const [licenseModalContent, setLicenseModalContent] = useState<ContentListItem | null>(null)
  const [licenseSearchForm] = Form.useForm()
  const [availableLicenses, setAvailableLicenses] = useState<LicenseListItem[]>([])
  const [licensesLoading, setLicensesLoading] = useState(false)
  const [licenseTotal, setLicenseTotal] = useState(0)
  const [licensePage, setLicensePage] = useState(1)
  const [linkedLicenses, setLinkedLicenses] = useState<ContentLicenseRef[]>([])
  const [pendingAddLicenses, setPendingAddLicenses] = useState<LicenseListItem[]>([])
  const [licenseModalLoading, setLicenseModalLoading] = useState(false)

  // SEASON 明细行（受控）
  const [seasonRows, setSeasonRows] = useState<SeasonDetailRow[]>([])

  // Task Assign 弹框
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignRecord, setAssignRecord] = useState<ContentListItem | null>(null)
  const [assignTasks, setAssignTasks] = useState<TaskListItem[]>([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignSubmitting, setAssignSubmitting] = useState(false)
  const [assignForm] = Form.useForm()
  const [userOptions, setUserOptions] = useState<{ label: string; value: number }[]>([])

  // Provider / Contract 下拉（Add License 弹框搜索）
  const [providerOptions, setProviderOptions] = useState<ProviderSimpleItem[]>([])
  const [contractOptions, setContractOptions] = useState<ContractSimpleItem[]>([])

  // 新增许可证弹窗状态
  const [createLicenseModalOpen, setCreateLicenseModalOpen] = useState(false)

  const { hasPermission } = usePermission()
  const canViewContent = hasPermission('menu.trade.contents.view') || hasPermission('menu.trade.contents.operate')
  const canOperateContent = hasPermission('menu.trade.contents.operate')
  const canOperateLicense = hasPermission('menu.trade.licenses.operate')

  // ─── 搜索字段配置 ─────────────────────────────────────────────────────────────

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'title',
      labelKey: 'content.col.contentName',
      type: 'input',
    },
    {
      name: 'content_types',
      labelKey: 'content.col.contentType',
      type: 'multiSelect',
      options: CONTENT_TYPES,
    },
    {
      name: 'statuses',
      labelKey: 'license.addContent.ingestStatus',
      type: 'multiSelect',
      options: ingestStatusOptions,
    },
    {
      name: 'without_license',
      label: ' ',
      type: 'select',
      render: () => (
        <Badge count={withoutLicenseCount} size="medium" offset={[4, 0]} styles={{
          root: { width: '100%' } // 或直接写样式
        }}>
          <Button
            type={withoutLicenseActive ? 'primary' : 'default'}
            onClick={handleWithoutLicense}
            block
          >
            {t('license.addContent.withoutLicense')}
          </Button>
        </Badge>
      ),
    },
    {
      name: 'content_id',
      label: 'ID',
      type: 'number',
    },
    {
      name: 'genre_ids',
      labelKey: 'trade.col.genre',
      type: 'multiSelect',
      options: genreOptions,
    },
    {
      name: 'custom_tag_ids',
      labelKey: 'trade.content.search.customTags',
      type: 'multiSelect',
      options: customTagOptions,
    },
    {
      name: 'created_range',
      labelKey: 'trade.content.search.createdRange',
      type: 'dateRange',
    },
    {
      name: 'license_start_range',
      labelKey: 'trade.content.search.licenseStartRange',
      type: 'dateRange',
    },
    {
      name: 'license_end_range',
      labelKey: 'trade.content.search.licenseEndRange',
      type: 'dateRange',
    },
    {
      name: 'is_discarded',
      labelKey: 'trade.content.search.isDiscarded',
      type: 'select',
      options: [
        { label: '否', value: false },
        { label: '是', value: true },
      ],
      defaultValue: false,
    },
  ], [genreOptions, customTagOptions, ingestStatusOptions, t, withoutLicenseActive, withoutLicenseCount])

  // ─── 使用 useSearchForm Hook ─────────────────────────────────────────────────

  const {
    form: searchForm,
    expanded,
    setExpanded,
    showExpand,
    handleSearch,
    handleReset,
  } = useSearchForm<SearchValues>({
    fieldsCount: searchFields.length,
    onSearch: (values) => {
      setWithoutLicenseActive(false)
      setFilters(values as Record<string, unknown>)
      resetSort()
      void loadList(1, pagination.pageSize, values as Record<string, unknown>, false, null, null)
    },
    onReset: () => {
      setFilters({})
      setWithoutLicenseActive(false)
      resetSort()
      void loadList(1, pagination.pageSize, {}, false, null, null)
      void loadWithoutLicenseCount()
    },
  })

  // ─── 初始化 ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    void loadOptions()
    void loadList(1, pagination.pageSize, {})
    void loadWithoutLicenseCount()
  }, [])

  const loadOptions = async () => {
    try {
      // 获取默认语言（Multi_Languages的第一种语言）
      const langOptions = await getMultiLanguageOptions()
      const defaultLang = langOptions.length > 0 ? langOptions[0].code : undefined
      const langFilter = defaultLang ? [defaultLang] : undefined

      const [genres, customTags, series, channels, providers, contracts, dicts] = await Promise.all([
        getGenres({ page: 1, page_size: 500, languages: langFilter }),
        getCustomTags({ page: 1, page_size: 500, languages: langFilter }),
        getSeriesSimple(),
        getChannelsSimple(),
        getProvidersSimple(),
        getContractsSimple(),
        getDictTree(),
      ])
      setGenreOptions(genres.items.map((g: GenreListItem) => ({ label: g.name, value: g.id })))
      setCustomTagOptions(customTags.items.map((t: CustomTagListItem) => ({ label: t.name, value: t.id })))
      setSeriesOptions(series)
      setChannelOptions(channels)
      setProviderOptions(providers)
      setContractOptions(contracts)

      const ingestRoot = dicts.find((d: DictNodeListItem) => d.code === 'Ingest_Status')
      if (ingestRoot?.children) {
        setIngestStatusOptions(ingestRoot.children.map((c: DictNodeListItem) => ({ label: c.name, value: c.code })))
        const map: Record<string, string> = {}
        ingestRoot.children.forEach((c: DictNodeListItem) => { map[c.code] = c.name })
        setIngestStatusMap(map)
      }
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('trade.content.msg.initFailed'), 5)
    }
  }

  const loadWithoutLicenseCount = async () => {
    try {
      const { count } = await getWithoutLicenseContentCount()
      setWithoutLicenseCount(count)
    } catch (err) {
      // 忽略，不影响主流程
    }
  }

  // ─── 列表加载 ─────────────────────────────────────────────────────────────────

  const buildParams = (targetPage: number, targetPageSize: number, f: Record<string, unknown>, noLicense?: boolean, sortBy?: string | null, sortOrd?: 'ascend' | 'descend' | null) => ({
    page: targetPage,
    page_size: targetPageSize,
    content_id: f.content_id as number | undefined,
    title: f.title as string | undefined,
    content_types: f.content_types as string[] | undefined,
    statuses: f.statuses as string[] | undefined,
    genre_ids: f.genre_ids as number[] | undefined,
    custom_tag_ids: f.custom_tag_ids as number[] | undefined,
    created_from: (f.created_range as [dayjs.Dayjs, dayjs.Dayjs] | undefined)?.[0]?.format('YYYY-MM-DD'),
    created_to: (f.created_range as [dayjs.Dayjs, dayjs.Dayjs] | undefined)?.[1]?.format('YYYY-MM-DD'),
    without_license: noLicense ?? withoutLicenseActive,
    license_start_from: (f.license_start_range as [dayjs.Dayjs, dayjs.Dayjs] | undefined)?.[0]?.format('YYYY-MM-DD'),
    license_start_to: (f.license_start_range as [dayjs.Dayjs, dayjs.Dayjs] | undefined)?.[1]?.format('YYYY-MM-DD'),
    license_end_from: (f.license_end_range as [dayjs.Dayjs, dayjs.Dayjs] | undefined)?.[0]?.format('YYYY-MM-DD'),
    license_end_to: (f.license_end_range as [dayjs.Dayjs, dayjs.Dayjs] | undefined)?.[1]?.format('YYYY-MM-DD'),
    is_discarded: f.is_discarded as boolean | undefined,
    sort_by: sortBy ?? undefined,
    sort_order: sortOrd ? (sortOrd === 'ascend' ? 'asc' : 'desc') : undefined,
  })

  const loadList = async (targetPage: number, targetPageSize: number, f: Record<string, unknown>, noLicense?: boolean, sortBy?: string | null, sortOrd?: 'ascend' | 'descend' | null) => {
    setLoading(true)
    try {
      const data = await getContents(buildParams(targetPage, targetPageSize, f, noLicense, sortBy, sortOrd))
      setContents(data.items)
      updatePagination(data)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('trade.content.msg.loadFailed'), 5)
    } finally {
      setLoading(false)
    }
  }


  const handleWithoutLicense = () => {
    const next = !withoutLicenseActive
    setWithoutLicenseActive(next)
    resetSort()
    // 从表单获取当前值，确保使用最新的搜索条件
    const currentValues = searchForm.getFieldsValue() as Record<string, unknown>
    void loadList(1, pagination.pageSize, currentValues, next, null, null)
  }


  // ─── 新增弹框 ───────────────────────────────────────────────────────────

  const openCreate = () => {
    setSeasonRows([])
    itemForm.resetFields()
    setModalOpen(true)
  }

  const openEdit = (record: ContentListItem) => {
    setEditContentId(record.id)
    setEditModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    itemForm.resetFields()
    setSeasonRows([])
  }

  const handleEditSuccess = () => {
    setEditModalOpen(false)
    setEditContentId(null)
    void loadList(pagination.current, pagination.pageSize, filters)
  }

  // SEASON 季数变化时，自动生成明细行
  useEffect(() => {
    if (currentType === 'SEASON' && volumnCount && volumnCount > 0) {
      const rows: SeasonDetailRow[] = []
      for (let i = 1; i <= volumnCount; i++) {
        rows.push({ series_ordinal: i, episode_count: 0 })
      }
      setSeasonRows(rows)
    }
  }, [volumnCount, currentType])

  const handleSubmit = async () => {
    const values = await itemForm.validateFields()
    setModalLoading(true)
    try {
      const payload: ContentCreatePayload = {
        title: values.title,
        content_type: values.content_type,
        genre_id: values.genre_id,
        custom_tag_ids: values.custom_tag_ids,
        parent_id: values.parent_id,
        sequence: values.sequence,
        series_type: values.series_type,
        volumn_count: values.volumn_count,
        season_details: currentType === 'SEASON' ? seasonRows : undefined,
        begin_time: values.begin_time?.toISOString(),
        end_time: values.end_time?.toISOString(),
      }
      await createContent(payload)
      void message.success(t('trade.content.msg.created'), 3)
      await loadOptions()
      closeModal()
      void loadList(1, pagination.pageSize, filters)
    } catch (err) {
      // 错误已由拦截器处理
    } finally {
      setModalLoading(false)
    }
  }

  // ─── 删除 ────────────────────────────────────────────────────────────────────

  const handleDelete = async (record: ContentListItem) => {
    if (record.status === 'Published') {
      void message.warning(t('trade.content.msg.unpublishFirst'), 5)
      return
    }
    try {
      await deleteContent(record.id)
      void message.success(t('common.msg.deleted'), 3)
      setSelectedRowKeys((prev) => prev.filter((key) => key !== record.id))
      void loadList(pagination.current, pagination.pageSize, filters)
      void loadWithoutLicenseCount()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('common.msg.deleteFailed'), 5)
    }
  }

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      void message.warning(t('trade.content.msg.selectAtLeastOne'), 3)
      return
    }
    const hasPublished = contents.some(
      (c) => selectedRowKeys.includes(c.id) && c.status === 'Published',
    )
    if (hasPublished) {
      void message.warning(t('trade.content.msg.unpublishFirst'), 5)
      return
    }
    setDeleteLoading(true)
    try {
      const { deleted } = await batchDeleteContents(selectedRowKeys as number[])
      void message.success(t('trade.content.msg.batchDeleted', { count: deleted }), 3)
      setSelectedRowKeys([])
      void loadList(pagination.current, pagination.pageSize, filters)
      void loadWithoutLicenseCount()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('common.msg.deleteFailed'), 5)
    } finally {
      setDeleteLoading(false)
    }
  }

  // ─── Add License to Content 弹框 ─────────────────────────────────────────────

  const openLicenseModal = async (record: ContentListItem) => {
    setLicenseModalContent(record)
    setLicenseModalOpen(true)
    setLicensePage(1)
    licenseSearchForm.resetFields()
    await Promise.all([
      loadAvailableLicenses(1, {}),
      loadLinkedLicenses(record.id),
    ])
  }

  const closeLicenseModal = () => {
    setLicenseModalOpen(false)
    setLicenseModalContent(null)
    setAvailableLicenses([])
    setLinkedLicenses([])
    setPendingAddLicenses([])
  }

  const loadAvailableLicenses = async (targetPage: number, f: Record<string, unknown>) => {
    setLicensesLoading(true)
    try {
      const data = await getLicenses({
        page: targetPage,
        page_size: 10,
        name: f.name as string | undefined,
        provider_id: f.provider_id as number | undefined,
        contract_id: f.contract_id as number | undefined,
      })
      setAvailableLicenses(data.items)
      setLicenseTotal(data.total)
      setLicensePage(data.page)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('trade.content.msg.licenseLoadFailed'), 5)
    } finally {
      setLicensesLoading(false)
    }
  }

  const loadLinkedLicenses = async (contentId: number) => {
    try {
      const data = await getContentLicenses(contentId)
      setLinkedLicenses(data)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('trade.content.msg.linkedLicensesLoadFailed'), 5)
    }
  }

  const handleAddLicense = (license: LicenseListItem) => {
    if (!licenseModalContent) return
    const alreadyLinked = linkedLicenses.some((l) => l.id === license.id)
    const alreadyPending = pendingAddLicenses.some((l) => l.id === license.id)
    if (alreadyLinked) {
      void message.warning(t('trade.content.msg.licenseAlreadyLinked'), 3)
      return
    }
    if (alreadyPending) {
      void message.warning(t('trade.content.msg.licenseAlreadyInPending'), 3)
      return
    }
    setPendingAddLicenses((prev) => [license, ...prev])
  }

  const handleRemovePendingLicense = (licenseId: number) => {
    setPendingAddLicenses((prev) => prev.filter((l) => l.id !== licenseId))
  }

  const handleRemoveLicense = async (licRef: ContentLicenseRef) => {
    if (!licenseModalContent) return
    try {
      await removeContentFromLicense(licRef.id, licenseModalContent.id)
      setLinkedLicenses((prev) => prev.filter((l) => l.id !== licRef.id))
      void message.success(t('common.msg.removed'), 3)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('common.msg.removeFailed'), 5)
    }
  }

  const handleLicenseModalConfirm = async () => {
    if (pendingAddLicenses.length === 0) {
      closeLicenseModal()
      return
    }
    setLicenseModalLoading(true)
    try {
      // 批量添加所有待添加的许可证
      for (const license of pendingAddLicenses) {
        await addContentsToLicense(license.id, { content_ids: [licenseModalContent!.id] })
      }
      void message.success(t('trade.content.msg.batchLinked', { count: pendingAddLicenses.length }), 3)
      closeLicenseModal()
      void loadList(pagination.current, pagination.pageSize, filters)
      void loadWithoutLicenseCount()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('trade.content.msg.linkFailed'), 5)
    } finally {
      setLicenseModalLoading(false)
    }
  }

  // ─── Task Assign 弹框 ──────────────────────────────────────────────────────

  const openAssignModal = async (record: ContentListItem) => {
    setAssignRecord(record)
    setAssignModalOpen(true)
    assignForm.resetFields()
    setAssignLoading(true)
    try {
      const [taskData, userData] = await Promise.all([
        getTasks({ page: 1, page_size: 100, content_id: record.id }),
        getUsers({ page: 1, page_size: 500 }),
      ])
      setAssignTasks(taskData.items)
      setUserOptions(
        userData.items.map((u: UserListItem) => ({
          label: u.display_name ? `${u.display_name}（${u.username}）` : u.username,
          value: u.id,
        })),
      )
      // 回显已分配的值：如果所有任务都有相同的 assignee_id，则显示该值
      if (taskData.items.length > 0) {
        const firstAssigneeId = taskData.items[0].assignee_id
        const allSameAssignee = taskData.items.every((task: TaskListItem) => task.assignee_id === firstAssigneeId)
        if (allSameAssignee && firstAssigneeId) {
          assignForm.setFieldsValue({ assignee_id: firstAssigneeId })
        }
      }
    } catch (err) {
      // 错误已由拦截器处理
    } finally {
      setAssignLoading(false)
    }
  }

  const closeAssignModal = () => {
    setAssignModalOpen(false)
    setAssignRecord(null)
    setAssignTasks([])
  }

  const handleAssignSubmit = async () => {
    if (!assignRecord) return
    const values = await assignForm.validateFields()
    const { assignee_id, update_childs } = values as { assignee_id: number; update_childs: boolean }
    // 支持重新分配：处理所有任务，不限于 Not Assigned 状态
    if (assignTasks.length === 0) {
      void message.info(t('trade.content.assign.noTask'), 3)
      return
    }
    setAssignSubmitting(true)
    try {
      for (const task of assignTasks) {
        await assignTask(task.id, { assignee_id, update_childs })
      }
      void message.success(t('trade.content.assign.success'), 3)
      closeAssignModal()
      void loadList(pagination.current, pagination.pageSize, filters)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('trade.content.assign.failed'), 5)
    } finally {
      setAssignSubmitting(false)
    }
  }

  // ─── 表格列定义 ───────────────────────────────────────────────────────────────

  const columns: ColumnsType<ContentListItem> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 70,
      fixed: 'left',
      sorter: true,
      sortOrder: sortField === 'id' ? sortOrder : null,
    },
    {
      title: t('content.col.contentName'),
      dataIndex: 'title',
      key: 'title',
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'title' ? sortOrder : null,
      render: (val: string, record) => (
        <Tooltip title={val}>
          <span
            style={{ color: '#1677ff', cursor: 'pointer' }}
            onClick={() => navigate(record.is_discarded ? `/contents/${record.id}` : `/contents/${record.id}?mode=edit`)}
          >
            {val}
          </span>
        </Tooltip>
      ),
    },
    {
      title: t('content.col.contentType'),
      dataIndex: 'content_type',
      key: 'content_type',
      width: 140,
      sorter: true,
      sortOrder: sortField === 'content_type' ? sortOrder : null,
      render: (val: string) => <Tag>{val}</Tag>,
    },
    {
      title: t('license.addContent.ingestStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 180,
      sorter: true,
      sortOrder: sortField === 'status' ? sortOrder : null,
      render: (val: string) => ingestStatusMap[val] ?? val ?? '—',
    },
    {
      title: t('trade.col.genre'),
      dataIndex: 'genre_name',
      key: 'genre_name',
      width: 140,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'genre_name' ? sortOrder : null,
      render: (val?: string) => <Tooltip title={val ?? ''}><span>{val ?? '—'}</span></Tooltip>,
    },
    {
      title: t('trade.content.col.customTags'),
      dataIndex: 'custom_tag_names',
      key: 'custom_tag_names',
      width: 180,
      ellipsis: { showTitle: false },
      render: (val?: string[]) =>
        val && val.length > 0
          ? <Tooltip title={val.join(', ')}><span>{val.map((n) => <Tag key={n} style={{ marginBottom: 2 }}>{n}</Tag>)}</span></Tooltip>
          : '—',
    },
    {
      title: t('trade.content.col.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 110,
      sorter: true,
      sortOrder: sortField === 'created_at' ? sortOrder : null,
      render: (val?: string) => val ? dayjs(val).format('YYYY-MM-DD') : '—',
    },
    {
      title: t('trade.col.licence'),
      key: 'licence',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Tooltip title={record.license_count > 0 ? `${record.license_count} ${t('trade.content.tooltip.linkedCount')}` : t('trade.content.tooltip.addLicense')}>
          <Button
            type="link"
            size="small"
            disabled={!canOperateLicense || !!record.is_discarded}
            icon={
              record.license_count > 0
                ? <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18 }} />
                : <ExclamationCircleFilled style={{ color: '#bfbfbf', fontSize: 18 }} />
            }
            onClick={() => canOperateLicense && !record.is_discarded && void openLicenseModal(record)}
          />
        </Tooltip>
      ),
    },
    {
      title: t('trade.content.col.licenseStart'),
      dataIndex: 'license_start',
      key: 'license_start',
      width: 110,
      render: (val?: string) => val ?? '—',
    },
    {
      title: t('trade.content.col.licenseEnd'),
      dataIndex: 'license_end',
      key: 'license_end',
      width: 110,
      render: (val?: string) => val ?? '—',
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space size={0}>
          {record.is_discarded ? (
            canViewContent && (
              <Tooltip title={t('common.detail')}>
                <Button
                  type="link"
                  size="small"
                  icon={<InfoCircleOutlined />}
                  onClick={() => navigate(`/trade/contents/${record.id}`)}
                />
              </Tooltip>
            )
          ) : (
            <>
              {canOperateContent && (
                <Tooltip title={t('content.col.assign')}>
                  <Button
                    type="link"
                    size="small"
                    icon={<UserAddOutlined />}
                    onClick={() => void openAssignModal(record)}
                  />
                </Tooltip>
              )}
              {canViewContent && (
                <Tooltip title={t('common.detail')}>
                  <Button
                    type="link"
                    size="small"
                    icon={<InfoCircleOutlined />}
                    onClick={() => navigate(`/trade/contents/${record.id}`)}
                  />
                </Tooltip>
              )}
              {canOperateContent && (
                <Tooltip title={t('common.edit')}>
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openEdit(record)}
                  />
                </Tooltip>
              )}
              {canOperateContent && (
                <Popconfirm
                  title={t('trade.content.form.deleteConfirm')}
                  onConfirm={() => void handleDelete(record)}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                >
                  <Tooltip title={t('common.delete')}>
                    <Button type="link" size="small" icon={<DeleteOutlined />} danger />
                  </Tooltip>
                </Popconfirm>
              )}
            </>
          )}
        </Space>
      ),
    },
  ]

  // 许可证列表列（Add License to Content 弹框左侧）
  const licenseColumns: ColumnsType<LicenseListItem> = [
    {
      title: t('content.col.providerName'),
      dataIndex: 'provider_name',
      key: 'provider_name',
      ellipsis: { showTitle: false },
      render: (val: string) => <Tooltip title={val}><span>{val}</span></Tooltip>,
    },
    {
      title: t('content.col.contractName'),
      dataIndex: 'contract_name',
      key: 'contract_name',
      ellipsis: { showTitle: false },
      render: (val: string) => <Tooltip title={val}><span>{val}</span></Tooltip>,
    },
    {
      title: t('content.col.licenseName'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: { showTitle: false },
      render: (val: string) => <Tooltip title={val}><span>{val}</span></Tooltip>,
    },
    {
      title: t('content.col.serviceType'),
      dataIndex: 'service_type',
      key: 'service_type',
      width: 110,
    },
    {
      title: t('content.col.startDate'),
      dataIndex: 'start_date',
      key: 'start_date',
      width: 100,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('content.col.endDate'),
      dataIndex: 'end_date',
      key: 'end_date',
      width: 100,
      render: (v?: string) => v ?? '—',
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_, record) => {
        const isLinked = linkedLicenses.some((l) => l.id === record.id)
        const isPending = pendingAddLicenses.some((l) => l.id === record.id)
        return (
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => handleAddLicense(record)}
            disabled={isLinked || isPending}
          />
        )
      },
    },
  ]

  // ─── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div className="main-container">
      {/* 搜索区域 */}
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

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {canOperateContent && selectedRowKeys.length > 0 && (
            <Popconfirm
              title={t('trade.content.form.batchDeleteConfirm', { count: selectedRowKeys.length })}
              onConfirm={() => void handleBatchDelete()}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button danger loading={deleteLoading} icon={<DeleteOutlined />}>
                {t('trade.content.toolbar.batchDelete')} ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canOperateContent && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {t('trade.content.toolbar.newContent')}
            </Button>
          )}
        </div>
      </div>

      {/* 列表 */}
      <Table<ContentListItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={contents}
        scroll={{ x: 1300 }}
        pagination={tablePaginationProps}
        onChange={handleTableChange}
        size="small"
        rowSelection={
          canOperateContent
            ? {
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
                getCheckboxProps: (record) => ({
                  disabled: !!record.is_discarded,
                }),
              }
            : undefined
        }
      />

      {/* ── 新增弹框 ─────────────────────────────────────────────────────── */}
      <Modal
        title={t('trade.content.modal.titleCreate')}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        confirmLoading={modalLoading}
        destroyOnHidden
        width={720}
      >
        <Form form={itemForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            {/* Content Name */}
            <Col span={12}>
              <Form.Item
                name="title"
                label={t('content.col.contentName')}
                rules={[{ required: true, message: t('trade.content.form.nameRequired') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
              >
                <TrimInput placeholder={t('trade.content.form.nameRequired')} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            {/* Content Type */}
            <Col span={12}>
              <Form.Item
                name="content_type"
                label={t('content.col.contentType')}
                rules={[{ required: true, message: t('trade.content.form.typeRequired') }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder={t('trade.content.form.typeRequired')}
                  options={CONTENT_TYPES}
                  style={{ width: '100%' }}
                  onChange={() => {
                    itemForm.setFieldsValue({
                      parent_id: undefined,
                      sequence: undefined,
                      volumn_count: undefined,
                      begin_time: undefined,
                      end_time: undefined,
                    })
                    setSeasonRows([])
                  }}
                />
              </Form.Item>
            </Col>

            {/* Genre */}
            <Col span={12}>
              <Form.Item name="genre_id" label={t('trade.col.genre')}>
                <Select
                  allowClear
                  showSearch
                  placeholder={t('trade.content.search.genre')}
                  options={genreOptions}
                  filterOption={(input, opt) =>
                    String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>

            {/* Custom_Tags */}
            <Col span={12}>
              <Form.Item name="custom_tag_ids" label={t('menu.basic.customTags')}>
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  placeholder={t('metadata.channel.customTagsPlaceholder')}
                  options={customTagOptions}
                  filterOption={(input, opt) =>
                    String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>

            {/* ── EPISODE 专属字段 ──────────────────────────────── */}
            {currentType === 'EPISODE' && (
              <>
                <Col span={12}>
                  <Form.Item
                    name="parent_id"
                    label={t('trade.content.form.parentSeries')}
                    rules={[{ required: true, message: t('trade.content.form.parentRequired') }]}
                  >
                    <Select
                      showSearch
                      allowClear
                      placeholder={t('trade.content.form.parentRequired')}
                      options={seriesOptions.map((s) => ({ label: s.title, value: s.id }))}
                      filterOption={(input, opt) =>
                        String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="sequence"
                    label={t('content.col.sequence')}
                    rules={[{ required: true, message: t('trade.content.form.sequenceRequired') }]}
                  >
                    <InputNumber min={1} placeholder={t('content.col.sequence')} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </>
            )}

            {/* ── SERIES 专属字段 ────────────────────────────────── */}
            {currentType === 'SERIES' && (
              <Col span={12}>
                <Form.Item
                  name="volumn_count"
                  label={t('trade.content.form.volumnCount')}
                  rules={[{ required: true, message: t('trade.content.form.episodeCountRequired') }]}
                >
                  <InputNumber min={1} max={999} placeholder={t('trade.content.form.episodeCountRequired')} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            )}

            {/* ── SEASON 专属字段 ────────────────────────────────── */}
            {currentType === 'SEASON' && (
              <>
                <Col span={24}>
                  <Form.Item
                    name="volumn_count"
                    label={t('trade.content.form.seasonCount')}
                    rules={[{ required: true, message: t('trade.content.form.seasonCountRequired') }]}
                  >
                    <InputNumber min={1} max={50} placeholder={t('trade.content.form.seasonCountRequired')} style={{ width: 200 }} />
                  </Form.Item>
                </Col>
                {seasonRows.length > 0 && (
                  <Col span={24}>
                    <Divider titlePlacement="left" style={{ margin: '8px 0' }}>{t('trade.content.form.seasonDetails')}</Divider>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'center', padding: '4px 8px', background: '#fafafa', border: '1px solid #f0f0f0', width: 80 }}>{t('content.col.seriesOrdinal')}</th>
                          <th style={{ textAlign: 'center', padding: '4px 8px', background: '#fafafa', border: '1px solid #f0f0f0' }}>{t('trade.content.form.episodeCount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seasonRows.map((row, idx) => (
                          <tr key={row.series_ordinal}>
                            <td style={{ textAlign: 'center', padding: '4px 8px', border: '1px solid #f0f0f0' }}>
                              {row.series_ordinal}
                            </td>
                            <td style={{ padding: '4px 8px', border: '1px solid #f0f0f0' }}>
                              <InputNumber
                                min={0}
                                max={999}
                                value={row.episode_count}
                                style={{ width: '100%' }}
                                onChange={(val) => {
                                  const updated = [...seasonRows]
                                  updated[idx] = { ...updated[idx], episode_count: val ?? 0 }
                                  setSeasonRows(updated)
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Col>
                )}
              </>
            )}

            {/* ── SCHEDULE 专属字段 ─────────────────────────────── */}
            {currentType === 'SCHEDULE' && (
              <>
                <Col span={12}>
                  <Form.Item
                    name="parent_id"
                    label={t('trade.content.form.channelName')}
                    rules={[{ required: true, message: t('trade.content.form.channelRequired') }]}
                  >
                    <Select
                      showSearch
                      allowClear
                      placeholder={t('trade.content.form.channelRequired')}
                      options={channelOptions.map((c) => ({ label: c.title, value: c.id }))}
                      filterOption={(input, opt) =>
                        String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="begin_time"
                    label={t('trade.content.form.beginTime')}
                    rules={[{ required: true, message: t('trade.content.form.beginTimeRequired') }]}
                  >
                    <DatePicker showTime style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="end_time"
                    label={t('trade.content.form.endTime')}
                    dependencies={['begin_time']}
                    rules={[
                      { required: true, message: t('trade.content.form.endTimeRequired') },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          const beginTime = getFieldValue('begin_time')
                          if (!value || !beginTime || value.isAfter(beginTime)) {
                            return Promise.resolve()
                          }
                          return Promise.reject(new Error(t('trade.content.form.endTimeAfterBegin')))
                        },
                      }),
                    ]}
                  >
                    <DatePicker showTime style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>
        </Form>
      </Modal>

      {/* ── Add License to Content 弹框（左右两栏）─────────────────────────── */}
      <Modal
        title={t('trade.content.modal.addLicense')}
        open={licenseModalOpen}
        onCancel={closeLicenseModal}
        onOk={handleLicenseModalConfirm}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
        width={1100}
        confirmLoading={licenseModalLoading}
      >
        <div style={{ display: 'flex', gap: 16, minHeight: 400 }}>
          {/* 左侧 — 许可证搜索与选择 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Form
              form={licenseSearchForm}
              layout="inline"
              style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}
            >
              <Form.Item name="provider_id" style={{ flex: '1 1 160px', marginBottom: 8 }}>
                <Select
                  allowClear
                  showSearch
                  placeholder={t('trade.content.search.providerPlaceholder')}
                  options={providerOptions.map((p) => ({ label: p.name, value: p.id }))}
                  filterOption={(input, opt) =>
                    String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Form.Item name="contract_id" style={{ flex: '1 1 160px', marginBottom: 8 }}>
                <Select
                  allowClear
                  showSearch
                  placeholder={t('trade.content.search.contractPlaceholder')}
                  options={contractOptions.map((c) => ({ label: c.name, value: c.id }))}
                  filterOption={(input, opt) =>
                    String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Form.Item name="name" style={{ flex: '1 1 160px', marginBottom: 8 }} rules={[formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                <TrimInput placeholder={t('trade.content.search.license')} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item style={{ marginBottom: 8 }}>
                <Space>
                  <Button
                    type="primary"
                    onClick={() => void loadAvailableLicenses(1, licenseSearchForm.getFieldsValue() as Record<string, unknown>)}
                  >
                    {t('common.search')}
                  </Button>
                  <Button
                    onClick={() => {
                      licenseSearchForm.resetFields()
                      void loadAvailableLicenses(1, {})
                    }}
                  >
                    {t('common.reset')}
                  </Button>
                  {canOperateLicense && (
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => setCreateLicenseModalOpen(true)}
                    >
                      {t('trade.addContent.newLicense')}
                    </Button>
                  )}
                </Space>
              </Form.Item>
            </Form>
            <Table<LicenseListItem>
              rowKey="id"
              size="small"
              loading={licensesLoading}
              columns={licenseColumns}
              dataSource={availableLicenses}
              scroll={{ x: 600 }}
              pagination={{
                current: licensePage,
                pageSize: 10,
                total: licenseTotal,
                showSizeChanger: false,
                position: ['bottomCenter'],
                size: 'small',
                onChange: (p) => void loadAvailableLicenses(p, licenseSearchForm.getFieldsValue() as Record<string, unknown>),
              }}
            />
          </div>

          {/* 右侧 — 当前内容信息及已关联许可证 */}
          <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid #f0f0f0', paddingLeft: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{t('content.col.contentName')}</div>
              <div style={{ fontWeight: 500 }}>{licenseModalContent?.title ?? '—'}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{t('content.col.contentType')}</div>
              <Tag>{licenseModalContent?.content_type ?? '—'}</Tag>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{t('trade.col.genre')}</div>
              <div>{licenseModalContent?.genre_name ?? '—'}</div>
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
              {t('trade.content.label.licensesForContent')}
            </div>
            {linkedLicenses.length === 0 && pendingAddLicenses.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('trade.content.empty.noLicenses')} style={{ marginTop: 16 }} />
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {/* 待添加的许可证 */}
                {pendingAddLicenses.map((lic) => (
                  <div
                    key={`pending-${lic.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      borderBottom: '1px solid #f5f5f5',
                      color: '#52c41a',
                    }}
                  >
                    <Tooltip title={lic.name}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                        {lic.name}
                      </span>
                    </Tooltip>
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<MinusCircleOutlined />}
                      onClick={() => handleRemovePendingLicense(lic.id)}
                    />
                  </div>
                ))}
                {/* 已关联的许可证 */}
                {linkedLicenses.map((lic) => (
                  <div
                    key={lic.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      borderBottom: '1px solid #f5f5f5',
                    }}
                  >
                    <Tooltip title={lic.name}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                        {lic.name}
                      </span>
                    </Tooltip>
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<MinusCircleOutlined />}
                      onClick={() => void handleRemoveLicense(lic)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ── Task Assign 弹框 ─────────────────────────────────────────────────── */}
      <Modal
        title={t('trade.content.assign.title')}
        open={assignModalOpen}
        onCancel={closeAssignModal}
        onOk={() => void handleAssignSubmit()}
        confirmLoading={assignSubmitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
        width={520}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{t('content.col.contentName')}</div>
          <div style={{ fontWeight: 500 }}>{assignRecord?.title ?? '—'}</div>
        </div>
        {assignLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>{t('common.loading') ?? 'Loading...'}</div>
        ) : assignTasks.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('trade.content.assign.noTask')} />
        ) : (
          <Form form={assignForm} layout="vertical">
            <Form.Item
              name="assignee_id"
              label={t('trade.content.assign.assignTo')}
              rules={[{ required: true, message: t('trade.content.assign.assignToPlaceholder') }]}
            >
              <Select
                showSearch
                placeholder={t('trade.content.assign.assignToPlaceholder')}
                options={userOptions}
                filterOption={(input, opt) =>
                  String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                style={{ width: '100%' }}
              />
            </Form.Item>
            {/* 仅当存在子内容时才显示同步更新子内容开关 */}
            {assignRecord && (assignRecord.volumn_count ?? 0) > 0 && (
              <Form.Item
                name="update_childs"
                label={t('trade.content.assign.updateChilds')}
                valuePropName="checked"
                initialValue={false}
              >
                <Switch />
              </Form.Item>
            )}
            <div style={{ fontSize: 12, color: '#999' }}>
              {t('task.col.taskType')}: {assignTasks.map((task) => task.task_type).join(', ')}
            </div>
          </Form>
        )}
      </Modal>

      {/* 新增许可证弹窗 */}
      <CreateLicenseModal
        open={createLicenseModalOpen}
        onClose={() => setCreateLicenseModalOpen(false)}
        onSuccess={() => {
          setCreateLicenseModalOpen(false)
          // 刷新许可证列表
          if (licenseModalContent) {
            void loadAvailableLicenses(1, licenseSearchForm.getFieldsValue() as Record<string, unknown>)
          }
        }}
      />

      {/* 编辑内容弹窗 */}
      <EditContentModal
        open={editModalOpen}
        contentId={editContentId}
        onClose={() => {
          setEditModalOpen(false)
          setEditContentId(null)
        }}
        onSuccess={handleEditSuccess}
      />
    </div>
  )
}
