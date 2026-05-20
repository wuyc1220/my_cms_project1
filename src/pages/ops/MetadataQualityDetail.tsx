import { useCallback, useEffect, useState } from 'react'
import { Button, Empty, Form, Row, Col, Spin, Table, Tag } from 'antd'
import { DownloadOutlined, LeftOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useNavigate, useParams } from 'react-router-dom'
import {
  downloadMetadataQualityReport,
  getMetadataQualityCheck,
  getMetadataQualityIssues,
} from '../../api/metadataQuality'
import TrimInput from '../../components/TrimInput'
import type { MetadataQualityCheckDetail, MetadataQualityIssue } from '../../api/metadataQuality'
import { useI18n } from '../../i18n/useI18n'
import { message } from 'antd'
import { isHandledError } from '../../api'
import SectionTitle from '../../components/SectionTitle'
import { PAGINATION_CONFIG } from '../../constants/pagination'

export default function MetadataQualityDetail() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const checkId = Number(id)

  const [detailRecord, setDetailRecord] = useState<MetadataQualityCheckDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [issues, setIssues] = useState<MetadataQualityIssue[]>([])
  const [issuesLoading, setIssuesLoading] = useState(false)
  const [issuesTotal, setIssuesTotal] = useState(0)
  const [issuesPage, setIssuesPage] = useState(1)
  const [issuesPageSize, setIssuesPageSize] = useState(PAGINATION_CONFIG.defaultPageSize)

  useEffect(() => {
    if (!id || isNaN(checkId)) return
    setLoading(true)
    getMetadataQualityCheck(checkId)
      .then((data) => setDetailRecord(data))
      .catch(() => {
      })
      .finally(() => setLoading(false))
  }, [id, checkId])

  const loadIssues = useCallback(async (
    page: number,
    pageSize: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) => {
    if (isNaN(checkId)) return
    setIssuesLoading(true)
    try {
      const res = await getMetadataQualityIssues(checkId, {
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      })
      setIssues(res.items)
      setIssuesTotal(res.total)
      setIssuesPage(page)
      setIssuesPageSize(pageSize)
    } catch {
    } finally {
      setIssuesLoading(false)
    }
  }, [checkId])

  useEffect(() => {
    if (!isNaN(checkId)) {
      void loadIssues(1, issuesPageSize, 'content_id', 'asc')
    }
  }, [checkId, loadIssues, issuesPageSize])

  const handleDownload = async () => {
    if (!detailRecord) return
    try {
      await downloadMetadataQualityReport(detailRecord.id)
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('ops.metadataQuality.msgDownloadFailed'), 5)
    }
  }

  const issueColumns: ColumnsType<MetadataQualityIssue> = [
    {
      title: t('ops.metadataQuality.issue.contentId'),
      dataIndex: 'content_id',
      width: 80,
    },
    {
      title: t('ops.metadataQuality.issue.contentName'),
      dataIndex: 'content_name',
      width: 140,
    },
    {
      title: t('ops.metadataQuality.issue.contentType'),
      dataIndex: 'content_type',
      width: 100,
    },
    {
      title: t('ops.metadataQuality.issue.issueType'),
      dataIndex: 'issue_type',
      width: 100,
      render: (v: string) =>
        t(`ops.metadataQuality.issueType.${v}` as 'ops.metadataQuality.issueType.missing'),
    },
    {
      title: t('ops.metadataQuality.issue.fieldName'),
      dataIndex: 'field_name',
      width: 100,
    },
    {
      title: t('ops.metadataQuality.issue.severity'),
      dataIndex: 'severity',
      width: 90,
      render: (v: string) => (
        <Tag color={v === 'critical' ? 'red' : v === 'medium' ? 'orange' : 'blue'}>
          {t(`ops.metadataQuality.severity.${v}` as 'ops.metadataQuality.severity.critical')}
        </Tag>
      ),
    },
    {
      title: t('ops.metadataQuality.issue.expected'),
      dataIndex: 'expected_value',
      width: 120,
    },
    {
      title: t('ops.metadataQuality.issue.actual'),
      dataIndex: 'actual_value',
      width: 120,
    },
  ]

  if (loading) {
    return (
      <div className="main-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!detailRecord) {
    return (
      <div className="main-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description={t('common.noData')} />
      </div>
    )
  }

  const statusLabel = t(`ops.metadataQuality.status.${detailRecord.status}` as 'ops.metadataQuality.status.pending')
  const durationDisplay =
    detailRecord.status === 'running'
      ? t('ops.metadataQuality.durationRunning')
      : detailRecord.duration !== null
        ? t('ops.metadataQuality.seconds').replace('{n}', String(detailRecord.duration))
        : '-'

  return (
    <div className="main-container">
      <div style={{ marginBottom: 16 }}>
        <Button
          type="link"
          icon={<LeftOutlined />}
          onClick={() => navigate('/ops/monitor')}
          style={{ padding: 0 }}
        >
          {t('common.backToList')}
        </Button>
      </div>

      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('ops.metadataQuality.basicInfo')} />
        <div style={{ paddingLeft: 20 }}>
          <Form layout="vertical">
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item label={t('ops.metadataQuality.colCheckTime')}>
                  <TrimInput
                    value={detailRecord.check_time ? dayjs(detailRecord.check_time).format('YYYY-MM-DD HH:mm:ss') : '-'}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('ops.metadataQuality.colStatus')}>
                  <TrimInput
                    value={statusLabel}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('ops.metadataQuality.colTotal')}>
                  <TrimInput
                    value={String(detailRecord.total_contents ?? '-')}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('ops.metadataQuality.colPassed')}>
                  <TrimInput
                    value={String(detailRecord.passed_count ?? '-')}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('ops.metadataQuality.colFailed')}>
                  <TrimInput
                    value={String(detailRecord.failed_count ?? '-')}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('ops.metadataQuality.colDuration')}>
                  <TrimInput
                    value={durationDisplay}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
          {detailRecord.status === 'completed' && (
            <div style={{ marginTop: -8 }}>
              <Button icon={<DownloadOutlined />} onClick={handleDownload}>
                {t('ops.metadataQuality.btnDownload')}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div>
        <SectionTitle title={t('ops.metadataQuality.issuesInfo')} />
        <div style={{ paddingLeft: 20 }}>
          <Table
            rowKey="id"
            size="small"
            bordered
            loading={issuesLoading}
            dataSource={issues}
            pagination={{
              current: issuesPage,
              pageSize: issuesPageSize,
              total: issuesTotal,
              defaultPageSize: PAGINATION_CONFIG.defaultPageSize,
              pageSizeOptions: PAGINATION_CONFIG.pageSizeOptions.map(String),
              showSizeChanger: true,
              showTotal: (total) => t('common.totalItems', { n: total }),
              position: ['bottomCenter'],
              onChange: (page, pageSize) => {
                void loadIssues(page, pageSize, 'content_id', 'asc')
              },
            }}
            scroll={{ x: 800 }}
            columns={issueColumns}
            locale={{ emptyText: t('common.noData') }}
          />
        </div>
      </div>
    </div>
  )
}
