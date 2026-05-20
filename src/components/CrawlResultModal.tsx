/**
 * 爬取结果选择弹框组件
 */
import { useState } from 'react'
import { Modal, Descriptions, Radio, Space, Tag, Button, message } from 'antd'
import { useI18n } from '../i18n/useI18n'
import type { CrawlFieldCandidate } from '../types/metadataEnhance'
import { isHandledError } from '../api'


interface CrawlResultModalProps {
  open: boolean
  objectName: string
  objectType: string
  fieldCandidates: Record<string, CrawlFieldCandidate[]>
  onCancel: () => void
  onConfirm: (selectedFields: Array<{ field_code: string; field_name: string; crawl_data: string | null }>) => void
}

export default function CrawlResultModal({
  open,
  objectName,
  objectType,
  fieldCandidates,
  onCancel,
  onConfirm,
}: CrawlResultModalProps) {
  const { t } = useI18n()
  // 每个字段的选择状态：field_code → selected detail_id 或 'skip'
  const [selections, setSelections] = useState<Record<string, number | 'skip'>>({})
  const [confirming, setConfirming] = useState(false)

  const handleSelect = (fieldCode: string, value: number | 'skip') => {
    setSelections((prev) => ({ ...prev, [fieldCode]: value }))
  }

  const handleConfirm = async () => {
    const allSelections: Array<{ detail_id: number; is_used: string }> = []

    for (const [, candidates] of Object.entries(fieldCandidates)) {
      const selected = selections[candidates[0]?.field_code || '']
      if (selected === 'skip') {
        candidates.forEach((c) => allSelections.push({ detail_id: c.detail_id, is_used: 'NO' }))
      } else if (typeof selected === 'number') {
        candidates.forEach((c) =>
          allSelections.push({ detail_id: c.detail_id, is_used: c.detail_id === selected ? 'YES' : 'NO' })
        )
      }
    }

    const firstCandidates = Object.values(fieldCandidates)[0]
    if (!firstCandidates || firstCandidates.length === 0) {
      onCancel()
      return
    }

    setConfirming(true)
    try {
      const yesDetailIds = new Set<number>()
      for (const [fieldCode] of Object.entries(fieldCandidates)) {
        const selected = selections[fieldCode]
        if (typeof selected === 'number') {
          yesDetailIds.add(selected)
        }
      }

      const allResults: Array<{ field_code: string; field_name: string; crawl_data: string | null }> = []

      for (const candidates of Object.values(fieldCandidates)) {
        for (const c of candidates) {
          if (yesDetailIds.has(c.detail_id)) {
            allResults.push({
              field_code: c.field_code,
              field_name: c.field_name,
              crawl_data: c.crawl_data,
            })
          }
        }
      }

      onConfirm(allResults)
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('crawlResult.msg.confirmFailed'))
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Modal
      title={t('crawlResult.title')}
      open={open}
      onCancel={onCancel}
      width={700}
      footer={[
        <Button key="cancel" onClick={onCancel}>{t('crawlResult.cancel')}</Button>,
        <Button key="confirm" type="primary" loading={confirming} onClick={handleConfirm}>
          {t('crawlResult.confirm')}
        </Button>,
      ]}
    >
      <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label={t('crawlResult.objectInfo')}>
          {objectName} ({objectType})
        </Descriptions.Item>
      </Descriptions>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Object.entries(fieldCandidates).map(([fieldCode, candidates]) => (
          <div key={fieldCode}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{candidates[0]?.field_name || fieldCode}</div>
            <Radio.Group
              value={selections[fieldCode]}
              onChange={(e) => handleSelect(fieldCode, e.target.value)}
            >
              <Space direction="vertical">
                {candidates.map((c) => (
                  <Radio key={c.detail_id} value={c.detail_id}>
                    <span>{c.crawl_data || '-'}</span>
                    <Tag style={{ marginLeft: 8 }}>{c.source_name}</Tag>
                  </Radio>
                ))}
                <Radio value="skip">
                  <span style={{ color: '#999' }}>{t('crawlResult.noFill')}</span>
                </Radio>
              </Space>
            </Radio.Group>
          </div>
        ))}
      </div>
    </Modal>
  )
}