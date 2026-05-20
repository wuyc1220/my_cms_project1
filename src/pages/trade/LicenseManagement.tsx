/**
 * LicenseManagement — 许可证管理列表页
 *
 * 需求规范（4.2.3）：
 *  - 列表列：License Name / Contract Name / Start Date / End Date / Service Type / Platform / Status / Action
 *  - Action：详情(i) / 添加内容(+) / 编辑 / 删除
 *  - 新增/编辑弹框：Start Date 和 End Date 各自独立且必填
 *  - Add Content to License 弹框（左右两栏）：
 *      左侧搜索条件：Content Name / Content Type / Genre / Ingest Status / Without License（快捷统计按钮）
 *      左侧列表列：Content Name / Content Type / Ingest Status / Genre / Licence / Action(+)
 *      右侧：Provider / Contract / License Name / Contents Of License（含移除）
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Checkbox,
  Col,
  DatePicker,
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
  TimePicker,
  Tooltip,
  message,
} from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getLicenses,
  createLicense,
  updateLicense,
  deleteLicense,
  batchDeleteLicenses,
} from '../../api/licenses'
import { getContractsSimple } from '../../api/contracts'
import { getDictTree } from '../../api/dicts'
import SearchForm from '../../components/SearchForm'
import TrimInput from '../../components/TrimInput'
import type { SearchFieldConfig } from '../../types/searchForm'
import type {
  LicenseListItem,
  LicenseCreatePayload,
  LicenseUpdatePayload,
  LicensePlatformItem,
  ContractSimpleItem,
} from '../../types/trade'
import type { DictNodeListItem } from '../../types/dict'
import { useI18n } from '../../i18n/useI18n'
import { usePermission } from '../../hooks/usePermission'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import { LicenseAddContentModal } from '../../components/ContentModals'
import { isHandledError } from '../../api'
import { useFormRules } from '../../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../../constants/form'
import { getPlatformColor } from '../../constants/platform'


// ─── 常量 ─────────────────────────────────────────────────────────────────────

/** 许可证状态 Tag 颜色 */
const statusColor = (s: string) => {
  if (s === 'ACTIVE') return 'success'
  if (s === 'INACTIVE') return 'default'
  if (s === 'EXPIRED') return 'error'
  if (s === 'DELETED') return 'error'
  return 'default'
}

// ─── 本地类型 ─────────────────────────────────────────────────────────────────

interface SearchValues {
  name?: string
  service_types?: string[]
  platforms?: string[]
  statuses?: string[]
  start_date?: [dayjs.Dayjs, dayjs.Dayjs]
  end_date?: [dayjs.Dayjs, dayjs.Dayjs]
}

interface LicenseFormValues {
  name: string
  contract_id: number
  service_type: string
  platform_items?: LicensePlatformItem[]
  regions?: string[]
  start_date?: dayjs.Dayjs
  end_date?: dayjs.Dayjs
  mobile_download?: boolean
  download_duration?: number
  mobile_preview?: boolean
  preview_begin_time?: dayjs.Dayjs
  preview_end_time?: dayjs.Dayjs
  notes?: string
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function LicenseManagement() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { hasPermission } = usePermission()
  const formRules = useFormRules()
  const canViewLicense = hasPermission('menu.trade.licenses.view') || hasPermission('menu.trade.licenses.operate')
  const canOperateLicense = hasPermission('menu.trade.licenses.operate')
  const canOperateContent = hasPermission('menu.trade.contents.operate')
  const [itemForm] = Form.useForm<LicenseFormValues>()

  // 列表状态
  const [licenses, setLicenses] = useState<LicenseListItem[]>([])
  const [loading, setLoading] = useState(false)
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadList(page, pageSize, filters, sortField, sortOrder)
    },
  })

  // 搜索
  const [filters, setFilters] = useState<Record<string, unknown>>({})

  // 批量选择
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])

  // 新增/编辑弹框
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<LicenseListItem | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  // 表单监听
  const mobileDownload = Form.useWatch('mobile_download', itemForm)
  const mobilePreview = Form.useWatch('mobile_preview', itemForm)

  // 平台表格状态（替代 Form.List，与合同模块保持一致）
  const [licCheckedPlatforms, setLicCheckedPlatforms] = useState<string[]>([])
  const [licPlatformRights, setLicPlatformRights] = useState<Record<string, boolean>>({})

  // 下拉选项
  const [serviceTypeOptions, setServiceTypeOptions] = useState<{ label: string; value: string }[]>([])
  const [platformOptions, setPlatformOptions] = useState<{ label: string; value: string }[]>([])
  const [regionOptions, setRegionOptions] = useState<{ label: string; value: string }[]>([])
  const [contractOptions, setContractOptions] = useState<{ label: string; value: number }[]>([])

  // Add Content 弹框状态
  const [addContentModal, setAddContentModal] = useState<{
    open: boolean
    licenseId: number
    licenseRecord: LicenseListItem | null
  }>({ open: false, licenseId: 0, licenseRecord: null })

  // ─── 搜索字段配置 ─────────────────────────────────────────────────────────────

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'name',
      labelKey: 'license.search.name',
      type: 'input',
    },
    {
      name: 'service_types',
      labelKey: 'license.search.serviceType',
      type: 'multiSelect',
      options: serviceTypeOptions,
    },
    {
      name: 'platforms',
      labelKey: 'license.search.platform',
      type: 'multiSelect',
      options: platformOptions,
    },
    {
      name: 'statuses',
      labelKey: 'common.status',
      type: 'multiSelect',
      options: ['ACTIVE', 'INACTIVE', 'EXPIRED'].map((s) => ({ label: s, value: s })),
    },
    {
      name: 'start_date',
      labelKey: 'content.col.startDate',
      type: 'dateRange',
    },
    {
      name: 'end_date',
      labelKey: 'content.col.endDate',
      type: 'dateRange',
    },
  ], [serviceTypeOptions, platformOptions, t])

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
      const nextFilters = { ...values } as Record<string, unknown>
      setFilters(nextFilters)
      setSelectedRowKeys([])
      resetSort()
      void loadList(1, pagination.pageSize, nextFilters, null, null)
    },
    onReset: () => {
      setFilters({})
      setSelectedRowKeys([])
      resetSort()
      void loadList(1, pagination.pageSize, {}, null, null)
    },
  })

  // ─── 初始化 ────────────────────────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      try {
        const dicts = await getDictTree()
        const svcRoot = dicts.find((d: DictNodeListItem) => d.code === 'ServiceType')
        setServiceTypeOptions(
          (svcRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })),
        )
        const platRoot = dicts.find((d: DictNodeListItem) => d.code === 'Platform')
        setPlatformOptions(
          (platRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })),
        )
        const regRoot = dicts.find((d: DictNodeListItem) => d.code === 'Regions')
        setRegionOptions(
          (regRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })),
        )
      } catch (err) {
        // 错误已由拦截器处理
      }
    })()

    void (async () => {
      try {
        const contracts = await getContractsSimple()
        setContractOptions(contracts.map((c: ContractSimpleItem) => ({ label: c.name, value: c.id })))
      } catch (err) {
        if (isHandledError(err)) return
        void message.error(t('license.msg.initFailed'), 5)
      }
    })()

    void loadList(1, pagination.pageSize, {})
  }, [])

  // ─── 列表加载 ──────────────────────────────────────────────────────────────

  const buildApiParams = (f: Record<string, unknown>) => ({
    name: f.name as string | undefined,
    service_types: f.service_types as string[] | undefined,
    platforms: f.platforms as string[] | undefined,
    statuses: f.statuses as string[] | undefined,
    start_date_from: (f.start_date as [dayjs.Dayjs, dayjs.Dayjs] | undefined)?.[0]?.format('YYYY-MM-DD'),
    start_date_to: (f.start_date as [dayjs.Dayjs, dayjs.Dayjs] | undefined)?.[1]?.format('YYYY-MM-DD'),
    end_date_from: (f.end_date as [dayjs.Dayjs, dayjs.Dayjs] | undefined)?.[0]?.format('YYYY-MM-DD'),
    end_date_to: (f.end_date as [dayjs.Dayjs, dayjs.Dayjs] | undefined)?.[1]?.format('YYYY-MM-DD'),
  })

  const loadList = async (
    targetPage: number,
    targetPageSize: number,
    nextFilters: Record<string, unknown>,
    sortBy?: string | null,
    sortOrd?: 'ascend' | 'descend' | null,
  ) => {
    setLoading(true)
    try {
      const data = await getLicenses({
        page: targetPage,
        page_size: targetPageSize,
        ...buildApiParams(nextFilters),
        sort_by: sortBy ?? undefined,
        sort_order: sortOrd ? (sortOrd === 'ascend' ? 'asc' : 'desc') : undefined,
      })
      setLicenses(data.items)
      updatePagination(data)
    } catch (err) {
      // 错误已由拦截器处理
    } finally {
      setLoading(false)
    }
  }



  // ─── 新增 / 编辑 ────────────────────────────────────────────────────────────

  /** 将平台选中状态同步写入隐藏的 form 字段 platform_items */
  const syncPlatformItemsToForm = (checked: string[], rights: Record<string, boolean>) => {
    itemForm.setFieldValue(
      'platform_items',
      checked.map((p) => ({ platform: p, ad_rights: rights[p] ?? false })),
    )
  }

  /** 切换单个平台的选中状态 */
  const toggleLicPlatform = (platform: string) => {
    setLicCheckedPlatforms((prev) => {
      const next = prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
      syncPlatformItemsToForm(next, licPlatformRights)
      return next
    })
  }

  /** 表头全选 / 全不选 */
  const handleLicSelectAll = (checked: boolean) => {
    const next = checked ? platformOptions.map((o) => o.value) : []
    setLicCheckedPlatforms(next)
    syncPlatformItemsToForm(next, licPlatformRights)
  }

  /** 切换单个平台的广告权利 */
  const toggleLicAdRights = (platform: string, checked: boolean) => {
    setLicPlatformRights((prev) => {
      const next = { ...prev, [platform]: checked }
      syncPlatformItemsToForm(licCheckedPlatforms, next)
      return next
    })
  }

  const openCreate = () => {
    setEditRecord(null)
    itemForm.resetFields()
    setLicCheckedPlatforms([])
    setLicPlatformRights({})
    setModalOpen(true)
  }

  const openEdit = (record: LicenseListItem) => {
    setEditRecord(record)
    const checked = record.platforms.map((p) => p.platform)
    const rights: Record<string, boolean> = {}
    record.platforms.forEach((p) => { rights[p.platform] = p.ad_rights })
    setLicCheckedPlatforms(checked)
    setLicPlatformRights(rights)
    itemForm.setFieldsValue({
      name: record.name,
      contract_id: record.contract_id ?? undefined,
      service_type: record.service_type,
      platform_items: record.platforms,
      regions: record.regions,
      start_date: record.start_date ? dayjs(record.start_date) : undefined,
      end_date: record.end_date ? dayjs(record.end_date) : undefined,
      mobile_download: record.mobile_download,
      download_duration: record.download_duration ?? undefined,
      mobile_preview: record.mobile_preview,
      preview_begin_time: record.preview_begin_time ? dayjs(record.preview_begin_time, 'HH:mm:ss') : undefined,
      preview_end_time: record.preview_end_time ? dayjs(record.preview_end_time, 'HH:mm:ss') : undefined,
      notes: record.notes ?? undefined,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditRecord(null)
    itemForm.resetFields()
    setLicCheckedPlatforms([])
    setLicPlatformRights({})
  }

  const handleSubmit = async () => {
    const values = await itemForm.validateFields()
    setModalLoading(true)
    try {
      const platformItems: LicensePlatformItem[] = (values.platform_items ?? []).map((p) => ({
        platform: p.platform,
        ad_rights: p.ad_rights ?? false,
      }))

      if (editRecord) {
        const payload: LicenseUpdatePayload = {
          name: values.name,
          contract_id: values.contract_id,
          service_type: values.service_type,
          platforms: platformItems,
          regions: values.regions ?? [],
          start_date: values.start_date?.format('YYYY-MM-DD'),
          end_date: values.end_date?.format('YYYY-MM-DD'),
          mobile_download: values.mobile_download ?? false,
          download_duration: values.mobile_download ? values.download_duration : undefined,
          mobile_preview: values.mobile_preview ?? false,
          preview_begin_time: values.mobile_preview ? values.preview_begin_time?.format('HH:mm:ss') : undefined,
          preview_end_time: values.mobile_preview ? values.preview_end_time?.format('HH:mm:ss') : undefined,
          notes: values.notes,
        }
        await updateLicense(editRecord.id, payload)
        void message.success(t('license.msg.updated'), 3)
      } else {
        const payload: LicenseCreatePayload = {
          name: values.name,
          contract_id: values.contract_id,
          service_type: values.service_type,
          platforms: platformItems,
          regions: values.regions ?? [],
          start_date: values.start_date!.format('YYYY-MM-DD'),
          end_date: values.end_date!.format('YYYY-MM-DD'),
          mobile_download: values.mobile_download ?? false,
          download_duration: values.mobile_download ? values.download_duration : undefined,
          mobile_preview: values.mobile_preview ?? false,
          preview_begin_time: values.mobile_preview ? values.preview_begin_time?.format('HH:mm:ss') : undefined,
          preview_end_time: values.mobile_preview ? values.preview_end_time?.format('HH:mm:ss') : undefined,
          notes: values.notes,
        }
        await createLicense(payload)
        void message.success(t('license.msg.created'), 3)
      }
      closeModal()
      void loadList(editRecord ? pagination.current : 1, pagination.pageSize, filters)
    } catch (err) {
      // 错误已由拦截器处理
    } finally {
      setModalLoading(false)
    }
  }

  // ─── 删除 ──────────────────────────────────────────────────────────────────

  const handleDelete = async (record: LicenseListItem) => {
    try {
      await deleteLicense(record.id)
      void message.success(t('common.msg.deleted'), 3)
      setSelectedRowKeys(prev => prev.filter(id => id !== record.id))
      void loadList(pagination.current, pagination.pageSize, filters)
    } catch (err) {
      // 错误已由拦截器处理
    }
  }

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return
    try {
      await batchDeleteLicenses({ ids: selectedRowKeys })
      void message.success(t('common.msg.deleteSuccess'), 3)
      setSelectedRowKeys([])
      void loadList(1, pagination.pageSize, filters)
    } catch (err) {
      // 错误已由拦截器处理
    }
  }

  // ─── Add Content 弹框 ──────────────────────────────────────────────────────

  const openAddContent = (record: LicenseListItem) => {
    setAddContentModal({ open: true, licenseId: record.id, licenseRecord: record })
  }

  const closeAddContent = () => {
    setAddContentModal({ open: false, licenseId: 0, licenseRecord: null })
  }

  const handleAddContentSuccess = () => {
    void loadList(pagination.current, pagination.pageSize, filters)
  }

  // ─── 表格列定义 ────────────────────────────────────────────────────────────

  const columns: ColumnsType<LicenseListItem> = [
    {
      title: t('license.search.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'name' ? sortOrder : null,
      render: (val: string) => <Tooltip autoAdjustOverflow={false} placement={'topLeft'}  title={val}><span>{val}</span></Tooltip>,
    },
    {
      title: t('contract.search.name'),
      dataIndex: 'contract_name',
      key: 'contract_name',
      width: 200,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'contract_name' ? sortOrder : null,
      render: (val: string) => <Tooltip title={val}><span>{val}</span></Tooltip>,
    },
    {
      title: t('content.col.startDate'),
      dataIndex: 'start_date',
      key: 'start_date',
      width: 130,
      sorter: true,
      sortOrder: sortField === 'start_date' ? sortOrder : null,
      render: (v: string | undefined) => v ?? '—',
    },
    {
      title: t('content.col.endDate'),
      dataIndex: 'end_date',
      key: 'end_date',
      width: 130,
      sorter: true,
      sortOrder: sortField === 'end_date' ? sortOrder : null,
      render: (v: string | undefined) => v ?? '—',
    },
    {
      title: t('license.search.serviceType'),
      dataIndex: 'service_type',
      key: 'service_type',
      width: 180,
      ellipsis: { showTitle: false },
      sorter: true,
      sortOrder: sortField === 'service_type' ? sortOrder : null,
      render: (val: string) => {
        const label = serviceTypeOptions.find((o) => o.value === val)?.label ?? val
        return <Tooltip title={label}><span>{label}</span></Tooltip>
      },
    },
    {
      title: t('provider.detail.platform'),
      key: 'platform',
      width: 360,
      render: (_, row) => (
        <Space size={4} wrap>
          {row.platforms.map((p) => {
            const platformLabel = platformOptions.find(opt => opt.value === p.platform)?.label ?? p.platform
            return (
              <Tag key={p.platform} color={getPlatformColor(p.platform)}>{platformLabel}</Tag>
            )
          })}
        </Space>
      ),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (val: string) => <Tag color={statusColor(val)}>{val}</Tag>,
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 140,
      render: (_, record) => (
        <Space size={0}>
          {canViewLicense && (
            <Tooltip title={t('common.detail')}>
              <Button
                type="link"
                size="small"
                icon={<InfoCircleOutlined />}
                onClick={() => navigate(`/trade/licenses/${record.id}`)}
              />
            </Tooltip>
          )}
          {canOperateContent && (
            <Tooltip title={t('license.tooltip.addContent')}>
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => void openAddContent(record)}
              />
            </Tooltip>
          )}
          {canOperateLicense && (
            <Tooltip title={t('common.edit')}>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              />
            </Tooltip>
          )}
          {canOperateLicense && (
            <Popconfirm
              title={t('common.confirmDelete', { name: record.name })}
              onConfirm={() => void handleDelete(record)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Tooltip title={t('common.delete')}>
                <Button type="link" size="small" icon={<DeleteOutlined />} danger />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  // ─── JSX ──────────────────────────────────────────────────────────────────

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
          {canOperateLicense && (
            <Popconfirm
              title={t('common.confirmDeleteSelected', { count: selectedRowKeys.length })}
              onConfirm={() => void handleBatchDelete()}
              disabled={selectedRowKeys.length === 0}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button danger disabled={selectedRowKeys.length === 0}>
                {t('common.batchDelete')}{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ''}
              </Button>
            </Popconfirm>
          )}
          {canOperateLicense && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {t('license.toolbar.newLicense')}
            </Button>
          )}
        </div>

        {/* 列表表格 */}
        <Table<LicenseListItem>
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={licenses}
          scroll={{ x: 1000 }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as number[]),
          }}
          pagination={tablePaginationProps}
          onChange={handleTableChange}
        />

      {/* ── 新增/编辑弹框 ───────────────────────────────────────────────────── */}
      <Modal
        title={editRecord ? t('license.modal.titleEdit') : t('license.modal.titleCreate')}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        confirmLoading={modalLoading}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
        width={720}
      >
        <Form form={itemForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            {/* 许可证名称（必填） */}
            <Col span={12}>
              <Form.Item
                name="name"
                label={t('license.search.name')}
                rules={[{ required: true, message: t('license.form.nameRequired') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
              >
                <TrimInput placeholder={t('license.placeholder.nameFrm')} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            {/* 所属合同（必填） */}
            <Col span={12}>
              <Form.Item
                name="contract_id"
                label={t('license.label.contract')}
                rules={[{ required: true, message: t('license.form.contractRequired') }]}
              >
                <Select
                  showSearch
                  allowClear
                  placeholder={t('license.placeholder.contract')}
                  options={contractOptions}
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>

            {/* 服务类型（必填） */}
            <Col span={12}>
              <Form.Item
                name="service_type"
                label={t('license.search.serviceType')}
                rules={[{ required: true, message: t('license.form.serviceTypeRequired') }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  allowClear
                  placeholder={t('license.placeholder.serviceType')}
                  options={serviceTypeOptions}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>

            {/* 开始日期（必填，单独 DatePicker） */}
            <Col span={12}>
              <Form.Item
                name="start_date"
                label={t('content.col.startDate')}
                rules={[{ required: true, message: t('license.form.startRequired') }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            {/* 结束日期（必填，单独 DatePicker） */}
            <Col span={12}>
              <Form.Item
                name="end_date"
                label={t('content.col.endDate')}
                dependencies={['start_date']}
                rules={[
                  { required: true, message: t('license.form.endRequired') },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const startDate = getFieldValue('start_date')
                      if (!value || !startDate || value.isAfter(startDate) || value.isSame(startDate, 'day')) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error(t('license.form.endDateAfterStart')))
                    },
                  }),
                ]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            {/* 地区 */}
            <Col span={12}>
              <Form.Item name="regions" label={t('license.label.regions')}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  mode="multiple"
                  allowClear
                  placeholder={t('license.placeholder.regions')}
                  options={regionOptions}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>

            {/* 平台 + 广告权利：表格样式 */}
            <Col span={24}>
              {/* 隐藏字段保持 platform_items 供 validateFields 读取 */}
              <Form.Item name="platform_items" style={{ display: 'none' }}>
                <Select mode="multiple" />
              </Form.Item>

              <div style={{ marginBottom: 24 }}>
                <div style={{ marginBottom: 8, fontSize: 14, color: 'rgba(0,0,0,0.88)' }}>
                  {t('license.label.platform')}
                </div>
                <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
                  {/* 表头 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '9px 16px',
                      background: '#fafafa',
                      borderBottom: '1px solid #d9d9d9',
                      fontWeight: 600,
                      fontSize: 13,
                      color: '#262626',
                    }}
                  >
                    <div style={{ width: 36 }}>
                      <Checkbox
                        checked={
                          platformOptions.length > 0 &&
                          licCheckedPlatforms.length === platformOptions.length
                        }
                        indeterminate={
                          licCheckedPlatforms.length > 0 &&
                          licCheckedPlatforms.length < platformOptions.length
                        }
                        onChange={(e) => handleLicSelectAll(e.target.checked)}
                      />
                    </div>
                    <div style={{ flex: 1 }}>{t('provider.detail.platform')}</div>
                    <div style={{ width: 130, textAlign: 'center' }}>{t('license.label.adRights')}</div>
                  </div>

                  {/* 数据行 */}
                  {platformOptions.map((opt, idx) => {
                    const p = opt.value
                    const selected = licCheckedPlatforms.includes(p)
                    const hasRights = licPlatformRights[p] ?? false
                    return (
                      <div
                        key={p}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '10px 16px',
                          borderBottom:
                            idx < platformOptions.length - 1 ? '1px solid #f0f0f0' : 'none',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                          background: selected ? '#fff' : '#fafafa',
                        }}
                        onClick={() => toggleLicPlatform(p)}
                      >
                        <div style={{ width: 36 }}>
                          <Checkbox
                            checked={selected}
                            onChange={() => toggleLicPlatform(p)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div
                          style={{
                            flex: 1,
                            fontSize: 13,
                            color: selected ? '#262626' : '#8c8c8c',
                            transition: 'color 0.15s',
                          }}
                        >
                          {opt.label}
                        </div>
                        <div
                          style={{ width: 130, textAlign: 'center' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Switch
                            checked={hasRights}
                            disabled={!selected}
                            checkedChildren={<CheckOutlined />}
                            unCheckedChildren={<CloseOutlined />}
                            onChange={(checked) => toggleLicAdRights(p, checked)}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Col>

            {/* 移动端可下载 */}
            <Col span={12}>
              <Form.Item name="mobile_download" label={t('license.label.mobileDownload')} valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>

            {/* 下载有效天数（仅 mobile_download=true 时显示） */}
            {mobileDownload && (
              <Col span={12}>
                <Form.Item name="download_duration" label={t('license.label.downloadDuration')}>
                  <InputNumber min={1} style={{ width: '100%' }} placeholder={t('license.placeholder.days')} />
                </Form.Item>
              </Col>
            )}

            {/* 移动端可预览 */}
            <Col span={12}>
              <Form.Item name="mobile_preview" label={t('license.label.mobilePreview')} valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>

            {/* 预览开始时间（仅 mobile_preview=true 时显示且必填） */}
            {mobilePreview && (
              <Col span={12}>
                <Form.Item
                  name="preview_begin_time"
                  label={t('license.label.previewBeginTime')}
                  rules={[{ required: true, message: t('license.form.previewBeginRequired') }]}
                >
                  <TimePicker format="HH:mm:ss" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            )}

            {/* 预览结束时间（仅 mobile_preview=true 时显示且必填） */}
            {mobilePreview && (
              <Col span={12}>
                <Form.Item
                  name="preview_end_time"
                  label={t('license.label.previewEndTime')}
                  dependencies={['preview_begin_time']}
                  rules={[
                    { required: true, message: t('license.form.previewEndRequired') },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const beginTime = getFieldValue('preview_begin_time')
                        if (!value || !beginTime || value.isAfter(beginTime)) {
                          return Promise.resolve()
                        }
                        return Promise.reject(new Error(t('license.form.previewEndTimeAfterBegin')))
                      },
                    }),
                  ]}
                >
                  <TimePicker format="HH:mm:ss" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            )}

            {/* 备注 */}
            <Col span={24}>
              <Form.Item name="notes" label={t('common.notes')} rules={[formRules.maxLength(FORM_MAX_LENGTH.TEXT_AREA)]}>
                <TrimInput.TextArea rows={3} placeholder={t('license.placeholder.notes')} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Add Content to License 弹框 ──────────────────────────────────── */}
      <LicenseAddContentModal
        open={addContentModal.open}
        licenseId={addContentModal.licenseId}
        licenseRecord={addContentModal.licenseRecord}
        onClose={closeAddContent}
        onSuccess={handleAddContentSuccess}
      />
    </div>
  )
}
