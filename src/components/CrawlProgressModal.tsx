/**
 * 爬取进度弹框组件
 */
import { Modal, Descriptions, Progress, Tag, Button } from 'antd'
import { useI18n } from '../i18n/useI18n'
import type { CrawlProgressItem } from '../types/metadataEnhance'

interface CrawlProgressModalProps {
  open: boolean
  objectName: string
  objectType: string
  progressItems: CrawlProgressItem[]
  onCancel: () => void
  onNext: () => void
}

const STATUS_COLORS: Record<string, string> = {
  Created: 'default',
  InProgress: 'processing',
  Completed: 'success',
  Failed: 'error',
}

export default function CrawlProgressModal({
  open,
  objectName,
  objectType,
  progressItems,
  onCancel,
  onNext,
}: CrawlProgressModalProps) {
  const { t } = useI18n()

  const allCompleted = progressItems.length > 0 && progressItems.every((p) => p.crawl_status === 'Completed' || p.crawl_status === 'Failed')

  return (
    <Modal
      title={t('crawlProgress.title')}
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>{t('crawlProgress.cancel')}</Button>,
        allCompleted && (
          <Button key="next" type="primary" onClick={onNext}>{t('crawlProgress.nextStep')}</Button>
        ),
      ].filter(Boolean)}
      width={520}
    >
      <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label={t('crawlProgress.objectInfo')}>
          {objectName} ({objectType})
        </Descriptions.Item>
      </Descriptions>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {progressItems.map((item) => (
          <div key={item.task_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 120, flexShrink: 0 }}>{item.source_name}</span>
            <Progress
              percent={item.progress}
              status={
                item.crawl_status === 'Failed' ? 'exception' :
                item.crawl_status === 'Completed' ? 'success' :
                'active'
              }
              style={{ flex: 1 }}
            />
            <Tag color={STATUS_COLORS[item.crawl_status] || 'default'}>{item.crawl_status}</Tag>
          </div>
        ))}
      </div>
    </Modal>
  )
}