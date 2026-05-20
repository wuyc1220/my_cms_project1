/**
 * ContentDetail — 内容详情页（交易视角）
 *
 * URL: /trade/contents/:id
 *
 * 需求规范（4.2.4.4）：
 *  - 区块一「Content Detail」：基本信息只读（Content Name/Type/Ingest Status/Creation Date/Genre）
 *  - 区块二「Attached Licenses」：关联许可证列表
 *    列：Provider Name / Contract Name / License Name / Service Type / Start Date / End Date / Action(编辑)
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
  Spin,
  Table,
  Tooltip,
  message, Tag,
} from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getContent, getContentLicenses } from '../../api/contents'
import { removeContentFromLicense } from '../../api/licenses'
import TrimInput from '../../components/TrimInput'
import type { ContentListItem, ContentLicenseRef } from '../../types/content'
import { useI18n } from '../../i18n/useI18n'
import { usePermission } from '../../hooks/usePermission'
import SectionTitle from '../../components/SectionTitle'

export default function ContentDetail() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const contentId = Number(id)

  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState<ContentListItem | null>(null)
  const [licenses, setLicenses] = useState<ContentLicenseRef[]>([])
  const [licensesLoading, setLicensesLoading] = useState(false)

  const { hasPermission } = usePermission()
  const canOperateLicense = hasPermission('menu.trade.licenses.operate')

  // ─── 初始化 ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id || isNaN(contentId)) {
      void message.error(t('trade.content.detail.msgInvalidId'), 5)
      navigate('/trade/contents', { replace: true })
      return
    }
    void (async () => {
      setLoading(true)
      try {
        const detail = await getContent(contentId)
        setContent(detail.content)
      } catch (err) {
        // 错误已由拦截器处理
      } finally {
        setLoading(false)
      }
    })()
  }, [id, contentId, navigate])

  const loadLicenses = useCallback(async () => {
    setLicensesLoading(true)
    try {
      const data = await getContentLicenses(contentId)
      setLicenses(data)
    } catch (err) {
      // 错误已由拦截器处理
    } finally {
      setLicensesLoading(false)
    }
  }, [contentId])

  useEffect(() => {
    if (!isNaN(contentId)) {
      void loadLicenses()
    }
  }, [contentId, loadLicenses])

  const handleRemoveLicense = async (licRef: ContentLicenseRef) => {
    try {
      await removeContentFromLicense(licRef.id, contentId)
      void message.success(t('trade.content.detail.removeSuccess'), 3)
      void loadLicenses()
    } catch (err) {
      // 错误已由拦截器处理
    }
  }

  // ─── 许可证列表列定义 ──────────────────────────────────────────────────────

  const licenseColumns: ColumnsType<ContentLicenseRef> = [
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
      render: (val: string) => (
        <Tooltip title={val}>
          <span
            style={{ color: '#1677ff', cursor: 'pointer' }}
            onClick={() => navigate(`/trade/contracts/${(licenses.find((l) => l.contract_name === val))?.contract_id}`)}
          >
            {val}
          </span>
        </Tooltip>
      ),
    },
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
      render: (val: string) => <Tag>{val}</Tag>,
    },
    {
      title: t('content.col.startDate'),
      dataIndex: 'start_date',
      key: 'start_date',
      width: 110,
      render: (val?: string) => val ?? '—',
    },
    {
      title: t('content.col.endDate'),
      dataIndex: 'end_date',
      key: 'end_date',
      width: 110,
      render: (val?: string) => val ?? '—',
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 70,
      render: (_, record) => (
        canOperateLicense ? (
          <Popconfirm
            title={t('trade.content.detail.confirmRemoveTitle')}
            description={t('trade.content.detail.confirmRemoveDesc')}
            onConfirm={() => void handleRemoveLicense(record)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Tooltip title={t('trade.content.detail.removeLicense')}>
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        ) : null
      ),
    },
  ]

  // ─── 渲染 ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="main-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!content) {
    return (
      <div className="main-container">
        <Empty description={t('trade.content.detail.emptyContent')} />
      </div>
    )
  }

  return (
    <div className="main-container">
      {/* Content Detail */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('common.basicInfo')} />
        <div style={{ paddingLeft: 20 }}>
          <Form layout="vertical">
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item label={t('content.col.contentName')}>
                  <Tooltip title={content.title || undefined}>
                    <TrimInput value={content.title} disabled style={{ background: '#f5f5f5' }} />
                  </Tooltip>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('content.col.contentType')}>
                  <TrimInput value={content.content_type} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('license.addContent.ingestStatus')}>
                  <TrimInput value={content.status} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>

              <Col span={8}>
                <Form.Item label={t('trade.content.col.createdAt')}>
                  <TrimInput
                    value={content.created_at ? dayjs(content.created_at).format('YYYY-MM-DD') : '—'}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('trade.col.genre')}>
                  <TrimInput value={content.genre_name ?? '—'} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('trade.content.col.customTags')}>
                  <TrimInput
                    value={content.custom_tag_names && content.custom_tag_names.length > 0
                      ? content.custom_tag_names.join(', ')
                      : '—'}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              {content.parent_title && (
                <Col span={8}>
                  <Form.Item label={t('trade.content.detail.parentLabel')}>
                    <TrimInput value={content.parent_title} disabled style={{ background: '#f5f5f5' }} />
                  </Form.Item>
                </Col>
              )}
              {content.sequence != null && (
                <Col span={8}>
                  <Form.Item label={t('content.col.sequence')}>
                    <TrimInput
                      value={String(content.sequence)}
                      disabled
                      style={{ background: '#f5f5f5' }}
                    />
                  </Form.Item>
                </Col>
              )}
              {content.begin_time && (
                <Col span={8}>
                  <Form.Item label={t('trade.content.form.beginTime')}>
                    <TrimInput
                      value={dayjs(content.begin_time).format('YYYY-MM-DD HH:mm')}
                      disabled
                      style={{ background: '#f5f5f5' }}
                    />
                  </Form.Item>
                </Col>
              )}
              {content.end_time && (
                <Col span={8}>
                  <Form.Item label={t('trade.content.form.endTime')}>
                    <TrimInput
                      value={dayjs(content.end_time).format('YYYY-MM-DD HH:mm')}
                      disabled
                      style={{ background: '#f5f5f5' }}
                    />
                  </Form.Item>
                </Col>
              )}
            </Row>
          </Form>
        </div>
      </div>

      {/* Attached Licenses */}
      <div>
        <SectionTitle title={t('trade.content.detail.tabLicenses')} />
        <div style={{ paddingLeft: 20 }}>
          <Table<ContentLicenseRef>
            rowKey="id"
            loading={licensesLoading}
            columns={licenseColumns}
            dataSource={licenses}
            scroll={{ x: 900 }}
            pagination={{
              pageSize: 10,
              position: ['bottomCenter'],
            }}
            locale={{ emptyText: t('trade.content.detail.emptyLicenses') }}
          />
        </div>
      </div>
    </div>
  )
}
