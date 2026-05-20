import { Card } from 'antd'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import type { ContentStatusCount as ContentStatusCountType } from '../../../types/dashboard'
import { useI18n } from '../../../i18n/useI18n'

interface ContentStatusCountProps {
  data: ContentStatusCountType
  visibleStatuses?: string[]
  statusNameMap?: Record<string, string>
}

// 状态颜色映射
const STATUS_COLOR_MAP: Record<string, string> = {
  WaitingForMaterials: '#1890ff',
  InProgress: '#1890ff',
  ReadyForPublish: '#faad14',
  Publishing: '#1890ff',
  PublishFailed: '#ff4d4f',
  Published: '#52c41a',
  NoActiveLicense: '#ff4d4f',
  Expired: '#ff4d4f',
  NearExpiry: '#faad14',
  Deleted: '#ff4d4f',
  Closed: '#ff4d4f',
  None: '#1890ff',
}

// 状态字段映射（用于从 data 中获取值）
const STATUS_FIELD_MAP: Record<string, keyof ContentStatusCountType> = {
  WaitingForMaterials: 'waiting_for_materials',
  InProgress: 'in_progress',
  ReadyForPublish: 'ready_for_publish',
  Publishing: 'publishing',
  PublishFailed: 'publish_failed',
  Published: 'published',
  NoActiveLicense: 'no_active_license',
  Expired: 'expired',
  NearExpiry: 'near_expiry',
  Deleted: 'deleted',
  Closed: 'closed',
  None: 'none_status',
}

const ContentStatusCount: React.FC<ContentStatusCountProps> = ({ data, visibleStatuses, statusNameMap }) => {
  const { t } = useI18n()
  const navigate = useNavigate()

  // 动态生成状态列表（基于 visibleStatuses 或 statusNameMap 的所有 key）
  const allStatusCodes = visibleStatuses && visibleStatuses.length > 0
    ? visibleStatuses
    : Object.keys(statusNameMap || {}).length > 0
      ? Object.keys(statusNameMap!)
      : Object.keys(STATUS_FIELD_MAP)

  const allStatusItems = allStatusCodes.map((code) => {
    const field = STATUS_FIELD_MAP[code]
    const value = field ? (data[field] as number) : 0
    return {
      key: code.toLowerCase(),
      label: statusNameMap?.[code] || code,
      value: value,
      color: STATUS_COLOR_MAP[code] || '#1890ff',
      statusCode: code,
    }
  })

  const statusItems = allStatusItems

  const handleClick = (statusCode: string) => {
    if (statusCode === 'NearExpiry') {
      const today = dayjs().format('YYYY-MM-DD')
      const threshold = dayjs().add(data.near_expiry_days, 'day').format('YYYY-MM-DD')
      navigate('/vod/contents', {
        state: {
          filters: {
            contentType: ['MOVIE', 'SEASON', 'SERIES'],
            ingestStatus: 'Published',
            license_end_from: today,
            license_end_to: threshold,
          },
        },
      })
      return
    }

    if (statusCode === 'Deleted') {
      // 已删除内容跳转到回收站或显示提示
      navigate('/vod/contents', {
        state: {
          filters: {
            contentType: ['MOVIE', 'SEASON', 'SERIES'],
            isDeleted: true,
          },
        },
      })
      return
    }

    navigate('/vod/contents', {
      state: {
        filters: {
          contentType: ['MOVIE', 'SEASON', 'SERIES'],
          ingestStatus: statusCode,
        },
      },
    })
  }

  return (
    <Card title={t('dashboard.contentStatusCount')}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {statusItems.map((item) => (
          <div
            key={item.key}
            style={{
              padding: '12px 16px',
              border: `1px solid ${item.color}`,
              borderRadius: 4,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              minWidth: 140,
            }}
            onClick={() => handleClick(item.statusCode)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f6ffed'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <span style={{ color: item.color, fontSize: 14 }}>
              {item.label} - {item.value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default ContentStatusCount
