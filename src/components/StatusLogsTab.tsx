/**
 * StatusLogsTab — 状态日志 Tab（通用组件）
 *
 * 数据来源：getStatusLogs(id)
 * 列定义：三页已一致，统一为公共组件
 *
 * 使用方式：
 *   <StatusLogsTab contentId={id} />
 *   如需刷新，通过 key 强制 remount：
 *   <StatusLogsTab key={`statusLogs-${refreshCount}`} contentId={id} />
 */

import { useEffect, useState } from 'react'
import { message, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getStatusLogs } from '../api/live'
import { useI18n } from '../i18n/useI18n'
import { getClientPaginationProps } from '../constants/pagination'
import type { StatusLogListItem } from '../types/live'

interface StatusLogsTabProps {
  contentId: number
  refreshVersion?: number
}

export default function StatusLogsTab({ contentId, refreshVersion }: StatusLogsTabProps) {
  const { t } = useI18n()
  const [data, setData] = useState<StatusLogListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getStatusLogs(contentId)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch(() => {
        if (!cancelled) void message.error(t('content.msg.loadStatusLogsFailed'), 5)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [contentId, t, refreshVersion])

  const columns: ColumnsType<StatusLogListItem> = [
    {
      title: t('content.col.processedAt'),
      dataIndex: 'processed_at',
      key: 'processed_at',
      width: 160,
      render: (v?: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: t('content.col.processedBy'),
      dataIndex: 'processed_by',
      key: 'processed_by',
      width: 140,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('content.col.beforeStatus'),
      dataIndex: 'before_status',
      key: 'before_status',
      width: 180,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('content.col.afterStatus'),
      dataIndex: 'after_status',
      key: 'after_status',
      width: 180,
      render: (v?: string) => v ?? '—',
    },
  ]

  return (
    <Table<StatusLogListItem>
      rowKey="id"
      size="small"
      loading={loading}
      columns={columns}
      dataSource={data}
      pagination={getClientPaginationProps((n) => t('pagination.total', { n }))}
      locale={{ emptyText: t('live.channel.emptyStatusLogs') }}
    />
  )
}
