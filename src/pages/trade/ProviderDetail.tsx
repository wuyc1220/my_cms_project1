/**
 * ProviderDetail — 供应商详情页
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Empty,
  Form,
  Row,
  Col,
  Spin,
  Tooltip,
  message,
} from 'antd'
import { getProvider, getProviderContracts } from '../../api/providers'
import type { ProviderListItem, ContractListItem } from '../../types/trade'
import type { DictNodeListItem } from '../../types/dict'
import { getDictTree } from '../../api/dicts'
import { useI18n } from '../../i18n/useI18n'
import SectionTitle from '../../components/SectionTitle'
import TrimInput from '../../components/TrimInput'
import { ContractTable } from '../../components/ContractModals'
import ProcessedHistoryTab from '../../components/ProcessedHistoryTab'

export default function ProviderDetail() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const providerId = Number(id)

  const [loading, setLoading] = useState(true)
  const [provider, setProvider] = useState<ProviderListItem | null>(null)
  const [reviewLevelOptions, setReviewLevelOptions] = useState<{ label: string; value: string }[]>([])
  const [platformOptions, setPlatformOptions] = useState<{ label: string; value: string }[]>([])
  const [contracts, setContracts] = useState<ContractListItem[]>([])
  const [contractsLoading, setContractsLoading] = useState(false)

  useEffect(() => {
    if (!id || isNaN(providerId)) {
      void message.error(t('provider.detail.msgInvalidId'), 5)
      navigate('/trade/providers', { replace: true })
      return
    }

    void (async () => {
      setLoading(true)
      try {
        const [detail, dicts] = await Promise.all([
          getProvider(providerId),
          getDictTree(),
        ])

        setProvider(detail)

        const reviewRoot = dicts.find((d: DictNodeListItem) => d.code === 'Content_review_level')
        setReviewLevelOptions(
          (reviewRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })),
        )

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
  }, [id, providerId, navigate])

  const loadContracts = useCallback(async () => {
    setContractsLoading(true)
    try {
      const data = await getProviderContracts(providerId)
      setContracts(data)
    } catch (err) {
      // 错误已由拦截器处理
    } finally {
      setContractsLoading(false)
    }
  }, [providerId])

  useEffect(() => {
    if (!isNaN(providerId)) {
      void loadContracts()
    }
  }, [providerId, loadContracts])

  const handleContractDetail = (record: ContractListItem) => {
    navigate(`/trade/contracts/${record.id}`)
  }

  const handleContractsChange = () => {
    void loadContracts()
  }

  if (loading) {
    return (
      <div className="main-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!provider) {
    return (
      <div className="main-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description={t('provider.detail.emptyProvider')} />
      </div>
    )
  }

  const levelIndex = reviewLevelOptions.findIndex((o) => o.value === provider.review_level)
  const reviewLevelLabel =
    levelIndex >= 0 ? reviewLevelOptions[levelIndex].label : (provider.review_level ?? '—')
  const showL1 = levelIndex >= 1
  const showL2 = levelIndex >= 2
  const showL3 = levelIndex >= 3

  return (
    <div className="main-container">
      {/* Provider Detail */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('common.basicInfo')} />
        <div style={{ paddingLeft: 20 }}>
          <Form layout="vertical">
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item label={t('provider.detail.labelCode')}>
                  <TrimInput value={provider.provider_code ?? '—'} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('provider.detail.labelName')}>
                  <Tooltip title={provider.name || undefined}>
                    <TrimInput value={provider.name} disabled style={{ background: '#f5f5f5' }} />
                  </Tooltip>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('provider.detail.labelCountry')}>
                  <TrimInput value={provider.country ?? '—'} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('provider.detail.labelReviewLevel')}>
                  <TrimInput value={reviewLevelLabel} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              {showL1 && (
                <Col span={8}>
                  <Form.Item label={t('provider.detail.labelL1')}>
                    <TrimInput
                      value={
                        provider.l1_assignee_name ??
                        (provider.l1_assignee_id ? String(provider.l1_assignee_id) : '—')
                      }
                      disabled
                      style={{ background: '#f5f5f5' }}
                    />
                  </Form.Item>
                </Col>
              )}
              {showL2 && (
                <Col span={8}>
                  <Form.Item label={t('provider.detail.labelL2')}>
                    <TrimInput
                      value={
                        provider.l2_assignee_name ??
                        (provider.l2_assignee_id ? String(provider.l2_assignee_id) : '—')
                      }
                      disabled
                      style={{ background: '#f5f5f5' }}
                    />
                  </Form.Item>
                </Col>
              )}
              {showL3 && (
                <Col span={8}>
                  <Form.Item label={t('provider.detail.labelL3')}>
                    <TrimInput
                      value={
                        provider.l3_assignee_name ??
                        (provider.l3_assignee_id ? String(provider.l3_assignee_id) : '—')
                      }
                      disabled
                      style={{ background: '#f5f5f5' }}
                    />
                  </Form.Item>
                </Col>
              )}
              <Col span={24}>
                <Form.Item label={t('common.notes')}>
                  <TrimInput value={provider.notes ?? '—'} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      </div>

      {/* Attached Contract */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('provider.detail.tabContracts')} />
        <div style={{ paddingLeft: 20 }}>
          <ContractTable
            dataSource={contracts}
            loading={contractsLoading}
            platformOptions={platformOptions}
            showProvider={false}
            showDetail={true}
            showAddContent={true}
            showEdit={true}
            showDelete={true}
            showAttachments={true}
            onDetail={handleContractDetail}
            onDataChange={handleContractsChange}
          />
        </div>
      </div>

      {/* Processed History */}
      <div>
        <SectionTitle title={t('provider.detail.tabHistory')} />
        <div style={{ paddingLeft: 20 }}>
          <ProcessedHistoryTab entityType="provider" entityId={providerId} mode="full" />
        </div>
      </div>
    </div>
  )
}
