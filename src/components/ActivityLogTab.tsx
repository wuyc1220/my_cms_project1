import { useCallback, useEffect, useMemo, useState } from 'react'
import { message, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getActivityLogs } from '../api/live'
import { isHandledError } from '../api'
import { useI18n } from '../i18n/useI18n'
import type { MessageKey } from '../i18n/messages'
import type { ActivityLogListItem } from '../types/live'

const ADD_TYPES = new Set([
  'PROVIDER_CREATE', 'CONTRACT_CREATE', 'LICENSE_CREATE',
  'CONTENT_CREATE', 'USER_CREATE', 'ROLE_CREATE',
  'DICT_CREATE', 'CONFIG_CREATE', 'PACKAGE_CREATE',
  'SCHEDULE_CREATE', 'CAST_CREATE', 'CATEGORY_CREATE',
  'GENRE_CREATE', 'TAG_CREATE', 'CUSTOM_TAG_CREATE',
  'CONTENT_TYPE_CREATE', 'POSTER_SIZE_CREATE', 'CUSTOM_FIELD_CREATE',
  'SENSITIVE_WORD_CREATE', 'METADATA_SOURCE_CREATE', 'CRAWL_TASK_CREATE',
  'LICENSE_CONTENT_ADD', 'PACKAGE_CONTENT_ADD',
  'PHYSICAL_CHANNEL_CREATE', 'CHANNEL_METADATA_CREATE',
  'POSTER_UPLOAD',
])

const DELETE_TYPES = new Set([
  'PROVIDER_DELETE', 'CONTRACT_DELETE', 'LICENSE_DELETE',
  'CONTENT_DELETE', 'USER_DELETE', 'ROLE_DELETE',
  'DICT_DELETE', 'CONFIG_DELETE', 'PACKAGE_DELETE',
  'SCHEDULE_DELETE', 'CAST_DELETE', 'CATEGORY_DELETE',
  'GENRE_DELETE', 'TAG_DELETE', 'CUSTOM_TAG_DELETE',
  'CONTENT_TYPE_DELETE', 'POSTER_SIZE_DELETE', 'CUSTOM_FIELD_DELETE',
  'SENSITIVE_WORD_DELETE', 'METADATA_SOURCE_DELETE', 'CRAWL_TASK_DELETE',
  'CONTRACT_ATTACHMENT_DELETE', 'LICENSE_CONTENT_REMOVE', 'PACKAGE_CONTENT_REMOVE',
  'PHYSICAL_CHANNEL_DELETE', 'CHANNEL_METADATA_DELETE',
  'POSTER_DELETE',
])

const ATTACHED_TYPES = new Set([
  'CONTENT_PACKAGE_LINK', 'CONTENT_PACKAGE_UNLINK',
  'CONTENT_CATEGORY_LINK', 'CONTENT_CATEGORY_UNLINK',
])

const REVIEW_TYPES = new Set([
  'CONTENT_REVIEW_INITIATE', 'CONTENT_REVIEW_APPROVE', 'CONTENT_REVIEW_REJECT',
])

const PUBLISHED_TYPES = new Set(['PUBLISH_NOW', 'PUBLISH_BATCH'])
const UNPUBLISHED_TYPES = new Set(['UNPUBLISH_NOW', 'UNPUBLISH_BATCH'])
const PLAN_TYPES = new Set(['PUBLISH_PLAN_CREATE', 'PUBLISH_PLAN_UPDATE', 'PUBLISH_PLAN_CANCEL'])

function getTypeLabel(key: string, t: (key: string) => string): string {
  if (ADD_TYPES.has(key)) return t('history.type.add')
  if (DELETE_TYPES.has(key)) return t('history.type.delete')
  if (ATTACHED_TYPES.has(key)) return t('history.type.attached')
  if (REVIEW_TYPES.has(key)) return t('history.type.review')
  if (PUBLISHED_TYPES.has(key)) return t('history.type.published')
  if (UNPUBLISHED_TYPES.has(key)) return t('history.type.unpublished')
  if (PLAN_TYPES.has(key)) return t('history.type.plan')
  return t('history.type.update')
}

function getTypeColor(key: string): string {
  if (ADD_TYPES.has(key)) return 'green'
  if (DELETE_TYPES.has(key)) return 'red'
  if (ATTACHED_TYPES.has(key)) return 'cyan'
  if (REVIEW_TYPES.has(key)) return 'purple'
  if (PUBLISHED_TYPES.has(key)) return 'green'
  if (UNPUBLISHED_TYPES.has(key)) return 'red'
  if (PLAN_TYPES.has(key)) return 'blue'
  return 'blue'
}

function tryParseJson(str: string | null | undefined): Record<string, unknown> | null {
  if (!str) return null
  try {
    return JSON.parse(str) as Record<string, unknown>
  } catch {
    return null
  }
}

function generateSummary(
  type: string,
  updated: Record<string, unknown> | null,
  previous: Record<string, unknown> | null,
  t: (key: string) => string,
): string {
  switch (type) {
    case 'PHYSICAL_CHANNEL_CREATE':
      return `${t('log.physicalChannel.create')} ${updated?.name ?? ''}`
    case 'PHYSICAL_CHANNEL_DELETE':
      return `${t('log.physicalChannel.delete')} ${previous?.name ?? ''}`
    case 'CHANNEL_METADATA_CREATE':
      return `${t('log.channelMetadata.create')} ${updated?.name ?? ''}`
    case 'CHANNEL_METADATA_UPDATE':
      return `${t('log.channelMetadata.update')} ${updated?.name ?? ''}`
    case 'CHANNEL_METADATA_DELETE':
      return `${t('log.channelMetadata.delete')} ${previous?.name ?? ''}`
    case 'CONTENT_PACKAGE_LINK':
      return `${t('log.package.link')} ${updated?.package_names ?? ''}`
    case 'CONTENT_PACKAGE_UNLINK':
      return `${t('log.package.unlink')} ${previous?.package_names ?? ''}`
    case 'CONTENT_CATEGORY_LINK':
      return `${t('log.category.link')} ${updated?.category_names ?? ''}`
    case 'CONTENT_CATEGORY_UNLINK':
      return `${t('log.category.unlink')} ${previous?.category_names ?? ''}`
    case 'CONTENT_REVIEW_INITIATE':
      return t('log.review.initiate')
    case 'CONTENT_REVIEW_APPROVE':
      return t('log.review.approve')
    case 'CONTENT_REVIEW_REJECT':
      return t('log.review.reject')
    case 'CHANNEL_UPDATE':
      return `${t('log.channel.update')} ${updated?.title ?? ''}`
    case 'POSTER_UPLOAD':
      return `${t('log.poster.upload')} ${updated?.poster_name ?? ''}`
    case 'POSTER_DELETE':
      return `${t('log.poster.delete')} ${previous?.poster_name ?? ''}`
    default:
      return ''
  }
}

interface ActivityLogTabProps {
  contentId: number
  refreshVersion?: number
  mode?: 'simple' | 'enriched'
}

export default function ActivityLogTab({ contentId, refreshVersion, mode = 'simple' }: ActivityLogTabProps) {
  const { t } = useI18n()
  const tStr = useCallback((key: string) => t(key as MessageKey), [t])
  const [data, setData] = useState<ActivityLogListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getActivityLogs(contentId)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled && !isHandledError(err)) void message.error(t('content.msg.loadActivityLogsFailed'), 5)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [contentId, t, refreshVersion])

  const summaryCache = useMemo(() => {
    const cache = new Map<number, string>()
    if (mode !== 'enriched') return cache
    for (const record of data) {
      const updObj = tryParseJson(record.updated_value)
      const prevObj = tryParseJson(record.previous_value)
      const summary = generateSummary(record.processed_type ?? '', updObj, prevObj, tStr)
      cache.set(record.id, summary || record.details || '')
    }
    return cache
  }, [data, mode, tStr])

  const simpleColumns: ColumnsType<ActivityLogListItem> = [
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
      title: t('content.col.processedType'),
      dataIndex: 'processed_type',
      key: 'processed_type',
      width: 140,
    },
    {
      title: t('content.col.details'),
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
      render: (v?: string) => v ?? '—',
    },
  ]

  const enrichedColumns: ColumnsType<ActivityLogListItem> = [
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
      width: 120,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('content.col.processedType'),
      dataIndex: 'processed_type',
      key: 'processed_type',
      width: 120,
      render: (v?: string) => {
        if (!v) return '—'
        return <Tag color={getTypeColor(v)}>{getTypeLabel(v, tStr)}</Tag>
      },
    },
    {
      title: t('content.col.details'),
      dataIndex: 'details',
      key: 'details',
      render: (_: unknown, record: ActivityLogListItem) => {
        const summary = summaryCache.get(record.id)
        return summary || record.details || '—'
      },
    },
  ]

  const columns = mode === 'enriched' ? enrichedColumns : simpleColumns

  return (
    <Table<ActivityLogListItem>
      rowKey="id"
      size="small"
      loading={loading}
      columns={columns}
      dataSource={data}
      pagination={{ pageSize: 10, showQuickJumper: true, position: ['bottomCenter'] }}
      locale={{ emptyText: t('live.channel.emptyActivityLogs') }}
    />
  )
}
