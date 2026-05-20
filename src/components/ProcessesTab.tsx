/**
 * ProcessesTab — 流程处理记录 Tab（通用组件）
 *
 * 数据来源：getProcesses(id)
 * 列定义：参考 VOD 详情页（6列），已统一为公共样式
 *
 * 使用方式：
 *   <ProcessesTab contentId={id} />
 *   如需刷新，通过 key 强制 remount：
 *   <ProcessesTab key={`processes-${refreshCount}`} contentId={id} />
 */

import { useEffect, useState } from 'react'
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons'
import { message, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getProcesses } from '../api/live'
import { isHandledError } from '../api'
import { useI18n } from '../i18n/useI18n'
import { getClientPaginationProps } from '../constants/pagination'
import type { ProcessListItem } from '../types/live'

interface ProcessesTabProps {
  contentId: number
  refreshVersion?: number
}

// 前次处理状态指示器
function ProcessedBeforeDot({ processedBefore }: { processedBefore?: boolean }) {
  if (processedBefore === undefined || processedBefore === null) {
    return <span>—</span>
  }
  // 对勾 = 重复处理（之前已完成过）
  // 红色X = 首次处理（之前未完成过）
  if (processedBefore === true) {
    return <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />
  }
  return <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 16 }} />
}

export default function ProcessesTab({ contentId, refreshVersion }: ProcessesTabProps) {
  const { t } = useI18n()
  const [data, setData] = useState<ProcessListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 防御性检查：contentId 无效时不发起请求
    if (!contentId || Number.isNaN(contentId)) {
      console.warn('[ProcessesTab] Invalid contentId, skipping API call:', contentId)
      setData([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    getProcesses(contentId)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled && !isHandledError(err)) void message.error(t('content.msg.loadProcessesFailed'), 5)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [contentId, t, refreshVersion])

  const columns: ColumnsType<ProcessListItem> = [
    {
      title: t('content.col.processName'),
      dataIndex: 'name',
      key: 'name',
      width: 120,
      ellipsis: { showTitle: false },
      render: (v: string) => <Tooltip title={v}><span>{v}</span></Tooltip>,
    },
    {
      title: t('content.col.endDateTime'),
      dataIndex: 'end_dt',
      key: 'end_dt',
      width: 160,
      render: (v?: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: t('content.col.processedBefore'),
      dataIndex: 'processed_before',
      key: 'processed_before',
      width: 100,
      align: 'center',
      render: (v?: boolean) => <ProcessedBeforeDot processedBefore={v} />,
    },
    {
      title: t('content.col.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('content.col.assigned'),
      dataIndex: 'assigned',
      key: 'assigned',
      width: 120,
      ellipsis: { showTitle: false },
      render: (v?: string) => v ? <Tooltip title={v}><span>{v}</span></Tooltip> : '—',
    },
    {
      title: t('content.col.info'),
      dataIndex: 'info',
      key: 'info',
      width: 80,
      align: 'center',
      render: (v?: string) =>
        v ? (
          <Tooltip title={v}>
            <span style={{ color: '#1677ff', cursor: 'pointer' }}>详情</span>
          </Tooltip>
        ) : (
          '—'
        ),
    },
  ]

  return (
    <Table<ProcessListItem>
      rowKey="id"
      size="small"
      loading={loading}
      columns={columns}
      dataSource={data}
      scroll={{ x: 700 }}
      pagination={getClientPaginationProps((n) => t('pagination.total', { n }))}
      locale={{ emptyText: t('content.process.noData') }}
    />
  )
}
