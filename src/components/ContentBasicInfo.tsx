/**
 * ContentBasicInfo — 内容基本信息展示组件（通用）
 *
 * 统一展示：Content Name、Content Type、Provider、Platform、Genre、Ingest Status
 * 适用于：VOD、Channel、Schedule 详情页
 */

import { Tag, Typography } from 'antd'
import { useI18n } from '../i18n/useI18n'
import type { ContentLicenseRef } from '../types/content'

const { Text } = Typography

interface ContentBasicInfoProps {
  /** 内容标题 */
  title: string
  /** 内容类型 */
  contentType: string
  /** Provider 名称列表 */
  providerNames?: string
  /** 许可证列表（用于获取 Platform） */
  licenses?: ContentLicenseRef[]
  /** 平台名称映射 */
  platformNameMap?: Record<string, string>
  /** 题材名称 */
  genreName?: string
  /** 状态 */
  status: string
  /** 状态颜色映射 */
  statusColor?: string
  /** 点击状态标签的回调 */
  onStatusClick?: () => void
}

export default function ContentBasicInfo({
  title,
  contentType,
  providerNames,
  licenses,
  platformNameMap,
  genreName,
  status,
  statusColor,
  onStatusClick,
}: ContentBasicInfoProps) {
  const { t } = useI18n()

  // 获取平台标签
  const platformTags = licenses && licenses.length > 0 && licenses[0].platforms && licenses[0].platforms.length > 0
    ? licenses[0].platforms.map((p) => (
        <Tag key={p.platform} style={{ fontSize: 11 }}>
          {platformNameMap?.[p.platform] || p.platform}
        </Tag>
      ))
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
      {/* Content Name */}
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <Text type="secondary" style={{ fontSize: 12, width: 100, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {t('content.detail.contentName')}:{' '}
        </Text>
        <Text strong style={{ fontSize: 15, wordBreak: 'break-all' }}>{title}</Text>
      </div>

      {/* Content Type */}
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <Text type="secondary" style={{ fontSize: 12, width: 100, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {t('content.detail.contentType')}:{' '}
        </Text>
        <Tag color="blue">{contentType}</Tag>
      </div>

      {/* Provider */}
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <Text type="secondary" style={{ fontSize: 12, width: 100, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {t('content.detail.provider')}:{' '}
        </Text>
        <Text style={{ wordBreak: 'break-all' }}>{providerNames || '—'}</Text>
      </div>

      {/* Platform */}
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <Text type="secondary" style={{ fontSize: 12, width: 100, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {t('content.detail.platform')}:{' '}
        </Text>
        {platformTags ? (
          <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>{platformTags}</span>
        ) : (
          <Text type="secondary">—</Text>
        )}
      </div>

      {/* Genre */}
      {genreName && (
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <Text type="secondary" style={{ fontSize: 12, width: 100, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {t('content.detail.genre')}:{' '}
          </Text>
          <Text style={{ wordBreak: 'break-all' }}>{genreName}</Text>
        </div>
      )}

      {/* Ingest Status */}
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <Text type="secondary" style={{ fontSize: 12, width: 100, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {t('content.detail.ingestStatus')}:{' '}
        </Text>
        <Tag
          color={statusColor || 'default'}
          style={{ fontSize: 12, cursor: onStatusClick ? 'pointer' : 'default' }}
          onClick={onStatusClick}
        >
          {status}
        </Tag>
      </div>
    </div>
  )
}
