/**
 * 爬取任务详情页面
 */
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Table,
  Tag,
  Spin,
  Form,
  Row,
  Col,
  Tooltip,
  message,
} from 'antd'
import { useI18n } from '../../i18n/useI18n'
import { getCrawlTaskDetail } from '../../api/crawlTasks'
import TrimInput from '../../components/TrimInput'
import type { CrawlTaskDetail as CrawlTaskDetailType } from '../../types/metadataEnhance'
import SectionTitle from '../../components/SectionTitle'
import { PAGINATION_CONFIG } from '../../constants/pagination'

export default function CrawlTaskDetail() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<CrawlTaskDetailType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const taskId = parseInt(id, 10)
    if (isNaN(taskId)) {
      message.error('Invalid task ID')
      return
    }
    setLoading(true)
    getCrawlTaskDetail(taskId)
      .then(setDetail)
      .catch(() => message.error('Failed to load task detail'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center' }}><Spin size="large" /></div>
  }

  if (!detail) {
    return <div style={{ padding: 24 }}>Task not found</div>
  }

  const detailColumns = [
    {
      title: t('crawlTask.detail.fieldName'),
      dataIndex: 'field_name',
      key: 'field_name',
    },
    {
      title: t('crawlTask.detail.crawlData'),
      dataIndex: 'crawl_data',
      key: 'crawl_data',
      ellipsis: true,
    },
    {
      title: t('crawlTask.detail.isUsed'),
      dataIndex: 'is_used',
      key: 'is_used',
      width: 100,
      render: (v: string) => (
        <Tag color={v === 'YES' ? 'success' : 'default'}>{v}</Tag>
      ),
    },
  ]

  return (
    <div className="main-container">
      {/* 基本信息 */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('crawlTask.detail.basicInfo')} />
        <div style={{ paddingLeft: 20 }}>
          <Form layout="vertical">
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item label={t('crawlTask.detail.taskId')}>
                  <TrimInput value={String(detail.id)} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('crawlTask.detail.objectName')}>
                  <Tooltip title={detail.object_name || undefined}>
                    <TrimInput value={detail.object_name} disabled style={{ background: '#f5f5f5' }} />
                  </Tooltip>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('crawlTask.detail.objectType')}>
                  <TrimInput value={detail.object_type} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('crawlTask.detail.sourceName')}>
                  <TrimInput value={detail.source_name || '—'} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('crawlTask.detail.crawlStatus')}>
                  <TrimInput value={detail.crawl_status} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('crawlTask.detail.errorMessage')}>
                  <TrimInput value={detail.error_message || '—'} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('crawlTask.detail.createdAt')}>
                  <TrimInput
                    value={detail.created_at ? new Date(detail.created_at).toLocaleString() : '—'}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('crawlTask.detail.completedAt')}>
                  <TrimInput
                    value={detail.completed_at ? new Date(detail.completed_at).toLocaleString() : '—'}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      </div>

      {/* 执行日志 */}
      <div>
        <SectionTitle title={t('crawlTask.detail.executionLog')} />
        <div style={{ paddingLeft: 20 }}>
          <Table
            rowKey="id"
            columns={detailColumns}
            dataSource={detail.details}
            pagination={{
              defaultPageSize: PAGINATION_CONFIG.defaultPageSize,
              pageSizeOptions: PAGINATION_CONFIG.pageSizeOptions.map(String),
              showSizeChanger: true,
              showTotal: (total) => t('common.totalItems', { n: total }),
              position: ['bottomCenter'],
            }}
            size="small"
          />
        </div>
      </div>
    </div>
  )
}
