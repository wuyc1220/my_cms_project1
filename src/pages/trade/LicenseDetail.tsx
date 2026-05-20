/**
 * LicenseDetail — 许可证详情页
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
  EditOutlined,
  InfoCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getLicense, getLicenseContents, removeContentFromLicense } from '../../api/licenses'
import { getDictTree } from '../../api/dicts'
import TrimInput from '../../components/TrimInput'
import type { LicenseListItem, LicensePlatformItem, ContentForTradeItem } from '../../types/trade'
import type { DictNodeListItem } from '../../types/dict'
import { useI18n } from '../../i18n/useI18n'
import { usePermission } from '../../hooks/usePermission'
import SectionTitle from '../../components/SectionTitle'
import { EditContentModal } from '../../components/ContentModals'
import ProcessedHistoryTab from '../../components/ProcessedHistoryTab'

const ingestStatusColor = (s: string): string => {
  if (s === 'Published') return 'success'
  if (s === 'Publishing') return 'processing'
  if (s === 'ReadyForPublish') return 'cyan'
  if (s === 'InProgress') return 'processing'
  if (s === 'WaitingForMaterials') return 'warning'
  if (s === 'PublishFailed') return 'error'
  if (s === 'NoActiveLicense' || s === 'Closed') return 'error'
  return 'default'
}

export default function LicenseDetail() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const licenseId = Number(id)

  const { hasPermission } = usePermission()
  const canViewContent = hasPermission('menu.trade.contents.view') || hasPermission('menu.trade.contents.operate')
  const canOperateContent = hasPermission('menu.trade.contents.operate')

  const [loading, setLoading] = useState(true)
  const [license, setLicense] = useState<LicenseListItem | null>(null)

  const [contents, setContents] = useState<ContentForTradeItem[]>([])
  const [contentsLoading, setContentsLoading] = useState(false)

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editContentId, setEditContentId] = useState<number | null>(null)

  const [serviceTypeOptions, setServiceTypeOptions] = useState<DictNodeListItem[]>([])
  const [regionOptions, setRegionOptions] = useState<DictNodeListItem[]>([])
  const [platformOptions, setPlatformOptions] = useState<DictNodeListItem[]>([])

  useEffect(() => {
    if (!id || isNaN(licenseId)) {
      void message.error(t('license.detail.msgInvalidId'), 5)
      navigate('/trade/licenses', { replace: true })
      return
    }

    void (async () => {
      setLoading(true)
      try {
        const [detail, dicts] = await Promise.all([
          getLicense(licenseId),
          getDictTree(),
        ])
        setLicense(detail)
        const serviceTypeRoot = dicts.find((d: DictNodeListItem) => d.code === 'ServiceType')
        setServiceTypeOptions(serviceTypeRoot?.children ?? [])
        const regionRoot = dicts.find((d: DictNodeListItem) => d.code === 'Regions')
        setRegionOptions(regionRoot?.children ?? [])
        const platformRoot = dicts.find((d: DictNodeListItem) => d.code === 'Platform')
        setPlatformOptions(platformRoot?.children ?? [])
      } catch (err) {
        // 错误已由拦截器处理
      } finally {
        setLoading(false)
      }
    })()
  }, [id, licenseId, navigate, t])

  const loadContents = useCallback(async () => {
    setContentsLoading(true)
    try {
      const data = await getLicenseContents(licenseId)
      setContents(data)
    } catch (err) {
      // 错误已由拦截器处理
    } finally {
      setContentsLoading(false)
    }
  }, [licenseId])

  useEffect(() => {
    if (!isNaN(licenseId)) {
      void loadContents()
    }
  }, [licenseId, loadContents])

  const handleRemove = async (contentId: number) => {
    try {
      await removeContentFromLicense(licenseId, contentId)
      void message.success(t('license.detail.msgRemoved'), 3)
      setContents((prev) => prev.filter((c) => c.id !== contentId))
    } catch (err) {
      // 错误已由拦截器处理
    }
  }

  const openEditModal = (contentId: number) => {
    setEditContentId(contentId)
    setEditModalOpen(true)
  }

  const handleEditSuccess = () => {
    setEditModalOpen(false)
    setEditContentId(null)
    void loadContents()
  }

  const contentColumns: ColumnsType<ContentForTradeItem> = [
    {
      title: t('content.col.contentName'),
      dataIndex: 'title',
      key: 'title',
      ellipsis: { showTitle: false },
      render: (val: string) => <Tooltip title={val}><span>{val}</span></Tooltip>,
    },
    {
      title: t('content.col.contentType'),
      dataIndex: 'content_type',
      key: 'content_type',
      width: 120,
    },
    {
      title: t('license.addContent.ingestStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (val: string) => (
        <Tag color={ingestStatusColor(val)}>{val || '—'}</Tag>
      ),
    },
    {
      title: t('trade.col.genre'),
      dataIndex: 'genre',
      key: 'genre',
      width: 120,
      ellipsis: { showTitle: false },
      render: (val: string | null | undefined) =>
        val ? <Tooltip title={val}><span>{val}</span></Tooltip> : '—',
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 140,
      render: (_, record) => (
        <Space size={4}>
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
                onClick={() => openEditModal(record.id)}
              />
            </Tooltip>
          )}

          {canOperateContent && (
            <Popconfirm
              title={t('license.detail.confirmRemoveTitle')}
              description={t('license.detail.confirmRemoveDesc')}
              onConfirm={() => void handleRemove(record.id)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Tooltip title={t('common.remove')}>
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<MinusCircleOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  if (loading) {
    return (
      <div
        className="main-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  if (!license) {
    return (
      <div className="main-container">
        <Empty description={t('license.detail.emptyLicense')} />
      </div>
    )
  }

  return (
    <div className="main-container">
      {/* License Detail */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('common.basicInfo')} />
        <div style={{ paddingLeft: 20 }}>
          <Form layout="vertical">
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item label={t('content.col.licenseName')}>
                  <Tooltip title={license.name || undefined}>
                    <TrimInput value={license.name} disabled style={{ background: '#f5f5f5' }} />
                  </Tooltip>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('content.detail.provider')}>
                  <Tooltip title={license.provider_name || undefined}>
                    <TrimInput value={license.provider_name ?? '—'} disabled style={{ background: '#f5f5f5' }} />
                  </Tooltip>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('license.label.contract')}>
                  <Tooltip title={license.contract_name || undefined}>
                    <TrimInput value={license.contract_name ?? '—'} disabled style={{ background: '#f5f5f5' }} />
                  </Tooltip>
                </Form.Item>
              </Col>

              <Col span={8}>
                <Form.Item label={t('content.col.startDate')}>
                  <TrimInput value={license.start_date ?? '—'} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('content.col.endDate')}>
                  <TrimInput value={license.end_date ?? '—'} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('content.col.serviceType')}>
                  <TrimInput
                    value={serviceTypeOptions.find(opt => opt.code === license.service_type)?.name ?? license.service_type}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('provider.detail.platform')}>
                  <TrimInput
                    value={(license.platforms ?? []).length === 0
                      ? '—'
                      : (license.platforms as LicensePlatformItem[])
                        .map((p) => platformOptions.find(opt => opt.code === p.platform)?.name ?? p.platform)
                        .join(', ')}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item label={t('license.label.regions')}>
                  <TrimInput
                    value={(license.regions ?? []).length === 0
                      ? '—'
                      : license.regions
                        .map((r) => regionOptions.find(opt => opt.code === r)?.name ?? r)
                        .join(', ')}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>



              <Col span={24}>
                <Form.Item label={t('common.notes')}>
                  <TrimInput value={license.notes ?? '—'} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      </div>

      {/* Attached Contents */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('license.detail.tabContents')} />
        <div style={{ paddingLeft: 20 }}>
          <Spin spinning={contentsLoading}>
            <Table<ContentForTradeItem>
              rowKey="id"
              columns={contentColumns}
              dataSource={contents}
              scroll={{ x: 700 }}
              pagination={false}
              locale={{ emptyText: t('license.detail.emptyContents') }}
            />
          </Spin>
        </div>
      </div>

      {/* Processed History */}
      <div>
        <SectionTitle title={t('license.detail.tabHistory')} />
        <div style={{ paddingLeft: 20 }}>
          <ProcessedHistoryTab
            entityType="license"
            entityId={licenseId}
            mode="full"
            excludeTypes={['LICENSE_CONTENT_ADD', 'LICENSE_CONTENT_REMOVE']}
          />
        </div>
      </div>

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
