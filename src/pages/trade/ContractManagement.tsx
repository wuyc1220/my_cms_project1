/**
 * ContractManagement — 合同管理列表页
 *
 * 功能：
 *  - 分页查询合同列表（按名称/供应商/平台/起止日期/无许可证过滤）
 *  - 新增合同（含平台商业权利配置）
 *  - 单条删除 / 批量删除
 *  - 跳转合同详情页
 *  - 为合同许可证添加内容（三栏弹框）
 *  - 从导航 state 接收预填供应商，自动打开新增弹框
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Badge,
  Button,
  Popconfirm,
  Select,
  message,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getContracts,
  batchDeleteContracts,
  getWithoutLicenseCount,
} from '../../api/contracts'
import { getProvidersSimple } from '../../api/providers'
import { getDictTree } from '../../api/dicts'
import SearchForm from '../../components/SearchForm'
import { ContractTable, CreateContractModal } from '../../components/ContractModals'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useI18n } from '../../i18n/useI18n'
import { usePermission } from '../../hooks/usePermission'
import type { ContractListItem, ProviderSimpleItem } from '../../types/trade'
import type { DictNodeListItem } from '../../types/dict'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'

// ─── 本地类型 ─────────────────────────────────────────────────────────────────

interface SearchValues {
  name?: string
  provider_id?: number
  platforms?: string[]
  start_date_range?: [dayjs.Dayjs, dayjs.Dayjs] | null
  end_date_range?: [dayjs.Dayjs, dayjs.Dayjs] | null
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function ContractManagement() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useI18n()
  const { hasPermission } = usePermission()

  const canOperateContract = hasPermission('menu.trade.contracts.operate')

  // ─── 列表状态 ────────────────────────────────────────────────────────────────

  const [list, setList] = useState<ContractListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filters, withoutLicenseActive, sortField, sortOrder)
    },
  })

  // ─── 下拉选项 ────────────────────────────────────────────────────────────────

  const [providerOptions, setProviderOptions] = useState<{ label: string; value: number }[]>([])
  const [platformOptions, setPlatformOptions] = useState<{ label: string; value: string }[]>([])

  // ─── 无许可证合同数量 ─────────────────────────────────────────────────────────

  const [withoutLicenseCount, setWithoutLicenseCount] = useState(0)
  const [withoutLicenseActive, setWithoutLicenseActive] = useState(false)

  // ─── 新增弹框 ────────────────────────────────────────────────────────────────

  const [modalOpen, setModalOpen] = useState(false)
  /** 预填供应商（从 ProviderManagement 跳转携带） */
  const [prefilledProvider, setPrefilledProvider] = useState<ProviderSimpleItem | null>(null)

  // 防止重复初始化导航 state 的 ref
  const locationStateHandled = useRef(false)

  // ─── 搜索字段配置 ─────────────────────────────────────────────────────────────

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'name',
      labelKey: 'contract.search.name',
      type: 'input',
    },
    {
      name: 'provider_id',
      labelKey: 'contract.search.provider',
      type: 'select',
      render: () => (
        <Select
          allowClear
          showSearch
          placeholder={t('contract.placeholder.provider')}
          optionFilterProp="label"
          options={[
            { value: '', label: '全部' },
            ...providerOptions.map((opt) => ({ value: opt.value, label: opt.label })),
          ]}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      name: 'platforms',
      labelKey: 'contract.search.platform',
      type: 'multiSelect',
      options: platformOptions,
    },
    {
      name: 'without_license',
      label: ' ',
      type: 'select',
      render: () => (
          <Badge count={withoutLicenseCount} size="medium"  offset={[4, 0]} styles={{
            root: { width: '100%' } // 或直接写样式
          }}>
            <Button
              type={withoutLicenseActive ? 'primary' : 'default'}
              onClick={handleWithoutLicenseFilter}
              block
            >
              {t('contract.filter.withoutLicense')}
            </Button>
          </Badge>
      ),
    },
    {
      name: 'start_date_range',
      labelKey: 'content.col.startDate',
      type: 'dateRange',
    },
    {
      name: 'end_date_range',
      labelKey: 'content.col.endDate',
      type: 'dateRange',
    },
  ], [providerOptions, platformOptions, t, withoutLicenseCount, withoutLicenseActive])

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
    fieldsCount: searchFields.length + 1,
    onSearch: (values) => {
      setFilters(values)
      setWithoutLicenseActive(false)
      setSelectedIds([])
      resetSort()
      void loadList(1, pagination.pageSize, values, false, null, null)
    },
    onReset: () => {
      setFilters({})
      setWithoutLicenseActive(false)
      setSelectedIds([])
      resetSort()
      void loadList(1, pagination.pageSize, {}, false, null, null)
    },
  })

  // ─── 初始化 ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      try {
        const [providers, dicts, countData] = await Promise.all([
          getProvidersSimple(),
          getDictTree(),
          getWithoutLicenseCount(),
        ])
        setProviderOptions(providers.map((p) => ({ label: p.name, value: p.id })))
        const platformRoot = dicts.find((d: DictNodeListItem) => d.code === 'Platform')
        setPlatformOptions(
          (platformRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })),
        )
        setWithoutLicenseCount(countData.count)
      } catch (err) {
        // 错误已由拦截器处理
      }
    })()
    void loadList(1, pagination.pageSize, {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 处理从 ProviderManagement 携带的导航 state
  useEffect(() => {
    if (locationStateHandled.current) return
    const state = location.state as { openNewWithProvider?: ProviderSimpleItem } | null
    if (state?.openNewWithProvider) {
      locationStateHandled.current = true
      const provider = state.openNewWithProvider
      setPrefilledProvider(provider)
      setModalOpen(true)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state, location.pathname, navigate])

  // ─── 列表加载 ────────────────────────────────────────────────────────────────

  const loadList = async (
    targetPage: number,
    targetPageSize: number,
    nextFilters: SearchValues,
    withoutLicense = withoutLicenseActive,
    sortBy?: string | null,
    sortOrd?: 'ascend' | 'descend' | null,
  ) => {
    setLoading(true)
    try {
      const startRange = nextFilters.start_date_range
      const endRange = nextFilters.end_date_range
      const data = await getContracts({
        page: targetPage,
        page_size: targetPageSize,
        name: nextFilters.name,
        provider_id: nextFilters.provider_id,
        platforms: nextFilters.platforms,
        start_date_from: startRange ? startRange[0].format('YYYY-MM-DD') : undefined,
        start_date_to: startRange ? startRange[1].format('YYYY-MM-DD') : undefined,
        end_date_from: endRange ? endRange[0].format('YYYY-MM-DD') : undefined,
        end_date_to: endRange ? endRange[1].format('YYYY-MM-DD') : undefined,
        without_license: withoutLicense || undefined,
        sort_by: sortBy ?? undefined,
        sort_order: sortOrd ? (sortOrd === 'ascend' ? 'asc' : 'desc') : undefined,
      })
      setList(data.items)
      updatePagination(data)
    } catch (err) {
      // 错误已由拦截器处理
    } finally {
      setLoading(false)
    }
  }

  /** 点击"Without License"快捷筛选按钮 */
  const handleWithoutLicenseFilter = () => {
    const active = !withoutLicenseActive
    setWithoutLicenseActive(active)
    resetSort()
    // 从表单获取当前值，确保使用最新的搜索条件
    const currentValues = searchForm.getFieldsValue() as SearchValues
    void loadList(1, pagination.pageSize, currentValues, active, null, null)
  }

  // ─── 新增合同 ────────────────────────────────────────────────────────────────

  /** 打开新增弹框 */
  const openCreate = () => {
    setPrefilledProvider(null)
    setModalOpen(true)
  }

  /** 关闭弹框 */
  const closeModal = () => {
    setModalOpen(false)
    setPrefilledProvider(null)
  }

  // ─── 批量删除 ────────────────────────────────────────────────────────────────

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    try {
      await batchDeleteContracts({ ids: selectedIds })
      void message.success(t('common.msg.deleteSuccess'), 3)
      setSelectedIds([])
      void loadList(1, pagination.pageSize, filters)
    } catch (err) {
      // 错误已由拦截器处理
    }
  }

  // ─── 表格操作 ────────────────────────────────────────────────────────────────

  const handleContractDetail = (record: ContractListItem) => {
    navigate(`/trade/contracts/${record.id}`)
  }

  const handleContractsChange = () => {
    void loadList(pagination.current, pagination.pageSize, filters, withoutLicenseActive, sortField, sortOrder)
  }

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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
        {canOperateContract && (
          <Popconfirm
            title={t('common.confirmDeleteSelected', { count: selectedIds.length })}
            onConfirm={() => void handleBatchDelete()}
            disabled={selectedIds.length === 0}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button danger disabled={selectedIds.length === 0}>
              {t('common.batchDelete')}{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
            </Button>
          </Popconfirm>
        )}
        {canOperateContract && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t('contract.toolbar.newContract')}
          </Button>
        )}
      </div>

      {/* 合同列表 - 使用公共组件 */}
      <ContractTable
        dataSource={list}
        loading={loading}
        platformOptions={platformOptions}
        showProvider={true}
        showDetail={true}
        showAddContent={true}
        showEdit={true}
        showDelete={true}
        showAttachments={true}
        onDetail={handleContractDetail}
        onDataChange={handleContractsChange}
        onSelectionChange={(keys) => setSelectedIds(keys)}
        pagination={tablePaginationProps}
        scroll={{ x: 1060 }}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as number[]),
        }}
        onTableChange={handleTableChange}
      />

      {/* 新增合同弹框 */}
      <CreateContractModal
        open={modalOpen}
        platformOptions={platformOptions}
        providerOptions={providerOptions}
        prefilledProvider={prefilledProvider}
        onClose={closeModal}
        onSuccess={() => {
          closeModal()
          void loadList(1, pagination.pageSize, filters)
        }}
      />
    </div>
  )
}
