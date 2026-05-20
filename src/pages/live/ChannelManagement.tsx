/**
 * ChannelManagement — 直播管理 频道管理列表页（LTV Channels）
 *
 * 需求规范（3.5.1.2）：
 *  - 仅展示 Content Type = CHANNEL 的内容
 *  - 搜索：Channel Name / Channel Number(占位) / Ingest Status(数据字典) / Genre(多选) /
 *          Custom Tags(多选) / Language(占位) / Category(文本) / Package(多选) /
 *          Provider(多选) / License Start/End Date(范围) / Publish Date(占位) / Takedown Date(占位)
 *  - 列表列：Channel Name / Genre / Custom Tags / Category / Package /
 *            License Start / License End / Action
 *  - Action：Detail(i) / Edit(铅笔) / Poster(图片) / Add Schedule(+)
 *  - 海报 entityType = "channel"
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Space,
  Table,
  Tooltip,
  message,
} from 'antd'
import {
  EditOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getChannels } from '../../api/live'
import { getGenres } from '../../api/genres'
import { getProvidersSimple } from '../../api/providers'
import { getCategoryTree } from '../../api/categories'
import { getPackages } from '../../api/packages'
import { getCustomTags } from '../../api/customTags'
import { getDictTree } from '../../api/dicts'
import PostersModal from '../../components/PostersModal'
import SearchForm from '../../components/SearchForm'
import ScheduleCreateModal from '../../components/ScheduleCreateModal'
import type { ChannelListItem, ChannelQueryParams } from '../../types/live'
import type { CategoryListItem, CustomTagListItem, GenreListItem } from '../../types/basic'
import type { DictNodeListItem } from '../../types/dict'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'

// ─── 常量 ────────────────────────────────────────────────────────────────────

interface SearchValues {
  title?: string
  channel_number?: string
  statuses?: string[]
  genre_ids?: number[]
  provider_ids?: number[]
  package_ids?: number[]
  category_name?: string
  custom_tag_ids?: number[]
  languages?: string[]
  license_start_range?: [dayjs.Dayjs, dayjs.Dayjs]
  license_end_range?: [dayjs.Dayjs, dayjs.Dayjs]
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function ChannelManagement() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.live.channels.operate')
  const canScheduleOperate = hasPermission('menu.live.schedules.operate')

  const [channels, setChannels] = useState<ChannelListItem[]>([])
  const [loading, setLoading] = useState(false)
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filters, sortField, sortOrder)
    },
  })

  const [genreOptions, setGenreOptions] = useState<{ label: string; value: number }[]>([])
  const [providerOptions, setProviderOptions] = useState<{ label: string; value: number }[]>([])
  const [packageOptions, setPackageOptions] = useState<{ label: string; value: number }[]>([])
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: number }[]>([])
  const [customTagOptions, setCustomTagOptions] = useState<{ label: string; value: number }[]>([])
  const [ingestStatusOptions, setIngestStatusOptions] = useState<{ label: string; value: string }[]>([])
  const [languageOptions, setLanguageOptions] = useState<{ label: string; value: string }[]>([])

  // 新增节目单弹框
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [presetChannelId, setPresetChannelId] = useState<number | null>(null)
  const [presetChannelTitle, setPresetChannelTitle] = useState<string>('')

  // 海报弹框
  const [postersOpen, setPostersOpen] = useState(false)
  const [postersTarget, setPostersTarget] = useState<{ id: number; title: string } | null>(null)

  // ─── 搜索字段配置 ───────────────────────────────────────────────────────────

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'title',
      labelKey: 'common.col.channelName',
      type: 'input',
      placeholderKey: 'common.placeholder.channelKeyword',
    },
    // TODO（需求 3.5.1.2）：Channel Number 搜索（来源 ChannelMetadata.channel_number）
    {
      name: 'channel_number',
      labelKey: 'common.col.channelNumber',
      type: 'input',
      placeholderKey: 'common.placeholder.enter',
    },
    {
      name: 'statuses',
      labelKey: 'common.col.ingestStatus',
      type: 'multiSelect',
      options: ingestStatusOptions,
    },
    {
      name: 'genre_ids',
      labelKey: 'common.col.genre',
      type: 'multiSelect',
      options: genreOptions,
    },
    {
      name: 'custom_tag_ids',
      labelKey: 'common.col.customTags',
      type: 'multiSelect',
      options: customTagOptions,
    },
    // 语言多选（需求 3.5.1.2）：数据字典 Language
    {
      name: 'languages',
      labelKey: 'common.col.language',
      type: 'multiSelect',
      options: languageOptions,
    },
    {
      name: 'category_name',
      labelKey: 'common.col.category',
      type: 'input',
      placeholderKey: 'common.placeholder.enter',
    },
    {
      name: 'package_ids',
      labelKey: 'common.col.package',
      type: 'multiSelect',
      options: packageOptions,
    },
    {
      name: 'provider_ids',
      labelKey: 'common.col.provider',
      type: 'multiSelect',
      options: providerOptions,
    },
    {
      name: 'license_start_range',
      labelKey: 'common.col.licenseStart',
      type: 'dateRange',
    },
    {
      name: 'license_end_range',
      labelKey: 'common.col.licenseEnd',
      type: 'dateRange',
    },
    // TODO（需求 3.5.1.2）：Publish/Takedown Date 需发布管理落库后再启用
    {
      name: '_publish_range',
      labelKey: 'common.col.publishDate',
      type: 'dateRange',
      disabled: true,
    },
    {
      name: '_takedown_range',
      labelKey: 'common.col.takedownDate',
      type: 'dateRange',
      disabled: true,
    },
  ], [genreOptions, providerOptions, packageOptions, categoryOptions, customTagOptions, ingestStatusOptions, languageOptions, t])

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
  } = useSearchForm<SearchValues>({
    onSearch: (values) => {
      const params: ChannelQueryParams = {}
      if (values.title) params.title = values.title
      if (values.channel_number) params.channel_number = values.channel_number
      if (values.statuses?.length) params.statuses = values.statuses
      if (values.genre_ids?.length) params.genre_ids = values.genre_ids
      if (values.provider_ids?.length) params.provider_ids = values.provider_ids
      if (values.package_ids?.length) params.package_ids = values.package_ids
      if (values.category_name) params.category_name = values.category_name
      if (values.custom_tag_ids?.length) params.custom_tag_ids = values.custom_tag_ids
      if (values.languages?.length) params.languages = values.languages
      if (values.license_start_range?.[0]) {
        params.license_start_from = values.license_start_range[0].format('YYYY-MM-DD')
        params.license_start_to = values.license_start_range[1].format('YYYY-MM-DD')
      }
      if (values.license_end_range?.[0]) {
        params.license_end_from = values.license_end_range[0].format('YYYY-MM-DD')
        params.license_end_to = values.license_end_range[1].format('YYYY-MM-DD')
      }
      setFilters(params)
      resetSort()
      void loadList(1, pagination.pageSize, params, null, null)
    },
    onReset: () => {
      setFilters({})
      resetSort()
      void loadList(1, pagination.pageSize, {}, null, null)
    },
    fieldsCount: searchFields.length,
  })

  // ─── 初始化 ────────────────────────────────────────────────────────────────

  useEffect(() => {
    void loadOptions()
    void loadList(1, pagination.pageSize, {})
  }, [])

  const loadOptions = async () => {
    try {
      const [genres, providers, packages, customTags, categories, dicts] = await Promise.all([
        getGenres({ page: 1, page_size: 500 }),
        getProvidersSimple(),
        getPackages({ page: 1, page_size: 500 }),
        getCustomTags({ page: 1, page_size: 500 }),
        getCategoryTree(),
        getDictTree(),
      ])
      setGenreOptions(genres.items.map((g: GenreListItem) => ({ label: g.name, value: g.id })))
      setProviderOptions(providers.map((p) => ({ label: p.name, value: p.id })))
      setPackageOptions(packages.items.map((p) => ({ label: p.name, value: p.id })))
      setCustomTagOptions(customTags.items.map((ct: CustomTagListItem) => ({ label: ct.name, value: ct.id })))
      // 栏目是树形，此处拍平成一级选项
      const flatCategories: { label: string; value: number }[] = []
      const flatten = (nodes: CategoryListItem[], prefix = ''): void => {
        nodes.forEach((n) => {
          flatCategories.push({ label: prefix + n.name, value: n.id })
          if (n.children?.length) flatten(n.children, prefix + n.name + ' / ')
        })
      }
      flatten(categories)
      setCategoryOptions(flatCategories)
      // Ingest 状态选项来源于数据字典 Ingest_Status
      const ingestRoot = dicts.find((d: DictNodeListItem) => d.code === 'Ingest_Status')
      setIngestStatusOptions((ingestRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })))
      // 语言选项来源于数据字典 Language
      const languageRoot = dicts.find((d: DictNodeListItem) => d.code === 'Language')
      setLanguageOptions((languageRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })))
    } catch (err) { /* 不阻塞 */ }
  }

  const navigateToChannel = (channelId: number, mode?: string) => {
    sessionStorage.removeItem('channel_list_context')
    sessionStorage.setItem(
      'channel_list_context',
      JSON.stringify({ ids: channels.map((c) => c.id) })
    )
    const params = new URLSearchParams()
    if (mode) params.set('mode', mode)
    navigate(`/live/channels/${channelId}?${params.toString()}`)
  }

  const loadList = async (p: number, ps: number, params: ChannelQueryParams, sortBy?: string | null, sortOrd?: 'ascend' | 'descend' | null) => {
    setLoading(true)
    try {
      const res = await getChannels({
        ...params,
        page: p,
        page_size: ps,
        sort_by: sortBy ?? undefined,
        sort_order: sortOrd ? (sortOrd === 'ascend' ? 'asc' : 'desc') : undefined,
      })
      setChannels(res.items)
      updatePagination(res)
    } catch (err) {
    } finally {
      setLoading(false)
    }
  }


  // 打开"添加节目"弹框（从频道行触发，预填频道且只读）
  const openAddSchedule = (channel: ChannelListItem) => {
    setPresetChannelId(channel.id)
    setPresetChannelTitle(channel.title)
    setScheduleModalOpen(true)
  }

  // ─── 列定义 ───────────────────────────────────────────────────────────────

  const columns: ColumnsType<ChannelListItem> = [
    {
      title: t('common.col.channelName'),
      dataIndex: 'title',
      key: 'title',
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'title' ? sortOrder : null,
      render: (v: string, record) => (
        <Tooltip title={v}>
          <a onClick={() => navigateToChannel(record.id)}>{v}</a>
        </Tooltip>
      ),
    },
    {
      title: t('common.col.genre'),
      dataIndex: 'genre_name',
      key: 'genre_name',
      width: 180,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'genre_name' ? sortOrder : null,
      render: (v?: string) => <Tooltip title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
    },
    {
      title: t('common.col.customTags'),
      dataIndex: 'custom_tag_names',
      key: 'custom_tag_names',
      width: 180,
      ellipsis: { showTitle: false },
      render: (names: string[]) => {
        const text = names.length ? names.join(', ') : '—'
        return <Tooltip title={text}><span>{text}</span></Tooltip>
      },
    },
    {
      title: t('common.col.category'),
      dataIndex: 'category_names',
      key: 'category_names',
      width: 180,
      ellipsis: { showTitle: false },
      render: (names: string[]) => {
        const text = names.length ? names.join(', ') : '—'
        return <Tooltip title={text}><span>{text}</span></Tooltip>
      },
    },
    {
      title: t('common.col.package'),
      dataIndex: 'package_names',
      key: 'package_names',
      width: 200,
      ellipsis: { showTitle: false },
      render: (names: string[]) => {
        const text = names.length ? names.join(', ') : '—'
        return <Tooltip title={text}><span>{text}</span></Tooltip>
      },
    },
    {
      title: t('common.col.licenseStart'),
      dataIndex: 'license_start',
      key: 'license_start',
      width: 140,
      ellipsis: { showTitle: false },
      render: (v?: string) => <Tooltip title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
    },
    {
      title: t('common.col.licenseEnd'),
      dataIndex: 'license_end',
      key: 'license_end',
      width: 140,
      ellipsis: { showTitle: false },
      render: (v?: string) => <Tooltip title={v ?? '—'}><span>{v ?? '—'}</span></Tooltip>,
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title={t('common.detail')}>
            <Button type="link" size="small" icon={<InfoCircleOutlined />}
              onClick={() => navigateToChannel(record.id, 'view')} />
          </Tooltip>
          {canOperate && (
            <Tooltip title={t('common.edit')}>
              <Button type="link" size="small" icon={<EditOutlined />}
                onClick={() => navigateToChannel(record.id, 'edit')} />
            </Tooltip>
          )}
          <Tooltip title={t('common.tooltip.posterManagement')}>
            <Button type="link" size="small" icon={<PictureOutlined />}
              onClick={() => { setPostersTarget({ id: record.id, title: record.title }); setPostersOpen(true) }} />
          </Tooltip>
          {canScheduleOperate && (
            <Tooltip title={t('common.tooltip.addSchedule')}>
              <Button type="link" size="small" icon={<PlusOutlined />}
                onClick={() => openAddSchedule(record)} />
            </Tooltip>
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
      <Table<ChannelListItem>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={channels}
        loading={loading}
        scroll={{ x: 1300 }}
        pagination={tablePaginationProps}
        onChange={handleTableChange}
      />

      {/* 新增节目单弹框 */}
      <ScheduleCreateModal
        open={scheduleModalOpen}
        channelId={presetChannelId ?? undefined}
        channelName={presetChannelTitle}
        onClose={() => setScheduleModalOpen(false)}
        onSuccess={() => {
          setScheduleModalOpen(false)
          void message.success(t('live.channel.msg.scheduleCreated'), 3)
        }}
      />

      {/* 海报管理弹框 */}
      {postersTarget && (
        <PostersModal
          open={postersOpen}
          entityType="channel"
          entityId={postersTarget.id}
          entityName={postersTarget.title}
          readOnly={!canOperate}
          onClose={() => { setPostersOpen(false); setPostersTarget(null) }}
        />
      )}
    </div>
  )
}
