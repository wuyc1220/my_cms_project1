/**
 * LicenseAddContentModal - 为许可证添加内容的公共弹窗组件
 *
 * 从 LicenseManagement 提取，供 LicenseManagement 和 ContractDetail 共用。
 * 布局：左侧（SearchForm + 工具栏 + 可选列表）| 右侧（许可证上下文 + 已关联内容）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Button,
  Divider,
  Empty,
  Form,
  Modal,
  Space,
  Table,
  Tooltip,
  message,
} from 'antd'
import { CheckCircleFilled, ExclamationCircleFilled, MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import TrimInput from '../TrimInput'
import {
  getLicenseContents,
  addContentsToLicense,
  removeContentFromLicense,
  getAvailableContentsForLicense,
  getWithoutLicenseContentCount,
} from '../../api/licenses'
import { getDictTree } from '../../api/dicts'
import { getGenres } from '../../api/genres'
import type { LicenseListItem, ContentForTradeItem } from '../../types/trade'
import type { DictNodeListItem } from '../../types/dict'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useI18n } from '../../i18n/useI18n'
import { usePermission } from '../../hooks/usePermission'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useSearchForm } from '../../hooks/useSearchForm'
import SearchForm from '../../components/SearchForm'
import { CreateContentModal } from './index'

const CONTENT_TYPES = ['MOVIE', 'EPISODE', 'SERIES', 'SEASON', 'CHANNEL', 'SCHEDULE']

interface ContentSearchValues {
  title?: string
  content_types?: string[]
  genres?: string[]
  ingest_statuses?: string[]
}

interface LicenseAddContentModalProps {
  open: boolean
  licenseId: number
  licenseRecord: LicenseListItem | null
  onClose: () => void
  onSuccess?: () => void
}

export default function LicenseAddContentModal({
  open,
  licenseId,
  licenseRecord,
  onClose,
  onSuccess,
}: LicenseAddContentModalProps) {
  const { t } = useI18n()
  const { hasPermission } = usePermission()
  const canOperateContent = hasPermission('menu.trade.contents.operate')

  const [licenseContents, setLicenseContents] = useState<ContentForTradeItem[]>([])
  const [pendingAdd, setPendingAdd] = useState<ContentForTradeItem[]>([])
  const [availableContents, setAvailableContents] = useState<ContentForTradeItem[]>([])
  const [contentLoading, setContentLoading] = useState(false)
  const [addContentSaving, setAddContentSaving] = useState(false)
  const [withoutLicense, setWithoutLicense] = useState(false)

  const [withoutLicenseCount, setWithoutLicenseCount] = useState(0)
  const [genreOptions, setGenreOptions] = useState<{ label: string; value: string }[]>([])
  const [ingestStatusOptions, setIngestStatusOptions] = useState<{ label: string; value: string }[]>([])

  const [createContentModalOpen, setCreateContentModalOpen] = useState(false)

  const [searchFormFilters, setSearchFormFilters] = useState<ContentSearchValues>({})

  const { pagination, updatePagination, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize }) => {
      void loadAvailableContents(page, pageSize, searchFormFilters, withoutLicense)
    },
  })

  const pageSizeRef = useRef<number>(pagination.pageSize)
  useEffect(() => {
    pageSizeRef.current = pagination.pageSize
  }, [pagination.pageSize])

  const loadAvailableContents = useCallback(async (
    p: number,
    ps: number,
    filters: ContentSearchValues,
    wl: boolean,
  ) => {
    setContentLoading(true)
    try {
      const data = await getAvailableContentsForLicense(licenseId, {
        page: p,
        page_size: ps,
        title: filters.title || undefined,
        content_types: filters.content_types?.length ? filters.content_types : undefined,
        genres: filters.genres?.length ? filters.genres : undefined,
        ingest_statuses: filters.ingest_statuses?.length ? filters.ingest_statuses : undefined,
        without_license: wl || undefined,
      })
      setAvailableContents(data.items)
      updatePagination(data)
    } catch (err) {
      // 错误已由拦截器处理
    } finally {
      setContentLoading(false)
    }
  }, [licenseId, updatePagination])

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'title',
      labelKey: 'license.addContent.contentName',
      type: 'input',
    },
    {
      name: 'content_types',
      labelKey: 'license.addContent.contentType',
      type: 'multiSelect',
      options: CONTENT_TYPES.map((ct) => ({ label: ct, value: ct })),
    },
    {
      name: 'genres',
      labelKey: 'trade.col.genre',
      type: 'multiSelect',
      options: genreOptions,
    },
    {
      name: 'ingest_statuses',
      labelKey: 'license.addContent.ingestStatus',
      type: 'multiSelect',
      options: ingestStatusOptions,
    },
  ], [genreOptions, ingestStatusOptions])

  const {
    form: searchForm,
    expanded,
    setExpanded,
    showExpand,
    handleSearch,
    handleReset,
  } = useSearchForm<ContentSearchValues>({
    fieldsCount: searchFields.length,
    onSearch: (values) => {
      setSearchFormFilters(values)
      void loadAvailableContents(1, pagination.pageSize, values, withoutLicense)
    },
    onReset: () => {
      setSearchFormFilters({})
      setWithoutLicense(false)
      void loadAvailableContents(1, pagination.pageSize, {}, false)
    },
  })

  useEffect(() => {
    if (open) {
      void (async () => {
        try {
          const [dicts, genresData, countData] = await Promise.all([
            getDictTree(),
            getGenres({ page: 1, page_size: 500 }),
            getWithoutLicenseContentCount(),
          ])
          const ingestRoot = dicts.find((d: DictNodeListItem) => d.code === 'Ingest_Status')
          setIngestStatusOptions(
            (ingestRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })),
          )
          setGenreOptions(
            (genresData.items ?? []).map((g) => ({ label: g.name, value: String(g.id) })),
          )
          setWithoutLicenseCount(countData.count)
        } catch (err) {
          // 错误已由拦截器处理
        }
      })()
    }
  }, [open])

  useEffect(() => {
    if (!open || !licenseId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingAdd([])
    setWithoutLicense(false)
    setSearchFormFilters({})
    searchForm.resetFields()
    void (async () => {
      try {
        const [linkedContents, available] = await Promise.all([
          getLicenseContents(licenseId),
          getAvailableContentsForLicense(licenseId, { page: 1, page_size: pageSizeRef.current }),
        ])
        setLicenseContents(linkedContents)
        setAvailableContents(available.items)
        updatePagination(available)
      } catch (err) {
        // 错误已由拦截器处理
      }
    })()
  }, [open, licenseId, searchForm, updatePagination])

  const handleToggleWithoutLicense = () => {
    const next = !withoutLicense
    setWithoutLicense(next)
    void loadAvailableContents(1, pagination.pageSize, searchFormFilters, next)
  }

  const handleAddToLicense = (item: ContentForTradeItem) => {
    const alreadyLinked = licenseContents.some((c) => c.id === item.id)
    const alreadyPending = pendingAdd.some((c) => c.id === item.id)
    if (alreadyLinked || alreadyPending) {
      void message.warning(t('license.msg.contentAlreadyInList'), 3)
      return
    }
    setPendingAdd((prev) => [item, ...prev])
  }

  const handleRemovePending = (id: number) => {
    setPendingAdd((prev) => prev.filter((c) => c.id !== id))
  }

  const handleRemoveLinked = async (contentId: number) => {
    try {
      await removeContentFromLicense(licenseId, contentId)
      setLicenseContents((prev) => prev.filter((c) => c.id !== contentId))
      void message.success(t('common.msg.removed'), 3)
    } catch (err) {
      // 错误已由拦截器处理
    }
  }

  const handleSaveAddContent = async () => {
    if (pendingAdd.length === 0) {
      onClose()
      return
    }
    setAddContentSaving(true)
    try {
      const updated = await addContentsToLicense(licenseId, {
        content_ids: pendingAdd.map((c) => c.id),
      })
      setLicenseContents(updated)
      setPendingAdd([])
      void message.success(t('common.contentsCount', { count: pendingAdd.length }), 3)
      onSuccess?.()
      onClose()
    } catch (err) {
      // 错误已由拦截器处理
    } finally {
      setAddContentSaving(false)
    }
  }

  const availableContentColumns: ColumnsType<ContentForTradeItem> = [
    {
      title: t('content.col.contentName'),
      dataIndex: 'title',
      key: 'title',
      ellipsis: { showTitle: false },
      render: (v: string) => <Tooltip title={v}><span>{v}</span></Tooltip>,
    },
    {
      title: t('content.col.contentType'),
      dataIndex: 'content_type',
      key: 'content_type',
      width: 100,
    },
    {
      title: t('license.addContent.ingestStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      ellipsis: { showTitle: false },
      render: (v: string) => <Tooltip title={v}><span>{v}</span></Tooltip>,
    },
    {
      title: t('trade.col.genre'),
      dataIndex: 'genre',
      key: 'genre',
      width: 90,
      render: (v: string | undefined) => v ?? '—',
    },
    {
      title: t('trade.col.licence'),
      key: 'licence',
      width: 70,
      align: 'center',
      render: (_, row) =>
        row.license_names.length > 0 ? (
          <Tooltip title={row.license_names.join(', ')}>
            <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />
          </Tooltip>
        ) : (
          <Tooltip title={t('license.addContent.noLicence')}>
            <ExclamationCircleFilled style={{ color: '#bfbfbf', fontSize: 16 }} />
          </Tooltip>
        ),
    },
    {
      title: '',
      key: 'add',
      width: 40,
      render: (_, row) => (
        <Button
          type="link"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => handleAddToLicense(row)}
          disabled={
            licenseContents.some((c) => c.id === row.id) ||
            pendingAdd.some((c) => c.id === row.id)
          }
        />
      ),
    },
  ]

  return (
    <>
      <Modal
        title={t('license.addContent.title')}
        open={open}
        onCancel={onClose}
        footer={
          <Space>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button
              type="primary"
              loading={addContentSaving}
              onClick={() => void handleSaveAddContent()}
            >
              {t('common.confirm')}
            </Button>
          </Space>
        }
        destroyOnHidden
        width={'70%'}
      >
        <div style={{ display: 'flex', gap: 0, height: 600 }}>
          <div style={{ flex: 3, minWidth: 0, display: 'flex', flexDirection: 'column', paddingRight: 16, borderRight: '1px solid #f0f0f0' }}>
            <SearchForm
              fields={searchFields}
              form={searchForm}
              expanded={expanded}
              onExpandChange={setExpanded}
              showExpand={showExpand}
              onSearch={handleSearch}
              onReset={handleReset}
              loading={contentLoading}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 20, marginBottom: 8 }}>
              <Badge count={withoutLicenseCount} overflowCount={999} size="small">
                <Button
                  type={withoutLicense ? 'primary' : 'default'}
                  onClick={handleToggleWithoutLicense}
                >
                  {t('license.addContent.withoutLicense')}
                </Button>
              </Badge>
              {canOperateContent && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateContentModalOpen(true)}
                >
                  {t('trade.addContent.newContent')}
                </Button>
              )}
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
              <Table<ContentForTradeItem>
                rowKey="id"
                size="small"
                loading={contentLoading}
                columns={availableContentColumns}
                dataSource={availableContents}
                scroll={{ x: 500, y: 360 }}
                rootClassName="compact-table"
                pagination={tablePaginationProps}
                onChange={handleTableChange}
              />
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingLeft: 16 }}>
            <Form layout="vertical" size="small">
              <Form.Item label={t('trade.addContent.provider')}>
                <Tooltip title={licenseRecord?.provider_name ?? '—'}>
                  <TrimInput value={licenseRecord?.provider_name ?? '—'} disabled />
                </Tooltip>
              </Form.Item>
              <Form.Item label={t('trade.addContent.contract')}>
                <Tooltip title={licenseRecord?.contract_name ?? '—'}>
                  <TrimInput value={licenseRecord?.contract_name ?? '—'} disabled />
                </Tooltip>
              </Form.Item>
              <Form.Item label={t('license.addContent.licenseLabel')}>
                <Tooltip title={licenseRecord?.name ?? '—'}>
                  <TrimInput value={licenseRecord?.name ?? '—'} disabled />
                </Tooltip>
              </Form.Item>
            </Form>
            <Divider style={{ margin: '10px 0' }} />
             <div
                style={{
                marginBottom: 6,
                fontWeight: 500,
                fontSize: 14,
                borderLeft: '3px solid #1677ff',
                paddingLeft: 8,
                }}
            >
            {t('trade.addContent.contentsOfLicense')}
          </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', paddingLeft: 10,paddingRight: 10 }} className="custom-scroll">
              {licenseContents.length === 0 && pendingAdd.length === 0 ? (
                <Empty description={t('license.addContent.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <>
                  {pendingAdd.map((c) => (
                    <div
                      key={`pending-${c.id}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 0',
                        borderBottom: '1px solid #f5f5f5',
                        color: '#52c41a',
                      }}
                    >
                      <Tooltip title={c.title}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                          {c.title}
                        </span>
                      </Tooltip>
                      <Button
                        type="link"
                        size="small"
                        danger
                        icon={<MinusCircleOutlined />}
                        onClick={() => handleRemovePending(c.id)}
                      />
                    </div>
                  ))}
                  {licenseContents.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 0',
                        borderBottom: '1px solid #f5f5f5',
                      }}
                    >
                      <Tooltip title={c.title}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                          {c.title}
                        </span>
                      </Tooltip>
                      <Button
                        type="link"
                        size="small"
                        danger
                        icon={<MinusCircleOutlined />}
                        onClick={() => void handleRemoveLinked(c.id)}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <CreateContentModal
        open={createContentModalOpen}
        onClose={() => setCreateContentModalOpen(false)}
        onSuccess={() => {
          setCreateContentModalOpen(false)
          if (licenseId) {
            void loadAvailableContents(1, pagination.pageSize, searchFormFilters, withoutLicense)
          }
        }}
      />
    </>
  )
}
