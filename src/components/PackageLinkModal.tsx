/**
 * PackageLinkModal — 注入服务包弹框（Allocate Content to Package）
 *
 * 适用于所有 Content Type。
 * 页面布局同服务管理列表页面，无 Action 列。
 * 左侧复选框勾选/取消后点击确定，批量保存关联变更（新增 + 删除）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Col,
  Empty,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { getDictTree } from '../api/dicts'
import { getPackages } from '../api/packages'
import { getContentPackages, linkContentPackages, unlinkContentPackage } from '../api/live'
import { useI18n } from '../i18n/useI18n'
import TrimInput from './TrimInput'
import PackageCreateModal from './PackageCreateModal'
import type { PackageListItem } from '../types/package'
import type { DictNodeListItem } from '../types/dict'
import type { ContentPackageRef } from '../types/live'
import { isHandledError } from '../api'
import { useTablePagination } from '../hooks/useTablePagination'


interface PackageLinkModalProps {
  open: boolean
  contentId: number
  contentName: string
  readOnly?: boolean
  onClose: () => void
  onSuccess?: () => void
}

const getIngestTagColor = (val: string) => {
  if (val === 'success') return 'success'
  if (val === 'failure') return 'error'
  return 'default'
}

export default function PackageLinkModal({
  open,
  contentId,
  readOnly = false,
  onClose,
  onSuccess,
}: PackageLinkModalProps) {
  const { t } = useI18n()

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [list, setList] = useState<PackageListItem[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [originalLinkedIds, setOriginalLinkedIds] = useState<Set<number>>(new Set())
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const prevOpenRef = useRef(false)

  const [searchName, setSearchName] = useState('')
  const [searchType, setSearchType] = useState<string | undefined>(undefined)
  const [searchPlatforms, setSearchPlatforms] = useState<string[]>([])
  const [searchIngestStatuses, setSearchIngestStatuses] = useState<string[]>([])
  const [searchDescription, setSearchDescription] = useState('')
  const searchRef = useRef({ name: '', type: undefined as string | undefined, platforms: [] as string[], ingestStatuses: [] as string[], description: '' })

  const {
    pagination,
    updatePagination,
    resetPagination,
    tablePaginationProps,
    handleTableChange,
  } = useTablePagination({
    onChange: ({ page, pageSize }) => {
      void loadList(page, pageSize, searchRef.current.name, searchRef.current.type, searchRef.current.platforms)
    },
  })

  // 下拉选项
  const [packageTypeOptions, setPackageTypeOptions] = useState<{ label: string; value: string }[]>([])
  const [platformOptions, setPlatformOptions] = useState<{ label: string; value: string }[]>([])
  const [packageTypeMap, setPackageTypeMap] = useState<Record<string, string>>({})
  const ingestStatusOptions = useMemo(
    () => [
      { label: 'none', value: 'none' },
      { label: 'processing', value: 'processing' },
      { label: 'success', value: 'success' },
      { label: 'failure', value: 'failure' },
    ],
    []
  )

  // 加载字典选项
  const loadOptions = useCallback(async () => {
    try {
      const dicts = await getDictTree()
      const pkgTypeRoot = dicts.find((d: DictNodeListItem) => d.code === 'Package_Type')
      const platformRoot = dicts.find((d: DictNodeListItem) => d.code === 'Platform')
      const pkgTypeChildren = pkgTypeRoot?.children ?? []
      setPackageTypeOptions(
        pkgTypeChildren.map((c: DictNodeListItem) => ({ label: c.name, value: c.code })),
      )
      setPackageTypeMap(
        Object.fromEntries(pkgTypeChildren.map((c: DictNodeListItem) => [c.code, c.name])),
      )
      setPlatformOptions(
        (platformRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })),
      )
    } catch (err) {
      // 静默处理，下拉留空
    }
  }, [])

  // 加载当前内容已关联的服务包 ID
  const loadLinkedPackages = useCallback(async () => {
    try {
      const data = await getContentPackages(contentId)
      const ids = new Set(data.map((p: ContentPackageRef) => p.id))
      setOriginalLinkedIds(ids)
      setSelectedIds(Array.from(ids))
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
      if (detail) void message.error(detail, 5)
      else void message.error(t('content.packageLink.loadLinkedFailed'), 5)
      setOriginalLinkedIds(new Set())
      setSelectedIds([])
    }
  }, [contentId, t])

  // 加载服务包列表
  const loadList = useCallback(
    async (
      currentPage = pagination.current,
      currentPageSize = pagination.pageSize,
      currentName = searchRef.current.name,
      currentType = searchRef.current.type,
      currentPlatforms = searchRef.current.platforms,
      currentIngestStatuses = searchRef.current.ingestStatuses,
      currentDescription = searchRef.current.description,
    ) => {
      setLoading(true)
      try {
        const result = await getPackages({
          page: currentPage,
          page_size: currentPageSize,
          name: currentName || undefined,
          package_type: currentType,
          platforms: currentPlatforms.length > 0 ? currentPlatforms : undefined,
          ingest_statuses: currentIngestStatuses.length > 0 ? currentIngestStatuses : undefined,
          description: currentDescription || undefined,
        })
        // 将已选中的项目排在最前面
        const sortedItems = [...result.items].sort((a, b) => {
          const aSelected = selectedIds.includes(a.id) ? 0 : 1
          const bSelected = selectedIds.includes(b.id) ? 0 : 1
          return aSelected - bSelected
        })
        setList(sortedItems)
        updatePagination(result)
      } catch (err) {
        if (isHandledError(err)) return
        void message.error(t('content.packageLink.loadFailed'), 5)
      } finally {
        setLoading(false)
      }
    },
    [pagination.current, pagination.pageSize, updatePagination, t, selectedIds],
  )

  // 弹窗打开时初始化
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setSearchName('')
      setSearchType(undefined)
      setSearchPlatforms([])
      setSearchIngestStatuses([])
      setSearchDescription('')
      searchRef.current = { name: '', type: undefined, platforms: [], ingestStatuses: [], description: '' }
      resetPagination()
      void loadOptions()
      void loadLinkedPackages()
      void loadList(1)
    }
    prevOpenRef.current = open
  }, [open])

  // 当选中状态变化时，重新排序列表
  useEffect(() => {
    if (open && list.length > 0) {
      const sortedItems = [...list].sort((a, b) => {
        const aSelected = selectedIds.includes(a.id) ? 0 : 1
        const bSelected = selectedIds.includes(b.id) ? 0 : 1
        return aSelected - bSelected
      })
      setList(sortedItems)
    }
  }, [selectedIds])

  const handleSearch = () => {
    searchRef.current = { name: searchName, type: searchType, platforms: searchPlatforms, ingestStatuses: searchIngestStatuses, description: searchDescription }
    resetPagination()
    void loadList(1, undefined, searchName, searchType, searchPlatforms, searchIngestStatuses, searchDescription)
  }

  const handleReset = () => {
    setSearchName('')
    setSearchType(undefined)
    setSearchPlatforms([])
    setSearchIngestStatuses([])
    setSearchDescription('')
    searchRef.current = { name: '', type: undefined, platforms: [], ingestStatuses: [], description: '' }
    resetPagination()
    void loadList(1)
  }

  const handleSubmit = async () => {
    const toAdd = selectedIds.filter((id) => !originalLinkedIds.has(id))
    const toRemove = Array.from(originalLinkedIds).filter((id) => !selectedIds.includes(id))

    if (toAdd.length === 0 && toRemove.length === 0) {
      void message.warning(t('content.packageLink.noChange'), 3)
      return
    }

    setSubmitting(true)
    try {
      // 新增关联
      if (toAdd.length > 0) {
        await linkContentPackages(contentId, toAdd)
      }
      // 删除关联
      for (const pid of toRemove) {
        await unlinkContentPackage(contentId, pid)
      }
      void message.success(t('content.packageLink.linkSuccess'), 3)
      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
      if (detail) void message.error(detail, 5)
      else void message.error(t('content.packageLink.linkFailed'), 5)
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnsType<PackageListItem> = useMemo(
    () => [
      {
        title: t('package.col.name'),
        dataIndex: 'name',
        key: 'name',
        ellipsis: { showTitle: false },
        render: (val: string) => (
          <Tooltip title={val}>
            <span>{val}</span>
          </Tooltip>
        ),
      },
      {
        title: t('package.col.type'),
        dataIndex: 'package_type',
        key: 'package_type',
        width: 140,
        render: (val: string) => packageTypeMap[val] ?? val,
      },
      {
        title: t('package.col.platform'),
        dataIndex: 'platforms',
        key: 'platforms',
        width: 200,
        render: (vals: string[]) => (
          <Space size={4} wrap>
            {vals.map((v) => (
              <Tag key={v}>{platformOptions.find((o) => o.value === v)?.label ?? v}</Tag>
            ))}
          </Space>
        ),
      },
      {
        title: t('package.col.description'),
        dataIndex: 'description',
        key: 'description',
        ellipsis: { showTitle: false },
        render: (val: string | null) => (
          <Tooltip title={val ?? ''}>
            <span>{val ?? '—'}</span>
          </Tooltip>
        ),
      },
      {
        title: t('package.col.ingestStatus'),
        dataIndex: 'ingest_status',
        key: 'ingest_status',
        width: 140,
        render: (val: string) => <Tag color={getIngestTagColor(val)}>{val}</Tag>,
      },
    ],
    [t, packageTypeMap, platformOptions],
  )

  return (
    <Modal
      title={t('content.packageLink.title')}
      open={open}
      onCancel={onClose}
      width={960}
      destroyOnHidden
      maskClosable={false}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          {!readOnly && (
            <Button type="primary" onClick={() => void handleSubmit()} loading={submitting}>
              {t('common.confirm')}
            </Button>
          )}
        </div>
      }
    >
      {/* 搜索区域 */}
      <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
        <Col span={4}>
          <TrimInput
            placeholder={t('common.placeholder.packageKeyword')}
            value={searchName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchName(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
          />
        </Col>
        <Col span={4}>
          <Select
            showSearch
            optionFilterProp="label"
            allowClear
            placeholder={t('package.placeholder.type')}
            value={searchType}
            options={packageTypeOptions}
            onChange={(val) => setSearchType(val)}
            style={{ width: '100%' }}
          />
        </Col>
        <Col span={4}>
          <Select
            showSearch
            optionFilterProp="label"
            mode="multiple"
            allowClear
            placeholder={t('package.placeholder.platform')}
            value={searchPlatforms}
            options={platformOptions}
            onChange={(vals) => setSearchPlatforms(vals)}
            style={{ width: '100%' }}
            maxTagCount={1}
          />
        </Col>
        <Col span={4}>
          <Select
            showSearch
            optionFilterProp="label"
            mode="multiple"
            allowClear
            placeholder={t('package.placeholder.ingestStatus')}
            value={searchIngestStatuses}
            options={ingestStatusOptions}
            onChange={(vals) => setSearchIngestStatuses(vals)}
            style={{ width: '100%' }}
            maxTagCount={1}
          />
        </Col>
        <Col span={4}>
          <TrimInput
            placeholder={t('package.placeholder.description')}
            value={searchDescription}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchDescription(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
          />
        </Col>
        <Col span={4}>
          <Space>
            <Button onClick={handleReset}>{t('common.reset')}</Button>
            <Button type="primary" onClick={handleSearch}>
              {t('common.search')}
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 工具栏 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        {!readOnly && (
          <Button onClick={() => setCreateModalOpen(true)}>
            {t('content.packageLink.newPackage')}
          </Button>
        )}
      </div>

      {/* 表格 */}
      <Table<PackageListItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={list}
        scroll={{ x: 800 }}
        size="small"
        rowSelection={readOnly ? {
          selectedRowKeys: selectedIds,
          onChange: () => {},
          getCheckboxProps: () => ({ disabled: true }),
        } : {
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as number[]),
        }}
        pagination={tablePaginationProps}
        onChange={handleTableChange}
        locale={{
          emptyText: loading ? (
            <Spin size="small" />
          ) : (
            <Empty description={t('content.packageLink.noData')} />
          ),
        }}
      />

      <PackageCreateModal
        open={createModalOpen}
        packageTypeOptions={packageTypeOptions}
        platformOptions={platformOptions}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          void loadList(pagination.current)
        }}
      />
    </Modal>
  )
}
