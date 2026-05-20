/**
 * ContractDetail — 合同详情页
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Col,
  Empty,
  Form,
  Popconfirm,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  InfoCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getContract, getContractAttachments, downloadContractAttachment } from '../../api/contracts'
import { getLicenses, updateLicense } from '../../api/licenses'
import { getDictTree } from '../../api/dicts'
import TrimInput from '../../components/TrimInput'
import type {
  ContractListItem,
  ContractAttachmentItem,
  ContractPlatformItem,
  LicenseListItem,
  LicensePlatformItem,
} from '../../types/trade'
import type { DictNodeListItem } from '../../types/dict'
import { useI18n } from '../../i18n/useI18n'
import { usePermission } from '../../hooks/usePermission'
import { LicenseAddContentModal, EditLicenseModal } from '../../components/ContentModals'
import SectionTitle from '../../components/SectionTitle'
import ProcessedHistoryTab from '../../components/ProcessedHistoryTab'
import { getPlatformColor } from '../../constants/platform'

const licenseStatusColor = (status: string): string => {
  if (status === 'ACTIVE') return 'success'
  if (status === 'INACTIVE') return 'default'
  if (status === 'EXPIRED') return 'error'
  if (status === 'DELETED') return 'error'
  return 'default'
}

export default function ContractDetail() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const contractId = Number(id)
  const { hasPermission } = usePermission()

  const canViewLicense = hasPermission('menu.trade.licenses.view') || hasPermission('menu.trade.licenses.operate')
  const canOperateLicense = hasPermission('menu.trade.licenses.operate')

  const [loading, setLoading] = useState(true)
  const [contract, setContract] = useState<ContractListItem | null>(null)

  const [licenses, setLicenses] = useState<LicenseListItem[]>([])
  const [licensesLoading, setLicensesLoading] = useState(false)
  const [licensePage, setLicensePage] = useState(1)
  const [licenseTotal, setLicenseTotal] = useState(0)

  const [attachments, setAttachments] = useState<ContractAttachmentItem[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)

  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const [platformOptions, setPlatformOptions] = useState<{ label: string; value: string }[]>([])

  const [addContentModal, setAddContentModal] = useState<{
    open: boolean
    licenseId: number
    licenseRecord: LicenseListItem | null
  }>({ open: false, licenseId: 0, licenseRecord: null })

  const [editLicenseModal, setEditLicenseModal] = useState<{
    open: boolean
    licenseId: number | null
  }>({ open: false, licenseId: null })

  useEffect(() => {
    if (!id || isNaN(contractId)) {
      void message.error(t('contract.detail.msgInvalidId'), 5)
      navigate('/trade/contracts', { replace: true })
      return
    }

    void (async () => {
      setLoading(true)
      try {
        const [detail, dicts] = await Promise.all([
          getContract(contractId),
          getDictTree(),
        ])
        setContract(detail)
        const platformRoot = dicts.find((d: DictNodeListItem) => d.code === 'Platform')
        setPlatformOptions(
          (platformRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })),
        )
      } catch (err) {
        // 错误已由拦截器处理
      } finally {
        setLoading(false)
      }
    })()
  }, [id, contractId, navigate])

  const loadLicenses = useCallback(async (targetPage = 1) => {
    setLicensesLoading(true)
    try {
      const data = await getLicenses({ contract_id: contractId, page: targetPage, page_size: 10 })
      setLicenses(data.items)
      setLicenseTotal(data.total)
      setLicensePage(data.page)
    } catch (err) {
      // 错误已由拦截器处理
    } finally {
      setLicensesLoading(false)
    }
  }, [contractId])

  const loadAttachments = useCallback(async () => {
    setAttachmentsLoading(true)
    try {
      const data = await getContractAttachments(contractId)
      setAttachments(data)
    } catch (err) {
      // 错误已由拦截器处理
    } finally {
      setAttachmentsLoading(false)
    }
  }, [contractId])

  useEffect(() => {
    if (!isNaN(contractId)) {
      void loadLicenses(1)
      void loadAttachments()
    }
  }, [contractId, loadLicenses, loadAttachments])

  const handleUnlinkLicense = async (licenseId: number) => {
    try {
      await updateLicense(licenseId, { unlink_contract: true })
      void message.success(t('contract.detail.msgUnlinked'), 3)
      void loadLicenses(licensePage)
    } catch (err) {
      // 错误已由拦截器处理
    }
  }

  const handleDownloadAttachment = async (attachment: ContractAttachmentItem) => {
    setDownloadingId(attachment.id)
    try {
      const blob = await downloadContractAttachment(attachment.contract_id, attachment.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      // 错误已由拦截器处理
    } finally {
      setDownloadingId(null)
    }
  }

  const licenseColumns: ColumnsType<LicenseListItem> = [
    {
      title: t('content.col.licenseName'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: { showTitle: false },
      render: (val: string, record) => (
        <Tooltip title={val}>
          <span
            style={{ color: '#1677ff', cursor: 'pointer' }}
            onClick={() => navigate(`/trade/licenses/${record.id}`)}
          >
            {val}
          </span>
        </Tooltip>
      ),
    },
    {
      title: t('content.col.serviceType'),
      dataIndex: 'service_type',
      key: 'service_type',
      width: 130,
      ellipsis: { showTitle: false },
      render: (val: string) => <Tooltip title={val}><span>{val}</span></Tooltip>,
    },
    {
      title: t('content.col.startDate'),
      dataIndex: 'start_date',
      key: 'start_date',
      width: 120,
      render: (val: string | undefined) => val ?? '—',
    },
    {
      title: t('content.col.endDate'),
      dataIndex: 'end_date',
      key: 'end_date',
      width: 120,
      render: (val: string | undefined) => val ?? '—',
    },
    {
      title: t('provider.detail.platform'),
      dataIndex: 'platforms',
      key: 'platforms',
      width: 330,
      render: (platforms: LicensePlatformItem[]) => (
        <Space size={4} wrap>
          {(platforms ?? []).map((p) => (
            <Tag key={p.platform} color={getPlatformColor(p.platform)}>
              {p.platform}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (val: string) => (
        <Tag color={licenseStatusColor(val)}>{val}</Tag>
      ),
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 120,
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
          {canOperateLicense && (
            <Tooltip title={t('contract.detail.tooltipAddLicenseContent')}>
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={() =>
                  setAddContentModal({ open: true, licenseId: record.id, licenseRecord: record })
                }
              />
            </Tooltip>
          )}
          {canOperateLicense && (
            <Tooltip title={t('common.edit')}>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() =>
                  setEditLicenseModal({ open: true, licenseId: record.id })
                }
              />
            </Tooltip>
          )}
          {canOperateLicense && (
            <Popconfirm
              title={t('contract.detail.confirmUnlinkLicense')}
              onConfirm={() => void handleUnlinkLicense(record.id)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Tooltip title={t('contract.detail.tooltipUnlinkLicense')}>
                <Button type="link" size="small" icon={<DeleteOutlined />} danger />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const attachmentColumns: ColumnsType<ContractAttachmentItem> = [
    {
      title: t('content.col.fileName'),
      dataIndex: 'file_name',
      key: 'file_name',
      ellipsis: { showTitle: false },
      render: (val: string) => <Tooltip title={val}><span>{val}</span></Tooltip>,
    },
    {
      title: t('content.col.fileSize'),
      dataIndex: 'file_size',
      key: 'file_size',
      width: 120,
      render: (val: number | undefined) => {
        if (!val) return '—'
        if (val < 1024) return `${val} B`
        if (val < 1024 * 1024) return `${(val / 1024).toFixed(1)} KB`
        return `${(val / 1024 / 1024).toFixed(1)} MB`
      },
    },
    {
      title: t('contract.col.uploadedAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (val: string | undefined) =>
        val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '—',
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 100,
      render: (_, row) => (
        <Tooltip title={t('contract.tooltip.download')}>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            loading={downloadingId === row.id}
            onClick={() => void handleDownloadAttachment(row)}
          />
        </Tooltip>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="main-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="main-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description={t('contract.detail.emptyContract')} />
      </div>
    )
  }

  return (
    <div className="main-container">
      {/* Contract Detail */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('common.basicInfo')} />
        <div style={{ paddingLeft: 20 }}>
        <Form layout="vertical">
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item label={t('content.col.contractName')}>
                <Tooltip title={contract.name || undefined}>
                  <TrimInput value={contract.name} disabled style={{ background: '#f5f5f5' }} />
                </Tooltip>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={t('content.detail.provider')}>
                <Tooltip title={contract.provider_name || undefined}>
                  <TrimInput
                    value={contract.provider_name ?? '—'}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Tooltip>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={t('contract.detail.licenseCount')}>
                <TrimInput
                  value={String(contract.license_count ?? 0)}
                  disabled
                  style={{ background: '#f5f5f5' }}
                />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item label={t('content.col.startDate')}>
                <TrimInput value={contract.start_date ?? '—'} disabled style={{ background: '#f5f5f5' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={t('content.col.endDate')}>
                <TrimInput value={contract.end_date ?? '—'} disabled style={{ background: '#f5f5f5' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={t('contract.detail.createdAt')}>
                <TrimInput
                  value={contract.created_at ? dayjs(contract.created_at).format('YYYY-MM-DD HH:mm:ss') : '—'}
                  disabled
                  style={{ background: '#f5f5f5' }}
                />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item label={t('provider.detail.platform')}>
                <TrimInput
                  value={(contract.platforms ?? []).length === 0
                    ? '—'
                    : (contract.platforms as ContractPlatformItem[])
                      .map((p) => platformOptions.find(opt => opt.value === p.platform)?.label ?? p.platform)
                      .join(', ')}
                  disabled
                  style={{ background: '#f5f5f5' }}
                />
              </Form.Item>
            </Col>

            <Col span={16}>
              <Form.Item label={t('common.notes')}>
                <TrimInput value={contract.notes ?? '—'} disabled style={{ background: '#f5f5f5' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
        </div>
      </div>

      {/* Licenses */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('contract.detail.tabLicenses')} />
        <div style={{ paddingLeft: 20 }}>
        <Table<LicenseListItem>
          rowKey="id"
          size="small"
          loading={licensesLoading}
          columns={licenseColumns}
          dataSource={licenses}
          scroll={{ x: 960 }}
          pagination={{
            current: licensePage,
            pageSize: 10,
            total: licenseTotal,
            showSizeChanger: false,
            position: ['bottomCenter'],
            onChange: (p) => void loadLicenses(p),
          }}
          locale={{ emptyText: t('contract.detail.emptyLicenses') }}
        />
        </div>
      </div>

      {/* History */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('contract.detail.tabHistory')} />
        <div style={{ paddingLeft: 20 }}>
          <ProcessedHistoryTab entityType="contract" entityId={contractId} mode="full" />
        </div>
      </div>

      {/* Attachments */}
      <div>
        <SectionTitle title={t('contract.detail.tabAttachments')} />
        <div style={{ paddingLeft: 20 }}>
        <Spin spinning={attachmentsLoading}>
          {attachments.length === 0 && !attachmentsLoading ? (
            <Empty
              description={t('contract.detail.emptyAttachments')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: '40px 0' }}
            />
          ) : (
            <Table<ContractAttachmentItem>
              rowKey="id"
              size="small"
              columns={attachmentColumns}
              dataSource={attachments}
              scroll={{ x: 600 }}
              pagination={false}
              locale={{ emptyText: t('contract.detail.emptyAttachments') }}
            />
          )}
        </Spin>
        </div>
      </div>

      <LicenseAddContentModal
        open={addContentModal.open}
        licenseId={addContentModal.licenseId}
        licenseRecord={addContentModal.licenseRecord}
        onClose={() => setAddContentModal({ open: false, licenseId: 0, licenseRecord: null })}
        onSuccess={() => void loadLicenses(licensePage)}
      />

      <EditLicenseModal
        open={editLicenseModal.open}
        licenseId={editLicenseModal.licenseId}
        onClose={() => setEditLicenseModal({ open: false, licenseId: null })}
        onSuccess={() => void loadLicenses(licensePage)}
      />
    </div>
  )
}
