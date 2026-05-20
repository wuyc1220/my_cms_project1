/**
 * LicenseTab — 许可证 Tab（通用组件）
 *
 * 数据来源：getContentLicenses(id)
 * 列定义：三页已一致，统一为公共组件
 *
 * 使用方式：
 *   <LicenseTab contentId={id} />
 *   如需刷新，通过 key 强制 remount：
 *   <LicenseTab key={`license-${refreshCount}`} contentId={id} />
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { message, Table, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { getContentLicenses } from '../api/contents'
import { isHandledError } from '../api'
import { useI18n } from '../i18n/useI18n'
import { getClientPaginationProps } from '../constants/pagination'
import type { ContentLicenseRef } from '../types/content'

interface LicenseTabProps {
  contentId: number
  refreshVersion?: number
}

export default function LicenseTab({ contentId, refreshVersion }: LicenseTabProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [data, setData] = useState<ContentLicenseRef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getContentLicenses(contentId)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled && !isHandledError(err)) void message.error(t('content.msg.loadLicenseFailed'), 5)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [contentId, t, refreshVersion])

  const columns: ColumnsType<ContentLicenseRef> = [
    {
      title: t('content.col.providerName'),
      dataIndex: 'provider_name',
      key: 'provider_name',
      ellipsis: { showTitle: false },
      render: (v: string) => <Tooltip title={v}><span>{v}</span></Tooltip>,
    },
    {
      title: t('content.col.contractName'),
      dataIndex: 'contract_name',
      key: 'contract_name',
      ellipsis: { showTitle: false },
      render: (v: string, record) => (
        <Tooltip title={v}>
          <span
            style={{ color: '#1677ff', cursor: 'pointer' }}
            onClick={() => navigate(`/trade/contracts/${record.contract_id}`)}
          >
            {v}
          </span>
        </Tooltip>
      ),
    },
    {
      title: t('content.col.licenseName'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: { showTitle: false },
      render: (v: string, record) => (
        <Tooltip title={v}>
          <span
            style={{ color: '#1677ff', cursor: 'pointer' }}
            onClick={() => navigate(`/trade/licenses/${record.id}`)}
          >
            {v}
          </span>
        </Tooltip>
      ),
    },
    {
      title: t('content.col.serviceType'),
      dataIndex: 'service_type',
      key: 'service_type',
      width: 120,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: t('content.col.startDate'),
      dataIndex: 'start_date',
      key: 'start_date',
      width: 110,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('content.col.endDate'),
      dataIndex: 'end_date',
      key: 'end_date',
      width: 110,
      render: (v?: string) => v ?? '—',
    },
  ]

  return (
    <Table<ContentLicenseRef>
      rowKey="id"
      size="small"
      loading={loading}
      columns={columns}
      dataSource={data}
      scroll={{ x: 800 }}
      pagination={getClientPaginationProps((n) => t('pagination.total', { n }))}
      locale={{ emptyText: t('trade.content.detail.emptyLicenses') }}
    />
  )
}
