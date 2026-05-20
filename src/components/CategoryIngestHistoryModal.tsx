/**
 * CategoryIngestHistoryModal — 栏目注入历史弹框
 *
 * 需求：3.7.3.2(4) 注入历史弹框
 * 注意：Category 作为关联对象，注入历史存储在 ingest_history_detail 表中
 */

import { useCallback, useEffect, useState } from 'react'
import { Button, Dropdown, Modal, Pagination, Space, Spin, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getIngestHistoryDetails } from '../api/ingestHistory'
import { useI18n } from '../i18n/useI18n'
import type { IngestHistoryDetailItem } from '../types/ingestHistory'
import { isHandledError } from '../api'


interface Props {
  open: boolean
  entityType: string
  entityId: number
  entityName: string
  onClose: () => void
}

export default function CategoryIngestHistoryModal({
  open,
  entityType,
  entityId,
  entityName,
  onClose,
}: Props) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<IngestHistoryDetailItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getIngestHistoryDetails({
        entity_type: entityType,
        entity_id: entityId,
        page,
        page_size: pageSize,
      })
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('ingestHistory.msg.loadFailed'), 5)
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId, page, pageSize, t])

  useEffect(() => {
    if (open) {
      void loadData()
    }
  }, [open, loadData])

  const handlePageChange = (p: number, ps?: number) => {
    setPage(p)
    if (ps) setPageSize(ps)
  }

  const columns: ColumnsType<IngestHistoryDetailItem> = [
    {
      title: t('publish.ingestHistory.col.type') || '内容名称',
      dataIndex: 'trigger_content_name',
      key: 'trigger_content_name',
      width: 180,
      render: (v: string | null) => v || '—',
    },
    {
      title: t('ingestHistory.col.sendDate'),
      dataIndex: 'send_date',
      width: 170,
      render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—',
    },
    {
      title: t('ingestHistory.col.endDate'),
      dataIndex: 'end_date',
      width: 170,
      render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—',
    },
    {
      title: t('ingestHistory.col.action'),
      dataIndex: 'action',
      width: 100,
      align: 'center',
      render: (action: string) => {
        if (action === 'REGIST') return <Tag color="blue">{action}</Tag>
        if (action === 'UPDATE') return <Tag color="orange">{action}</Tag>
        return <Tag>{action}</Tag>
      },
    },
    {
      title: t('ingestHistory.col.status'),
      dataIndex: 'status',
      width: 100,
      align: 'center',
      render: (status: string | null) => {
        if (status === 'success') return <Tag color="success">{status}</Tag>
        if (status === 'failure') return <Tag color="error">{status}</Tag>
        return <Tag>{status || '—'}</Tag>
      },
    },
    {
      title: t('ingestHistory.col.getXml'),
      width: 120,
      align: 'center',
      render: (_, record) => {
        const handleDownload = async (url: string, filename: string) => {
          try {
            const response = await fetch(url)
            const blob = await response.blob()
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(link.href)
          } catch (err) {
            if (isHandledError(err)) return
            void message.error(t('common.downloadFailed'))
          }
        }
        const menuItems = []
        if (record.ingest_xml_url) {
          menuItems.push({
            key: 'ingest',
            label: t('ingestHistory.xml.ingest'),
            onClick: () => {
              const url = record.ingest_xml_url!
              const urlParams = new URLSearchParams(url.split('?')[1])
              const path = urlParams.get('path') || ''
              const filename = path.split('/').pop() || 'ingest.xml'
              void handleDownload(url, filename)
            },
          })
        }
        if (record.result_xml_url) {
          menuItems.push({
            key: 'result',
            label: t('ingestHistory.xml.result'),
            onClick: () => {
              const url = record.result_xml_url!
              const urlParams = new URLSearchParams(url.split('?')[1])
              const path = urlParams.get('path') || ''
              const filename = path.split('/').pop() || 'result.xml'
              void handleDownload(url, filename)
            },
          })
        }
        if (menuItems.length === 0) {
          return '—'
        }
        return (
          <Dropdown menu={{ items: menuItems }} placement="bottom">
            <Button type="link" size="small">
              {t('ingestHistory.col.getXml')}
            </Button>
          </Dropdown>
        )
      },
    },
  ]

  const titleText = `${entityName} - ${t('ingestHistory.title')}`

  return (
    <Modal
      title={titleText}
      open={open}
      onCancel={onClose}
      width={960}
      destroyOnHidden
      footer={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
            {t('ingestHistory.btn.refresh')}
          </Button>
          <Button onClick={onClose}>{t('ingestHistory.btn.close')}</Button>
        </Space>
      }
    >
      {loading && items.length === 0 ? (
        <div
          style={{
            minHeight: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spin />
        </div>
      ) : (
        <>
          <Table<IngestHistoryDetailItem>
            dataSource={items}
            columns={columns}
            pagination={false}
            rowKey="id"
            size="small"
            scroll={{ y: 360 }}
            locale={{ emptyText: t('ingestHistory.empty') }}
          />
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              showQuickJumper
              pageSizeOptions={[10, 20, 50]}
              onChange={handlePageChange}
              showTotal={(totalCount) => t('pagination.total', { n: totalCount })}
            />
          </div>
        </>
      )}
    </Modal>
  )
}
