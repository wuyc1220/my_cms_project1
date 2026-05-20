/**
 * AddContentModal - 为合同添加内容三栏弹窗
 */

import { useEffect, useState } from 'react'
import {
  Button,
  Divider,
  Modal,
  Space,
  Table,
  Tooltip,
  message,
} from 'antd'
import { DeleteOutlined, MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getContractLicenses } from '../../api/contracts'
import { getLicenseContents, addContentsToLicense, removeContentFromLicense, getAvailableContentsForLicense, getUnlicensedContents, deleteLicense } from '../../api/licenses'
import TrimInput from '../TrimInput'
import type { ContractListItem, LicenseSimpleItem, ContentForTradeItem } from '../../types/trade'
import type { PaginatedResponse } from '../../types/basic'
import { PAGINATION_CONFIG } from '../../constants/pagination'
import { useI18n } from '../../i18n/useI18n'
import { usePermission } from '../../hooks/usePermission'
import { CreateContentModal, CreateLicenseModal } from '../ContentModals'
import { isHandledError } from '../../api'


interface AddContentModalProps {
  open: boolean
  contract: ContractListItem | null
  providerName?: string
  onClose: () => void
  onSuccess?: () => void
}

export default function AddContentModal({
  open,
  contract,
  providerName,
  onClose,
  onSuccess,
}: AddContentModalProps) {
  const { t } = useI18n()

  const { hasPermission } = usePermission()
  const canOperateContent = hasPermission('menu.trade.contents.operate')
  const canOperateLicense = hasPermission('menu.trade.licenses.operate')

  const [contractLicenses, setContractLicenses] = useState<LicenseSimpleItem[]>([])
  const [selectedLicense, setSelectedLicense] = useState<LicenseSimpleItem | null>(null)
  const [licenseContents, setLicenseContents] = useState<ContentForTradeItem[]>([])
  const [pendingAdd, setPendingAdd] = useState<ContentForTradeItem[]>([])
  const [savingContents, setSavingContents] = useState(false)
  const [licenseSearch, setLicenseSearch] = useState('')
  const [availableContents, setAvailableContents] = useState<PaginatedResponse<ContentForTradeItem>>({
    total: 0,
    page: 1,
    page_size: PAGINATION_CONFIG.defaultPageSize,
    items: [],
  })
  const [availableLoading, setAvailableLoading] = useState(false)
  const [contentSearch, setContentSearch] = useState('')

  // 新增内容弹窗状态
  const [createContentModalOpen, setCreateContentModalOpen] = useState(false)

  // 新增许可证弹窗状态
  const [createLicenseModalOpen, setCreateLicenseModalOpen] = useState(false)

  useEffect(() => {
    if (open && contract) {
      setSelectedLicense(null)
      setLicenseContents([])
      setPendingAdd([])
      setLicenseSearch('')
      setContentSearch('')
      void loadContractLicensesList(contract.id, undefined, true)
      void loadAvailableContentsList(null, 1, '')
    }
  }, [open, contract])

  const loadContractLicensesList = async (contractId: number, name?: string, autoSelect = false) => {
    try {
      const items = await getContractLicenses(contractId, name)
      setContractLicenses(items)
      if (items.length > 0 && autoSelect) {
        const target = items[0]
        setSelectedLicense(target)
        await loadLicenseContentsList(target.id)
        void loadAvailableContentsList(target.id, 1, '')
      }
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('contract.msg.licenseLoadFailed'), 5)
    }
  }

  const loadAvailableContentsList = async (
    licenseId: number | null,
    targetPage: number,
    search: string,
    targetPageSize?: number
  ) => {
    setAvailableLoading(true)
    try {
      let data: PaginatedResponse<ContentForTradeItem>
      if (licenseId !== null) {
        data = await getAvailableContentsForLicense(licenseId, {
          page: targetPage,
          page_size: targetPageSize ?? PAGINATION_CONFIG.defaultPageSize,
          title: search || undefined,
        })
      } else {
        data = await getUnlicensedContents({
          page: targetPage,
          page_size: targetPageSize ?? PAGINATION_CONFIG.defaultPageSize,
          title: search || undefined,
        })
      }
      setAvailableContents(data)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('contract.msg.contentLoadFailed'), 5)
    } finally {
      setAvailableLoading(false)
    }
  }

  const loadLicenseContentsList = async (licenseId: number) => {
    try {
      const items = await getLicenseContents(licenseId)
      setLicenseContents(items)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('contract.msg.contentLoadFailed'), 5)
    }
  }

  const handleSelectLicense = async (license: LicenseSimpleItem) => {
    setSelectedLicense(license)
    setPendingAdd([])
    await loadLicenseContentsList(license.id)
    void loadAvailableContentsList(license.id, 1, contentSearch)
  }

  const handleDeleteLicense = async (license: LicenseSimpleItem) => {
    try {
      await deleteLicense(license.id)
      void message.success(t('common.msg.deleted'), 3)
      if (selectedLicense?.id === license.id) {
        setSelectedLicense(null)
        setLicenseContents([])
      }
      if (contract) {
        await loadContractLicensesList(contract.id)
      }
      onSuccess?.()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('common.msg.deleteFailed'), 5)
    }
  }

  const handleQueueContent = (content: ContentForTradeItem) => {
    const alreadyLinked = licenseContents.some((c) => c.id === content.id)
    const alreadyPending = pendingAdd.some((c) => c.id === content.id)
    if (alreadyLinked || alreadyPending) {
      void message.warning(t('contract.msg.contentAlreadyInLicense'), 3)
      return
    }
    setPendingAdd((prev) => [...prev, content])
  }

  const handleRemovePending = (contentId: number) => {
    setPendingAdd((prev) => prev.filter((c) => c.id !== contentId))
  }

  // Bug 31462: 移除已关联的内容
  const handleRemoveLinkedContent = async (contentId: number) => {
    if (!selectedLicense) return
    try {
      await removeContentFromLicense(selectedLicense.id, contentId)
      setLicenseContents((prev) => prev.filter((c) => c.id !== contentId))
      void message.success(t('common.msg.saveSuccess'), 3)
      void loadAvailableContentsList(selectedLicense.id, availableContents.page, contentSearch)
      onSuccess?.()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('common.msg.removeFailed'), 5)
    }
  }

  const handleSaveContents = async () => {
    if (!selectedLicense || pendingAdd.length === 0) return
    setSavingContents(true)
    try {
      const updated = await addContentsToLicense(selectedLicense.id, {
        content_ids: pendingAdd.map((c) => c.id),
      })
      setLicenseContents(updated)
      setPendingAdd([])
      void message.success(t('common.msg.saveSuccess'), 3)
      void loadAvailableContentsList(selectedLicense.id, availableContents.page, contentSearch)
      onSuccess?.()
      onClose() // Bug 31457: 保存成功后关闭弹窗
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('common.msg.saveFailed'), 5)
    } finally {
      setSavingContents(false)
    }
  }

  const handleLicenseSearch = () => {
    if (contract) {
      void loadContractLicensesList(contract.id, licenseSearch || undefined)
    }
  }

  // 左栏可选内容列定义
  const availableColumns: ColumnsType<ContentForTradeItem> = [
    {
      title: t('content.col.contentName'),
      dataIndex: 'title',
      key: 'title',
      ellipsis: { showTitle: true },
    },
    {
      title: t('content.col.contentType'),
      dataIndex: 'content_type',
      key: 'content_type',
      width: 90,
    },
    {
      title: t('trade.col.genre'),
      dataIndex: 'genre',
      key: 'genre',
      width: 90,
      ellipsis: { showTitle: false },
      render: (val: string | undefined) =>
        val ? <Tooltip title={val}><span>{val}</span></Tooltip> : '—',
    },
    {
      title: t('trade.col.licence'),
      dataIndex: 'license_names',
      key: 'license_names',
      width: 120,
      ellipsis: { showTitle: false },
      render: (names: string[]) => {
        const text = names?.join(', ') || '—'
        return (
          <Tooltip title={names?.length ? text : undefined}>
            <span style={{ color: '#888' }}>{text}</span>
          </Tooltip>
        )
      },
    },
    {
      title: t('content.col.action'),
      key: 'action',
      fixed: 'right',
      width: 60,
      render: (_, row) => (
        <Button
          type="link"
          size="small"
          icon={<PlusOutlined />}
          disabled={!selectedLicense}
          onClick={() => handleQueueContent(row)}
        />
      ),
    },
  ]

  // 中栏许可证列定义
  const licenseColumns: ColumnsType<LicenseSimpleItem> = [
    {
      title: t('content.col.licenseName'),
      dataIndex: 'name',
      key: 'name',
      width: 140,
      ellipsis: { showTitle: false },
      render: (val: string) => <Tooltip title={val}><span>{val}</span></Tooltip>,
    },
    {
      title: t('content.col.serviceType'),
      dataIndex: 'service_type',
      key: 'service_type',
      width: 90,
      ellipsis: { showTitle: false },
    },
    {
      title: t('content.col.startDate'),
      dataIndex: 'start_date',
      key: 'start_date',
      width: 95,
      render: (val: string | undefined) => val ?? '—',
    },
    {
      title: t('content.col.endDate'),
      dataIndex: 'end_date',
      key: 'end_date',
      width: 95,
      render: (val: string | undefined) => val ?? '—',
    },
    {
      title: t('content.col.action'),
      key: 'action',
      fixed: 'right',
      width: 90,
      render: (_, row) => (
        <Space size={0}>
          <Tooltip title={t('trade.addContent.selectLicense')}>
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => void handleSelectLicense(row)}
            />
          </Tooltip>
          {canOperateLicense && (
            <Tooltip title={t('common.delete')}>
              <Button
                type="link"
                size="small"
                icon={<DeleteOutlined />}
                danger
                onClick={() => void handleDeleteLicense(row)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
    <Modal
      title={`${t('contract.addContent.title')} — ${contract?.name ?? ''}`}
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="primary"
            loading={savingContents}
            disabled={pendingAdd.length === 0 || !selectedLicense}
            onClick={() => void handleSaveContents()}
          >
            {t('common.confirm')}
          </Button>
        </Space>
      }
      width="80%"
      destroyOnHidden
    >
      <div style={{ display: 'flex', gap: 0, height: 520 }}>
        {/* 左栏：可选内容列表 */}
        <div style={{ flex: 3, minWidth: 0, display: 'flex', flexDirection: 'column', paddingRight: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 500 }}>{t('trade.addContent.contentList')}</span>
            
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Space>
              <TrimInput
                placeholder={t('license.addContent.contentName')}
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
                onPressEnter={() =>
                  void loadAvailableContentsList(selectedLicense?.id ?? null, 1, contentSearch)
                }
                style={{ width: 220 }}
              />
              <Button
                onClick={() =>
                  void loadAvailableContentsList(selectedLicense?.id ?? null, 1, contentSearch)
                }
              >
                {t('common.search')}
              </Button>
            </Space>
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
              loading={availableLoading}
              columns={availableColumns}
              dataSource={availableContents.items}
              scroll={{ y: 360 }}
              rootClassName="compact-table"
              pagination={{
                current: availableContents.page,
                pageSize: availableContents.page_size,
                total: availableContents.total,
                size: 'small',
                showTotal: (n) => t('pagination.total', { n }),
                position: ['bottomCenter'],
                onChange: (p, ps) =>
                  void loadAvailableContentsList(selectedLicense?.id ?? null, p, contentSearch, ps),
              }}
            />
          </div>
        </div>

        <Divider type="vertical" style={{ height: '100%' }} />

        {/* 中栏：许可证列表 */}
        <div style={{ flex: 3, minWidth: 0, display: 'flex', flexDirection: 'column', paddingLeft: 12, paddingRight: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 500 }}>{t('trade.addContent.licenseList')}</span>
            
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Space>
              <TrimInput
                placeholder={t('license.addContent.licenseLabel')}
                value={licenseSearch}
                onChange={(e) => setLicenseSearch(e.target.value)}
                onPressEnter={handleLicenseSearch}
                style={{ width: 220 }}
                allowClear
              />
              <Button onClick={handleLicenseSearch}>
                {t('common.search')}
              </Button>
            </Space>
            {canOperateLicense && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateLicenseModalOpen(true)}
              >
                {t('trade.addContent.newLicense')}
              </Button>
            )}
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Table<LicenseSimpleItem>
              rowKey="id"
              size="small"
              columns={licenseColumns}
              dataSource={contractLicenses}
              scroll={{ y: 360 }}
              rootClassName="compact-table"
              rowClassName={(row) =>
                selectedLicense?.id === row.id ? 'ant-table-row-selected' : ''
              }
              pagination={{
                pageSize: 20,
                size: 'small',
                showSizeChanger: true,
                pageSizeOptions: PAGINATION_CONFIG.pageSizeOptions.map(String),
                showTotal: (n) => t('pagination.total', { n }),
                position: ['bottomCenter'],
              }}
              locale={{ emptyText: t('contract.empty.noLicenses') }}
            />
          </div>
        </div>

        <Divider type="vertical" style={{ height: '100%' }} />

        {/* 右栏：上下文 + 许可证内容 */}
        <div style={{ flex: 2, minWidth: 0, display: 'flex', flexDirection: 'column', paddingLeft: 12 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 8, fontSize: 13 }}>{t('trade.addContent.provider')}</div>
            <Tooltip title={providerName ?? contract?.provider_name}>
              <TrimInput
                value={providerName ?? contract?.provider_name ?? '—'}
                disabled
                style={{ marginBottom: 10 }}
              />
            </Tooltip>
            <div style={{ marginBottom: 8, fontSize: 13 }}>{t('trade.addContent.contract')}</div>
            <Tooltip title={contract?.name}>
              <TrimInput
                value={contract?.name ?? '—'}
                disabled
                style={{ marginBottom: 10 }}
              />
            </Tooltip>
            <div style={{ marginBottom: 8, fontSize: 13 }}>{t('trade.addContent.selectedLicense')}</div>
            <Tooltip title={selectedLicense?.name}>
              <TrimInput
                value={selectedLicense ? selectedLicense.name : '—'}
                disabled
                style={{
                  marginBottom: 12,
                }}
              />
            </Tooltip>
          </div>

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
          <div style={{ flex: 1, overflow: 'auto', paddingLeft: 10,paddingRight: 10 }} className='custom-scroll'>
            {[...pendingAdd].reverse().map((c) => (
              <div
                key={`pending-${c.id}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <Tooltip title={c.title}>
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginRight: 8,
                      fontSize: 13,
                    }}
                  >
                    {c.title}
                  </span>
                </Tooltip>
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleRemovePending(c.id)}
                />
              </div>
            ))}

            {licenseContents.map((c) => (
              <div
                key={`linked-${c.id}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <Tooltip title={c.title}>
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginRight: 8,
                      fontSize: 13,
                    }}
                  >
                    {c.title}
                  </span>
                </Tooltip>
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<MinusCircleOutlined />}
                  onClick={() => void handleRemoveLinkedContent(c.id)}
                />
              </div>
            ))}

            {licenseContents.length === 0 && pendingAdd.length === 0 && (
              <div style={{ color: '#bbb', textAlign: 'center', paddingTop: 24, fontSize: 13 }}>
                {selectedLicense ? t('contract.empty.noContent') : t('contract.empty.selectLicense')}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>

      {/* 新增内容弹窗 */}
      <CreateContentModal
        open={createContentModalOpen}
        onClose={() => setCreateContentModalOpen(false)}
        onSuccess={() => {
          setCreateContentModalOpen(false)
          // 刷新可选内容列表
          void loadAvailableContentsList(selectedLicense?.id ?? null, 1, contentSearch)
          onSuccess?.()
        }}
      />

      {/* 新增许可证弹窗 */}
      <CreateLicenseModal
        open={createLicenseModalOpen}
        prefilledContract={contract ? { id: contract.id, name: contract.name } : null}
        onClose={() => setCreateLicenseModalOpen(false)}
        onSuccess={() => {
          setCreateLicenseModalOpen(false)
          // 刷新许可证列表
          if (contract) {
            void loadContractLicensesList(contract.id)
          }
          onSuccess?.()
        }}
      />
    </>
  )
}
