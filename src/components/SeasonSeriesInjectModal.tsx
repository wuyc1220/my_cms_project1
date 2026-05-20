/**
 * SeasonSeriesInjectModal — 单季注入弹框
 *
 * 适用于 Content Type = SEASON
 * 需求：3.6.7 Season Series 注入弹框
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tooltip,
  Upload,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { useI18n } from '../i18n/useI18n'
import { useAuthStore } from '../stores/authStore'
import { createContent, deleteContent, getContentChildren, batchImportContents } from '../api/contents'
import { getAuthUsers } from '../api/dataAuth'
import { getEpisodeHistory } from '../api/episodeHistory'
import type { EpisodeHistoryItem } from '../api/episodeHistory'
import TrimInput from './TrimInput'
import type { ContentListItem } from '../types/content'
import type { UserSimpleItem } from '../types/dataAuth'
import { isHandledError } from '../api'


interface Props {
  open: boolean
  parentId: number
  parentName: string
  onClose: () => void
  onSuccess?: () => void
  readOnly?: boolean
}

export default function SeasonSeriesInjectModal({
  open,
  parentId,
  parentName,
  onClose,
  onSuccess,
  readOnly = false,
}: Props) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { user: currentUser } = useAuthStore()
  const [form] = Form.useForm()

  const [activeTab, setActiveTab] = useState('add')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ContentListItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [batchAdd, setBatchAdd] = useState(false)
  const [fileList, setFileList] = useState<any[]>([]) // eslint-disable-line @typescript-eslint/no-explicit-any
  
  // 用户下拉选项
  const [userOptions, setUserOptions] = useState<{ label: string; value: number }[]>([])

  // History Tab 状态
  const [historyForm] = Form.useForm()
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyItems, setHistoryItems] = useState<EpisodeHistoryItem[]>([])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getContentChildren(parentId, 'SERIES')
      setItems(res.items)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('common.msg.loadFailed'), 3)
    } finally {
      setLoading(false)
    }
  }, [parentId, t])

  // 加载用户列表
  const loadUsers = useCallback(async () => {
    try {
      const users = await getAuthUsers()
      const options = users.map((u: UserSimpleItem) => ({
        label: u.display_name ? `${u.display_name}（${u.username}）` : u.username,
        value: u.id,
      }))
      setUserOptions(options)
      
      // 设置默认值为当前登录用户
      if (currentUser?.id) {
        form.setFieldsValue({ assignee_id: currentUser.id })
      }
    } catch (err) {
      setUserOptions([])
    }
  }, [currentUser?.id, form])

  // 加载 History 数据
  const loadHistory = useCallback(async (params?: { content_name?: string; processed_type?: string; processed_by?: string }) => {
    setHistoryLoading(true)
    try {
      const res = await getEpisodeHistory(parentId, params)
      // 过滤出 SERIES 类型的历史记录
      const seriesHistory = res.items.filter(item => item.content_type === 'SERIES')
      setHistoryItems(seriesHistory)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('common.msg.loadFailed'), 3)
    } finally {
      setHistoryLoading(false)
    }
  }, [parentId, t])

  // History 搜索
  const handleHistorySearch = async () => {
    const values = await historyForm.validateFields()
    await loadHistory(values)
  }

  // History 重置
  const handleHistoryReset = () => {
    historyForm.resetFields()
    void loadHistory()
  }

  useEffect(() => {
    if (open) {
      form.resetFields()
      historyForm.resetFields()
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab('add')
      setBatchAdd(false)
      setFileList([])
      void loadList()
      void loadUsers()
      void loadHistory()
    }
  }, [open, form, historyForm, loadList, loadUsers, loadHistory])

  // 切换 Tab 时加载对应数据
  useEffect(() => {
    if (open && activeTab === 'history') {
      void loadHistory()
    }
  }, [open, activeTab, loadHistory])

  const handleSubmit = async () => {
    const values = await form.validateFields()
    setSubmitting(true)
    try {
      await createContent({
        title: values.title,
        content_type: 'SERIES',
        parent_id: parentId,
        series_type: 2,
        series_ordinal: values.series_ordinal,
        assignee_id: values.assignee_id,
      })
      void message.success(t('content.seasonSeries.addSuccess'), 3)
      form.resetFields()
      void loadList()
      onSuccess?.()
    } catch (e: unknown) {
      if (isHandledError(e)) return
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      void message.error(detail ?? t('content.seasonSeries.addFailed'), 5)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record: ContentListItem) => {
    try {
      await deleteContent(record.id)
      void message.success(t('content.seasonSeries.deleteSuccess'), 3)
      void loadList()
      onSuccess?.()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('common.msg.deleteFailed'), 3)
    }
  }

  const handleBatchImport = async () => {
    if (fileList.length === 0) {
      void message.error(t('common.required'))
      return
    }

    setSubmitting(true)
    try {
      const file = fileList[0].originFileObj || fileList[0]
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]

      // 跳过表头，从第二行开始
      const dataRows = rows.slice(1)

      // 校验数据
      const errors: string[] = []
      const validRows: Array<{ title: string; series_ordinal: number; assignee_id?: number }> = []

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]
        const rowNum = i + 2 // Excel 行号（从 1 开始，加上表头）

        if (!row || !row[0]) continue // 跳过空行

        const title = String(row[0]).trim()
        const seriesOrdinal = row[1] ? Number(row[1]) : null
        const assignee = row[2] ? String(row[2]).trim() : undefined

        // 校验必填字段
        if (!title) {
          errors.push(t('content.seasonSeries.importErrorDetail', { row: rowNum, error: 'Series Name is required' }))
          continue
        }

        if (!seriesOrdinal || seriesOrdinal < 1) {
          errors.push(t('content.seasonSeries.importErrorDetail', { row: rowNum, error: 'Series Ordinal must be a positive number' }))
          continue
        }

        // 查找负责人 ID
        let assigneeId: number | undefined
        if (assignee) {
          const foundUser = userOptions.find(u => u.label.includes(assignee) || String(u.value) === assignee)
          if (foundUser) {
            assigneeId = foundUser.value
          } else {
            errors.push(t('content.seasonSeries.importErrorDetail', { row: rowNum, error: `Assignee "${assignee}" not found` }))
            continue
          }
        }

        validRows.push({ title, series_ordinal: seriesOrdinal, assignee_id: assigneeId })
      }

      // 如果有错误，显示错误信息
      if (errors.length > 0) {
        void message.error({
          content: (
            <div>
              <div>{t('content.seasonSeries.importValidationError')}</div>
              <ul style={{ maxHeight: 200, overflow: 'auto', margin: '8px 0', paddingLeft: 20 }}>
                {errors.slice(0, 10).map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
              {errors.length > 10 && <div>... and {errors.length - 10} more errors</div>}
            </div>
          ),
          duration: 10,
        })
        return
      }

      if (validRows.length === 0) {
        void message.warning('No valid data to import')
        return
      }

  // 批量导入 SERIES（单事务控制）
      const result = await batchImportContents({
        parent_id: parentId,
        items: validRows.map((row) => ({
          title: row.title,
          content_type: 'SERIES' as const,
          series_type: 2,
          series_ordinal: row.series_ordinal,
          assignee_id: row.assignee_id,
        })),
      })

      // 显示导入结果
      if (result.failed_count === 0) {
        void message.success(t('content.seasonSeries.importSuccess'))
        form.resetFields()
        setFileList([])
        void loadList()
        onSuccess?.()
      } else {
        const failedErrors = result.details
          .filter((d) => !d.success)
          .map((d) => `${d.title}: ${d.error ?? 'Unknown error'}`)
        void message.warning({
          content: (
            <div>
              <div>{t('content.seasonSeries.importTotal', { total: validRows.length })}，{t('content.seasonSeries.importSuccess_count', { success: result.success_count })}，{t('content.seasonSeries.importFailed_count', { failed: result.failed_count })}</div>
              <p style={{ color: '#999', marginTop: 8 }}>所有操作在同一个事务中，失败已整体回滚</p>
              {failedErrors.length > 0 && (
                <ul style={{ maxHeight: 200, overflow: 'auto', margin: '8px 0', paddingLeft: 20 }}>
                  {failedErrors.slice(0, 10).map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          ),
          duration: 10,
        })
        void loadList()
        onSuccess?.()
      }
    } catch (e: unknown) {
      if (isHandledError(e)) return
      void message.error(t('content.seasonSeries.importFailed'), 5)
    } finally {
      setSubmitting(false)
    }
  }

  // 下载模板
  const handleDownloadTemplate = () => {
    const headers = [
      t('content.seasonSeries.templateHeader1'),
      t('content.seasonSeries.templateHeader2'),
      t('content.seasonSeries.templateHeader3'),
    ]

    // 示例数据
    const exampleData = [
      ['Series 1', 1, 'admin'],
      ['Series 2', 2, 'admin'],
    ]

    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleData])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Series')

    // 设置列宽
    ws['!cols'] = [
      { wch: 30 }, // Series Name
      { wch: 15 }, // Series Ordinal
      { wch: 20 }, // Assignee
    ]

    XLSX.writeFile(wb, t('content.seasonSeries.templateFileName'))
  }

  // History 表格列定义
  const historyColumns: ColumnsType<EpisodeHistoryItem> = [
    {
      title: t('content.col.contentName'),
      dataIndex: 'content_name',
      key: 'content_name',
      ellipsis: true,
    },
    {
      title: t('content.col.contentType'),
      dataIndex: 'content_type',
      key: 'content_type',
      width: 120,
      render: () => 'SERIES',
    },
    {
      title: t('content.col.seriesOrdinal'),
      dataIndex: 'series_ordinal',
      key: 'series_ordinal',
      width: 120,
      render: (v?: number) => v ?? '—',
    },
    {
      title: t('content.col.processedAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (v?: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—',
    },
    {
      title: t('content.col.processedBy'),
      dataIndex: 'processed_by',
      key: 'processed_by',
      width: 160,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('content.col.processedType'),
      dataIndex: 'processed_type',
      key: 'processed_type',
      width: 120,
    },
  ]

  const columns: ColumnsType<ContentListItem> = [
    {
      title: t('content.col.seriesOrdinal'),
      dataIndex: 'series_ordinal',
      key: 'series_ordinal',
      width: 110,
    },
    {
      title: t('content.col.contentName'),
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('content.col.contentType'),
      dataIndex: 'content_type',
      key: 'content_type',
      width: 120,
      render: () => 'SERIES',
    },
    {
      title: t('content.col.startDateTime'),
      dataIndex: 'begin_time',
      key: 'begin_time',
      width: 160,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('content.col.endDateTime'),
      dataIndex: 'end_time',
      key: 'end_time',
      width: 160,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('content.col.assigned'),
      dataIndex: 'assigned',
      key: 'assigned',
      width: 120,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('content.col.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
    },
    {
      title: t('content.col.action'),
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title={t('common.detail')}>
            <Button
              type="link"
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() => navigate(`/contents/${record.id}`)}
            />
          </Tooltip>
          {!readOnly && (
            <Tooltip title={t('common.edit')}>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`/contents/${record.id}?mode=edit`)}
              />
            </Tooltip>
          )}
          {!readOnly && (
            <Popconfirm
              title={t('content.seasonSeries.deleteConfirm')}
              onConfirm={() => void handleDelete(record)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Tooltip title={t('common.delete')}>
                <Button type="link" size="small" icon={<DeleteOutlined />} danger />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const titleText = `${parentName} - ${t('content.seasonSeries.title')}`

  return (
    <Modal
      title={titleText}
      open={open}
      onCancel={onClose}
      width={960}
      destroyOnHidden
      footer={null}
    >
      {readOnly ? (
        <Spin spinning={loading}>
          <Table<ContentListItem>
            rowKey="id"
            columns={columns}
            dataSource={items}
            scroll={{ x: 900 }}
            pagination={{ pageSize: 10, showQuickJumper: true, position: ['bottomCenter'] }}
            locale={{ emptyText: t('content.seasonSeries.noData') }}
            size="small"
          />
        </Spin>
      ) : (
        <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'add',
            label: t('content.seasonSeries.tab.add'),
            children: (
              <div style={{ minHeight: 200 }}>
                {!readOnly && (
                  <>
                    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span>{t('content.seasonSeries.batchAdd')}</span>
                      <Switch
                        checked={batchAdd}
                        onChange={(v) => { setBatchAdd(v); form.resetFields(); setFileList([]) }}
                        checkedChildren="✓"
                        unCheckedChildren="×"
                      />
                    </div>

                    {!batchAdd && (
                      <Form
                        form={form}
                        layout="vertical"
                        onFinish={() => void handleSubmit()}
                      >
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item
                              name="title"
                              label={t('content.seasonSeries.contentName')}
                              rules={[{ required: true, message: t('common.required') }]}
                            >
                              <TrimInput placeholder={t('common.placeholder.enter')} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item label={t('content.seasonSeries.contentType')}>
                              <TrimInput value="SERIES" disabled />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              name="series_ordinal"
                              label={t('content.seasonSeries.seriesOrdinal')}
                              rules={[{ required: true, message: t('common.required') }]}
                            >
                              <InputNumber
                                min={1}
                                placeholder={t('common.placeholder.enter')}
                                style={{ width: '100%' }}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              name="assignee_id"
                              label={t('content.seasonSeries.assignTo')}
                            >
                              <Select
                                placeholder={t('common.placeholder.select')}
                                options={userOptions}
                                allowClear
                                showSearch
                                optionFilterProp="label"
                                filterOption={(input, opt) =>
                                  String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          <Button onClick={() => form.resetFields()}>
                            {t('common.reset')}
                          </Button>
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            loading={submitting}
                            onClick={() => void handleSubmit()}
                          >
                            {t('common.add')}
                          </Button>
                        </div>
                      </Form>
                    )}

                    {batchAdd && (
                      <Form
                        form={form}
                        layout="vertical"
                      >
                        <Row gutter={16}>
                          <Col span={24}>
                            <Form.Item
                              name="file"
                              label={t('content.seasonSeries.selectFile')}
                              rules={[{ required: true, message: t('common.required') }]}
                            >
                              <Upload
                                beforeUpload={() => false}
                                fileList={fileList}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                onChange={({ fileList: fl }) => setFileList(fl as any[])}
                                maxCount={1}
                              >
                                <Button icon={<UploadOutlined />}>{t('common.placeholder.select')}</Button>
                              </Upload>
                            </Form.Item>
                          </Col>
                        </Row>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Button
                            type="link"
                            onClick={handleDownloadTemplate}
                          >
                            {t('content.seasonSeries.downloadTemplate')}
                          </Button>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Button onClick={() => { form.resetFields(); setFileList([]) }}>
                              {t('common.reset')}
                            </Button>
                            <Button
                              type="primary"
                              icon={<UploadOutlined />}
                              loading={submitting}
                              onClick={() => void handleBatchImport()}
                            >
                              {t('content.seasonSeries.batchImport')}
                            </Button>
                          </div>
                        </div>
                      </Form>
                    )}
                  </>
                )}

                {readOnly && (
                  <div style={{ textAlign: 'center', color: '#8c8c8c', padding: '40px 0' }}>
                    {t('content.detail.comingSoon')}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'list',
            label: t('content.seasonSeries.tab.list'),
            children: (
              <Spin spinning={loading}>
                <Table<ContentListItem>
                  rowKey="id"
                  columns={columns}
                  dataSource={items}
                  scroll={{ x: 900 }}
                  pagination={{ pageSize: 10, showQuickJumper: true, position: ['bottomCenter'] }}
                  locale={{ emptyText: t('content.seasonSeries.noData') }}
                  size="small"
                />
              </Spin>
            ),
          },
          {
            key: 'history',
            label: t('content.seasonSeries.tab.history'),
            children: (
              <Spin spinning={historyLoading}>
                {/* 查询条件 */}
                <div style={{ marginBottom: 16 }}>
                  <Form
                    form={historyForm}
                    layout="vertical"
                  >
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item
                          name="content_name"
                          label={t('content.col.contentName')}
                        >
                          <Input placeholder={t('common.placeholder.enter')} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          name="processed_type"
                          label={t('content.col.processedType')}
                        >
                          <Select
                            placeholder={t('common.placeholder.select')}
                            allowClear
                            options={[
                              { label: 'Add', value: 'Add' },
                              { label: 'Delete', value: 'Delete' },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          name="processed_by"
                          label={t('content.col.processedBy')}
                        >
                          <Input placeholder={t('common.placeholder.enter')} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row>
                      <Col span={24} style={{ textAlign: 'right' }}>
                        <Button onClick={handleHistoryReset} style={{ marginRight: 8 }}>
                          {t('common.reset')}
                        </Button>
                        <Button
                          type="primary"
                          icon={<SearchOutlined />}
                          onClick={() => void handleHistorySearch()}
                        >
                          {t('common.search')}
                        </Button>
                      </Col>
                    </Row>
                  </Form>
                </div>

                {/* 查询结果 */}
                <Table<EpisodeHistoryItem>
                  rowKey="id"
                  columns={historyColumns}
                  dataSource={historyItems}
                  scroll={{ x: 700 }}
                  pagination={{ pageSize: 10, showQuickJumper: true, position: ['bottomCenter'] }}
                  locale={{ emptyText: t('content.seasonSeries.noHistory') }}
                  size="small"
                />
              </Spin>
            ),
          },
        ]}
      />
      )}
    </Modal>
  )
}
