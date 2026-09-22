/**
 * PhysicalChannelModal — 物理频道管理弹框
 *
 * 用于在频道详情页管理物理频道（增删查 + 历史记录）
 * 包含三个标签页：Add（添加）、List（列表）、History（历史记录）
 *
 * 需求文档：docs/CMS_模块_03_内容管理详情.md 3.10 Physical Channel 弹框
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  DatePicker,
  Form,
  InputNumber,
  Modal,
  Select,
  Switch,
  Tabs,
  message,
  Row,
  Col,
  Space,
  Spin,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getPhysicalChannels,
  createPhysicalChannel,
  deletePhysicalChannel,
  getPhysicalChannelHistory,
} from '../api/live'
import { getDictTree } from '../api/dicts'
import { getCustomFields } from '../api/customFields'
import { getConfigs } from '../api/configs'
import { getMultiLanguageOptions } from '../api/i18n'
import ResizableTable from './ResizableTable'
import TrimInput from './TrimInput'
import CustomFieldControl from './CustomFieldControl'
import PhysicalChannelTable from './PhysicalChannelTable'
import { formatApiValue, getCustomFieldRules, getCustomFieldPlaceholder, getOptionLabel } from '../utils/customField'
import type {
  PhysicalChannelListItem,
  PhysicalChannelCreatePayload,
  PhysicalChannelHistoryItem,
  PhysicalChannelHistoryQueryParams,
} from '../types/live'
import type { DictNodeListItem } from '../types/dict'
import type { CustomFieldListItem } from '../types/basic'
import type { LanguageOption } from '../types/i18n'
import { useI18n } from '../i18n/useI18n'
import { useFormRules } from '../hooks/useFormRules'
import { isHandledError } from '../api'
import { useTablePagination } from '../hooks/useTablePagination'
import { useSensitiveCheck } from '../hooks/useSensitiveCheck'
import { FORM_MAX_LENGTH } from '../constants/form'




// ─── 辅助函数 ──────────────────────────────────────────────────────────────

/** 从字典树中提取指定 code 的选项列表 */
function extractDictOptions(
  tree: DictNodeListItem[],
  code: string
): { label: string; value: string }[] {
  for (const node of tree) {
    if (node.code === code) {
      return node.children.map((c) => ({ label: c.name, value: c.code }))
    }
    if (node.children.length) {
      const found = extractDictOptions(node.children, code)
      if (found.length) return found
    }
  }
  return []
}

// ─── 组件 ──────────────────────────────────────────────────────────────────

interface PhysicalChannelModalProps {
  open: boolean
  channelId: number
  readOnly?: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function PhysicalChannelModal({
  open,
  channelId,
  readOnly = false,
  onClose,
  onSuccess,
}: PhysicalChannelModalProps) {
  const { t } = useI18n()
  const { checkSensitive } = useSensitiveCheck()
  const formRules = useFormRules()
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState(readOnly ? 'list' : 'add')
  const prevOpenRef = useRef(false)

  // ── 字典 / 自定义字段 / 配置 / 多语言 ──
  const [dictTree, setDictTree] = useState<DictNodeListItem[]>([])
  const [dictLoading, setDictLoading] = useState(false)
  const [customFields, setCustomFields] = useState<CustomFieldListItem[]>([])
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([])
  const [defaultLanguage, setDefaultLanguage] = useState<string>('')
  const [cfLoading, setCfLoading] = useState(false)
  const [deeplinkHint, setDeeplinkHint] = useState('')

  const mediaserviceOptions = useMemo(
    () => extractDictOptions(dictTree, 'Mediaservice'),
    [dictTree]
  )
  const definitionOptions = useMemo(
    () => extractDictOptions(dictTree, 'Definition'),
    [dictTree]
  )
  const videoencodeOptions = useMemo(
    () => extractDictOptions(dictTree, 'Videoencode'),
    [dictTree]
  )

  // 默认值：mediaservice 第一个，videoencode 为 "0"
  useEffect(() => {
    if (mediaserviceOptions.length > 0 && !form.getFieldValue('mediaservice')) {
      form.setFieldsValue({ mediaservice: mediaserviceOptions[0].value })
    }
  }, [mediaserviceOptions, form])

  useEffect(() => {
    if (videoencodeOptions.length > 0 && !form.getFieldValue('videoencode')) {
      form.setFieldsValue({ videoencode: '0' })
    }
  }, [videoencodeOptions, form])

  useEffect(() => {
    if (definitionOptions.length > 0 && !form.getFieldValue('definition')) {
      form.setFieldsValue({ definition: definitionOptions[0].value })
    }
  }, [definitionOptions, form])

  // ── List Tab ──
  const [listLoading, setListLoading] = useState(false)
  const [listData, setListData] = useState<PhysicalChannelListItem[]>([])
  const {
    pagination: listPagination,
    updatePagination: updateListPagination,
    resetPagination: resetListPagination,
    tablePaginationProps: listPaginationProps,
    handleTableChange: handleListTableChange,
  } = useTablePagination({
    onChange: ({ page, pageSize }) => {
      void loadListData(page, pageSize)
    },
  })

  // ── History Tab ──
  const [historyForm] = Form.useForm()
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyData, setHistoryData] = useState<PhysicalChannelHistoryItem[]>([])
  const historyFiltersRef = useRef<PhysicalChannelHistoryQueryParams>({})
  const {
    pagination: historyPagination,
    updatePagination: updateHistoryPagination,
    resetPagination: resetHistoryPagination,
    tablePaginationProps: historyPaginationProps,
    handleTableChange: handleHistoryTableChange,
  } = useTablePagination({
    onChange: ({ page, pageSize }) => {
      void loadHistoryData(page, pageSize, historyFiltersRef.current)
    },
  })

  // ── 数据加载 ──
  const loadDicts = useCallback(async () => {
    setDictLoading(true)
    try {
      const tree = await getDictTree()
      setDictTree(tree)
    } catch{
      // ignore
    } finally {
      setDictLoading(false)
    }
  }, [])

  const loadCustomFields = useCallback(async () => {
    setCfLoading(true)
    try {
      const res = await getCustomFields({ page_size: 1000 })
      const fields = res.items.filter(
        (f) =>
          f.belongings.includes('ALL') ||
          f.belongings.includes('PhysicalChannel')
      )
      setCustomFields(fields)
    } catch {
      // ignore
    } finally {
      setCfLoading(false)
    }
  }, [])

  const loadDeeplinkHint = useCallback(async () => {
    try {
      const res = await getConfigs({
        config_key: 'PHYSICAL_DEEPLINK_HINT',
        page_size: 1,
      })
      if (res.items.length > 0 && res.items[0].config_value) {
        setDeeplinkHint(res.items[0].config_value)
      }
    } catch {
      // ignore
    }
  }, [])

  const loadLanguages = useCallback(async () => {
    try {
      const langs = await getMultiLanguageOptions()
      setLanguageOptions(langs)
      setDefaultLanguage(langs[0]?.code ?? '')
    } catch {
      // ignore
    }
  }, [])

  const loadListData = useCallback(
    async (p: number, ps?: number) => {
      setListLoading(true)
      try {
        const pageSize = ps ?? listPagination.pageSize
        const res = await getPhysicalChannels(channelId, {
          page: p,
          page_size: pageSize,
        })
        setListData(res.items)
        updateListPagination(res)
      } catch (err) {
        if (isHandledError(err)) return
        void message.error(t('physicalChannel.msg.loadListFailed'), 5)
      } finally {
        setListLoading(false)
      }
    },
    [channelId, t, listPagination.pageSize, updateListPagination]
  )

  const loadHistoryData = useCallback(
    async (
      p: number,
      ps?: number | PhysicalChannelHistoryQueryParams,
      params?: PhysicalChannelHistoryQueryParams
    ) => {
      setHistoryLoading(true)
      let pageSize: number
      let filters: PhysicalChannelHistoryQueryParams | undefined
      if (typeof ps === 'object') {
        pageSize = historyPagination.pageSize
        filters = ps
      } else {
        pageSize = ps ?? historyPagination.pageSize
        filters = params
      }
      try {
        const res = await getPhysicalChannelHistory(channelId, {
          page: p,
          page_size: pageSize,
          ...filters,
        })
        setHistoryData(res.items)
        updateHistoryPagination(res)
      } catch (err) {
        if (isHandledError(err)) return
        void message.error(t('physicalChannel.msg.loadHistoryFailed'), 5)
      } finally {
        setHistoryLoading(false)
      }
    },
    [channelId, t, historyPagination.pageSize, updateHistoryPagination]
  )

  // 弹框打开时初始化
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      void loadDicts()
      void loadCustomFields()
      void loadDeeplinkHint()
      void loadLanguages()
      resetListPagination()
      resetHistoryPagination()
      historyFiltersRef.current = {}
      void loadListData(1)
      void loadHistoryData(1)
      form.resetFields()
      historyForm.resetFields()
      setActiveTab(readOnly ? 'list' : 'add')
    }
    prevOpenRef.current = open
  }, [open, form, historyForm, readOnly])

  // ── 提交新增 ──
  const handleAddSubmit = async () => {
    try {
      const values = await form.validateFields()
      // 自定义字段随创建一并提交，后端合并记录一条 Add 日志（避免单独记录 Update 日志）
      const custom_fields = customFields
        .map((f) => ({
          custom_field_id: f.id,
          value: formatApiValue(f.field_type, values[f.field_code]) || null,
        }))
        .filter((item) => item.value !== null && item.value !== '')
      const payload: PhysicalChannelCreatePayload = {
        mediaservice: values.mediaservice,
        definition: values.definition,
        videoencode: values.videoencode,
        bitrate: values.bitrate,
        deeplink_ch_url: values.deeplink_ch_url,
        shifttime: values.shifttime,
        tvod_save_time: values.tvod_save_time,
        tvod_enable: values.tvod_enable,
        tstv_enable: values.tstv_enable,
        cutv_enable: values.cutv_enable,
        encryption: values.encryption,
        custom_fields,
      }
      // 敏感词预校验：检查 payload 中的文本字段
      const ok = await checkSensitive(payload as Record<string, unknown>)
      if (!ok) return

      await createPhysicalChannel(channelId, payload)

      void message.success(t('physicalChannel.msg.createSuccess'))
      form.resetFields()
      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail
      if (detail) void message.error(detail, 5)
    }
  }

  // ── 删除 ──
  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: t('physicalChannel.confirm.deleteTitle'),
      content: t('physicalChannel.confirm.delete'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deletePhysicalChannel(channelId, id)
          void message.success(t('physicalChannel.msg.deleteSuccess'))
          void loadListData(listPagination.current)
          void loadHistoryData(1)
          onSuccess?.()
        } catch (err) {
          if (isHandledError(err)) return
          void message.error(
            t('physicalChannel.msg.deleteFailed') || 'Delete failed',
            5
          )
        }
      },
    })
  }

  // ── 历史查询 ──
  const handleHistorySearch = () => {
    const values = historyForm.getFieldsValue()
    const filters: PhysicalChannelHistoryQueryParams = {
      processed_type: values.processed_type,
      processed_by: values.processed_by,
    }
    if (values.processed_at && values.processed_at.length === 2) {
      filters.processed_at_from = values.processed_at[0].startOf('day').format('YYYY-MM-DD 00:00:00')
      filters.processed_at_to = values.processed_at[1].endOf('day').format('YYYY-MM-DD 23:59:59')
    }
    historyFiltersRef.current = filters
    resetHistoryPagination()
    void loadHistoryData(1, filters)
  }

  const handleHistoryReset = () => {
    historyForm.resetFields()
    historyFiltersRef.current = {}
    resetHistoryPagination()
    void loadHistoryData(1)
  }

  // ── 列定义 ──

  const historyColumns: ColumnsType<PhysicalChannelHistoryItem> = [
    {
      title: t('physicalChannel.col.mediaservice'),
      dataIndex: 'mediaservice',
      key: 'mediaservice',
      width: 120,
      render: (v?: string) => {
        if (!v) return '—'
        const opt = mediaserviceOptions.find((o) => o.value === v)
        return opt?.label ?? v
      },
    },
    {
      title: t('physicalChannel.col.definition'),
      dataIndex: 'definition',
      key: 'definition',
      width: 100,
      render: (v?: string) => {
        if (!v) return '—'
        const opt = definitionOptions.find((o) => o.value === v)
        return opt?.label ?? v
      },
    },
    {
      title: t('physicalChannel.col.videoencode'),
      dataIndex: 'videoencode',
      key: 'videoencode',
      width: 120,
      render: (v?: string) => {
        if (!v) return '—'
        const opt = videoencodeOptions.find((o) => o.value === v)
        return opt?.label ?? v
      },
    },
    {
      title: t('physicalChannel.col.bitrate'),
      dataIndex: 'bitrate',
      key: 'bitrate',
      width: 100,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('physicalChannel.col.processedAt'),
      dataIndex: 'processed_at',
      key: 'processed_at',
      width: 180,
      render: (v?: string) =>
        v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—',
    },
    {
      title: t('physicalChannel.col.processedBy'),
      dataIndex: 'processed_by',
      key: 'processed_by',
      width: 200,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('physicalChannel.col.processedType'),
      dataIndex: 'processed_type',
      key: 'processed_type',
      width: 120,
    },
  ]

  return (
    <Modal
      title={t('physicalChannel.modal.title')}
      open={open}
      onCancel={onClose}
      footer={null}
      width={'60%'}
      destroyOnHidden
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'add',
            label: t('physicalChannel.tab.add'),
            children: (
              <Spin spinning={dictLoading || cfLoading}>
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        name="definition"
                        label={t('physicalChannel.form.definition')}
                        rules={[
                          {
                            required: true,
                            message: t('physicalChannel.form.definitionRequired'),
                          },
                        ]}
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          placeholder={t('physicalChannel.placeholder.select')}
                          options={definitionOptions}
                          allowClear
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="mediaservice"
                        label={t('physicalChannel.form.mediaservice')}
                        rules={[
                          {
                            required: true,
                            message: t('physicalChannel.form.mediaserviceRequired'),
                          },
                        ]}
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          placeholder={t('physicalChannel.placeholder.select')}
                          options={mediaserviceOptions}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="videoencode"
                        label={t('physicalChannel.form.videoencode')}
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          placeholder={t('physicalChannel.placeholder.select')}
                          options={videoencodeOptions}
                          allowClear
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        name="bitrate"
                        label={t('physicalChannel.form.bitrate')}
                        rules={[formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
                      >
                        <TrimInput
                          placeholder={t('physicalChannel.placeholder.enter')}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="shifttime"
                        label={t('physicalChannel.form.shifttime')}
                        initialValue={0}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0}
                          placeholder={t('physicalChannel.placeholder.enter')}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="tvod_save_time"
                        label={t('physicalChannel.form.tvodSaveTime')}
                        initialValue={0}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0}
                          placeholder={t('physicalChannel.placeholder.enter')}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16} align="top">
                    <Col span={16}>
                      <Form.Item
                        name="deeplink_ch_url"
                        label={t('physicalChannel.form.deeplinkChUrl')}
                        rules={[formRules.maxLength(FORM_MAX_LENGTH.DEEPLINK_CH_URL)]}
                      >
                        <TrimInput.TextArea
                          rows={5}
                          placeholder={
                            deeplinkHint ||
                            t('physicalChannel.placeholder.deeplink')
                          }
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8} style={{ display: 'flex',flexWrap:'wrap' }}>
                      <Form.Item
                          style={{ width: '45%'}}
                        name="encryption"
                        label={t('physicalChannel.form.encryption')}
                        valuePropName="checked"
                        initialValue={true}
                      >
                        <Switch checkedChildren={t('common.yes')} unCheckedChildren={t('common.no')} />
                      </Form.Item>
                      <Form.Item
                          style={{ width: '45%'}}
                        name="tvod_enable"
                        label={t('physicalChannel.form.tvodEnable')}
                        valuePropName="checked"
                        initialValue={false}
                      >
                        <Switch checkedChildren={t('common.yes')} unCheckedChildren={t('common.no')} />
                      </Form.Item>
                      <Form.Item
                          style={{ width: '45%'}}
                        name="tstv_enable"
                        label={t('physicalChannel.form.tstvEnable')}
                        valuePropName="checked"
                        initialValue={true}
                      >
                        <Switch checkedChildren={t('common.yes')} unCheckedChildren={t('common.no')} />
                      </Form.Item>
                      <Form.Item
                          style={{ width: '45%'}}
                        name="cutv_enable"
                        label={t('physicalChannel.form.cutvEnable')}
                        valuePropName="checked"
                        initialValue={false}
                      >
                        <Switch checkedChildren={t('common.yes')} unCheckedChildren={t('common.no')} />
                      </Form.Item>
                    </Col>
                  </Row>

                  {customFields.length > 0 && (
                    <Row gutter={16}>
                      {customFields.map((field) => (
                        <Col span={8} key={field.field_code}>
                          <Form.Item
                            name={field.field_code}
                            label={field.field_name}
                            rules={getCustomFieldRules(
                              field,
                              t('customField.validation.integerOnly'),
                              t,
                            )}
                          >
                            <CustomFieldControl
                              fieldType={field.field_type}
                              options={field.options.map((o) => ({
                                value: o.code,
                                label: getOptionLabel(o.names, defaultLanguage, languageOptions.map((l) => l.code)) || o.code,
                              }))}
                              placeholder={getCustomFieldPlaceholder(field, t)}
                            />
                          </Form.Item>
                        </Col>
                      ))}
                    </Row>
                  )}

                  <Row justify="end" style={{ marginTop: 24 }}>
                    <Space>
                      <Button onClick={() => { form.resetFields(); onClose(); }}>
                        {t('physicalChannel.btn.cancel')}
                      </Button>
                      <Button type="primary" onClick={handleAddSubmit}>
                        {t('physicalChannel.btn.confirm')}
                      </Button>
                    </Space>
                  </Row>
                </Form>
              </Spin>
            ),
          },
          {
            key: 'list',
            label: t('physicalChannel.tab.list'),
            children: (
              <PhysicalChannelTable
                channelId={channelId}
                dataSource={listData}
                loading={listLoading}
                paginationProps={listPaginationProps}
                onTableChange={handleListTableChange}
                locale={{ emptyText: t('common.noData') }}
                showDelete={!readOnly}
                onDelete={(id) => void handleDelete(id)}
              />
            ),
          },
          {
            key: 'history',
            label: t('physicalChannel.tab.history'),
            children: (
              <>
                <div style={{ marginBottom: 16 }}>

                  <Form form={historyForm} layout="vertical">
                    <Row gutter={16}>
                      <Col span={6}>
                        <Form.Item
                          name="processed_type"
                          label={t('physicalChannel.col.processedType')}
                        >
                          <Select
                            showSearch
                            optionFilterProp="label"
                            placeholder={t('physicalChannel.placeholder.select')}
                            style={{ width: '100%' }}
                            allowClear
                          >
                            <Select.Option value="Add">{t('physicalChannel.history.processedType.add')}</Select.Option>
                            <Select.Option value="Delete">{t('physicalChannel.history.processedType.delete')}</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          name="processed_by"
                          label={t('physicalChannel.col.processedBy')}
                          rules={[formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
                        >
                          <TrimInput
                            placeholder={t('physicalChannel.placeholder.keyword')}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          name="processed_at"
                          label={t('physicalChannel.col.processedAt')}
                        >
                          <DatePicker.RangePicker
                            style={{ width: '100%' }}
                            format="YYYY-MM-DD"
                            placeholder={[t('common.placeholder.startTime'), t('common.placeholder.endTime')]}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        {/* label=" " 占位标签行高度，使按钮与输入框底部对齐 */}
                        <Form.Item label=" " colon={false}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Space>
                              <Button type="primary" onClick={handleHistorySearch}>
                                {t('physicalChannel.btn.filter')}
                              </Button>
                              <Button onClick={handleHistoryReset}>
                                {t('physicalChannel.btn.reset')}
                              </Button>
                            </Space>
                          </div>
                        </Form.Item>
                      </Col>
                    </Row>
                  </Form>
                </div>
                <ResizableTable<PhysicalChannelHistoryItem>
                  rowKey="id"
                  loading={historyLoading}
                  columns={historyColumns}
                  dataSource={historyData}
                  scroll={{ x: 940 }}
                  pagination={historyPaginationProps}
                  onChange={handleHistoryTableChange}
                  locale={{ emptyText: t('common.noData') }}
                  size="small"
                />
              </>
            ),
          },
        ].filter((item) => !readOnly || item.key !== 'add')}
      />
    </Modal>
  )
}
