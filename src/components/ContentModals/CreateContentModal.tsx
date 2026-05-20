/**
 * CreateContentModal - 新增内容弹窗组件
 *
 * 功能：
 *  - 支持创建多种类型的内容：MOVIE, EPISODE, SERIES, SEASON, CHANNEL, SCHEDULE
 *  - 根据内容类型动态显示不同表单字段
 *  - 支持预填内容类型
 */

import { useEffect, useState } from 'react'
import {
  Col,
  DatePicker,
  Divider,
  Form,
  InputNumber,
  Modal,
  Row,
  Select,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { createContent, getSeriesSimple, getChannelsSimple } from '../../api/contents'
import { getGenres } from '../../api/genres'
import { getCustomTags } from '../../api/customTags'
import TrimInput from '../TrimInput'
import type { ContentCreatePayload, ContentSimpleItem, SeasonDetailRow } from '../../types/content'
import type { GenreListItem, CustomTagListItem } from '../../types/basic'
import { useI18n } from '../../i18n/useI18n'
import { isHandledError } from '../../api'
import { useFormRules } from '../../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../../constants/form'


// ─── 常量 ────────────────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { label: 'MOVIE', value: 'MOVIE' },
  { label: 'EPISODE', value: 'EPISODE' },
  { label: 'SEASON', value: 'SEASON' },
  { label: 'SERIES', value: 'SERIES' },
  { label: 'CHANNEL', value: 'CHANNEL' },
  { label: 'SCHEDULE', value: 'SCHEDULE' },
]

// ─── 组件 Props ──────────────────────────────────────────────────────────────

interface CreateContentModalProps {
  open: boolean
  /** 预填内容类型 */
  defaultContentType?: string
  onClose: () => void
  onSuccess: (content: ContentSimpleItem) => void
}

// ─── 表单值类型 ──────────────────────────────────────────────────────────────

interface ContentFormValues {
  title: string
  content_type: string
  genre_id?: number
  custom_tag_ids?: number[]
  parent_id?: number
  sequence?: number
  series_type?: number
  volumn_count?: number
  season_details?: SeasonDetailRow[]
  begin_time?: dayjs.Dayjs
  end_time?: dayjs.Dayjs
}

export default function CreateContentModal({
  open,
  defaultContentType,
  onClose,
  onSuccess,
}: CreateContentModalProps) {
  const { t, language, options } = useI18n()
  const formRules = useFormRules()
  const [form] = Form.useForm<ContentFormValues>()
  const [loading, setLoading] = useState(false)

  // 下拉选项
  const [genreOptions, setGenreOptions] = useState<{ label: string; value: number }[]>([])
  const [customTagOptions, setCustomTagOptions] = useState<{ label: string; value: number }[]>([])
  const [seriesOptions, setSeriesOptions] = useState<ContentSimpleItem[]>([])
  const [channelOptions, setChannelOptions] = useState<ContentSimpleItem[]>([])

  // SEASON 明细行（受控）
  const [seasonRows, setSeasonRows] = useState<SeasonDetailRow[]>([])

  // 表单监听
  const currentType = Form.useWatch('content_type', form)
  const volumnCount = Form.useWatch('volumn_count', form)

  // ─── 初始化选项 ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      void loadOptions()
      form.resetFields()
      setSeasonRows([])
      if (defaultContentType) {
        form.setFieldsValue({ content_type: defaultContentType })
      }
    }
  }, [open, defaultContentType, form])

  // SEASON 季数变化时，自动生成明细行
  useEffect(() => {
    if (currentType === 'SEASON' && volumnCount && volumnCount > 0) {
      const rows: SeasonDetailRow[] = []
      for (let i = 1; i <= volumnCount; i++) {
        rows.push({ series_ordinal: i, episode_count: 0 })
      }
      setSeasonRows(rows)
    }
  }, [volumnCount, currentType])

  const loadOptions = async () => {
    const defaultLanguageCode = options[0]?.code ?? language
    try {
      const [genres, customTags, series, channels] = await Promise.all([
        getGenres({ page: 1, page_size: 500, languages: [defaultLanguageCode] }),
        getCustomTags({ page: 1, page_size: 500 }),
        getSeriesSimple(),
        getChannelsSimple(),
      ])
      setGenreOptions(genres.items.map((g: GenreListItem) => ({ label: g.name, value: g.id })))
      setCustomTagOptions(customTags.items.map((t: CustomTagListItem) => ({ label: t.name, value: t.id })))
      setSeriesOptions(series)
      setChannelOptions(channels)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('trade.content.msg.initFailed'), 5)
    }
  }

  // ─── 提交表单 ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const values = await form.validateFields()
    setLoading(true)
    try {
      const payload: ContentCreatePayload = {
        title: values.title,
        content_type: values.content_type,
        genre_id: values.genre_id,
        custom_tag_ids: values.custom_tag_ids,
        parent_id: values.parent_id,
        sequence: values.sequence,
        series_type: values.series_type,
        volumn_count: values.volumn_count,
        season_details: currentType === 'SEASON' ? seasonRows : undefined,
        begin_time: values.begin_time?.toISOString(),
        end_time: values.end_time?.toISOString(),
      }
      const result = await createContent(payload)
      void message.success(t('trade.content.msg.created'), 3)
      onSuccess({
        id: result.id,
        content_type: result.content_type,
        title: result.title,
      })
      onClose()
    } catch (e: unknown) {
      if (isHandledError(e)) return
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      void message.error(detail ?? t('common.msg.createFailed'), 5)
    } finally {
      setLoading(false)
    }
  }

  const closeModal = () => {
    form.resetFields()
    setSeasonRows([])
    onClose()
  }

  // ─── JSX ────────────────────────────────────────────────────────────────────

  return (
    <Modal
      title={t('trade.content.modal.titleCreate')}
      open={open}
      onCancel={closeModal}
      onOk={() => void handleSubmit()}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      confirmLoading={loading}
      destroyOnHidden
      width={720}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          {/* Content Name */}
          <Col span={12}>
            <Form.Item
              name="title"
              label={t('content.col.contentName')}
              rules={[{ required: true, message: t('trade.content.form.nameRequired') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
            >
              <TrimInput placeholder={t('trade.content.form.nameRequired')} style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          {/* Content Type */}
          <Col span={12}>
            <Form.Item
              name="content_type"
              label={t('content.col.contentType')}
              rules={[{ required: true, message: t('trade.content.form.typeRequired') }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={t('trade.content.form.typeRequired')}
                options={CONTENT_TYPES}
                style={{ width: '100%' }}
                onChange={() => {
                  form.setFieldsValue({
                    parent_id: undefined,
                    sequence: undefined,
                    volumn_count: undefined,
                    begin_time: undefined,
                    end_time: undefined,
                  })
                  setSeasonRows([])
                }}
              />
            </Form.Item>
          </Col>

          {/* Genre */}
          <Col span={12}>
            <Form.Item name="genre_id" label={t('trade.col.genre')}>
              <Select
                allowClear
                showSearch
                placeholder={t('trade.content.search.genre')}
                options={genreOptions}
                filterOption={(input, opt) =>
                  String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>

          {/* Custom_Tags */}
          <Col span={12}>
            <Form.Item name="custom_tag_ids" label={t('menu.basic.customTags')}>
              <Select
                mode="multiple"
                allowClear
                showSearch
                placeholder={t('metadata.channel.customTagsPlaceholder')}
                options={customTagOptions}
                filterOption={(input, opt) =>
                  String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>

          {/* ── EPISODE 专属字段 ──────────────────────────────── */}
          {currentType === 'EPISODE' && (
            <>
              <Col span={12}>
                <Form.Item
                  name="parent_id"
                  label={t('trade.content.form.parentSeries')}
                  rules={[{ required: true, message: t('trade.content.form.parentRequired') }]}
                >
                  <Select
                    showSearch
                    allowClear
                    placeholder={t('trade.content.form.parentRequired')}
                    options={seriesOptions.map((s) => ({ label: s.title, value: s.id }))}
                    filterOption={(input, opt) =>
                      String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="sequence"
                  label={t('content.col.sequence')}
                  rules={[{ required: true, message: t('trade.content.form.sequenceRequired') }]}
                >
                  <InputNumber min={1} placeholder={t('content.col.sequence')} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </>
          )}

          {/* ── SERIES 专属字段 ────────────────────────────────── */}
          {currentType === 'SERIES' && (
            <Col span={12}>
              <Form.Item
                name="volumn_count"
                label={t('trade.content.form.volumnCount')}
                rules={[{ required: true, message: t('trade.content.form.episodeCountRequired') }]}
              >
                <InputNumber min={1} max={999} placeholder={t('trade.content.form.episodeCountRequired')} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          )}

          {/* ── SEASON 专属字段 ────────────────────────────────── */}
          {currentType === 'SEASON' && (
            <>
              <Col span={24}>
                <Form.Item
                  name="volumn_count"
                  label={t('trade.content.form.seasonCount')}
                  rules={[{ required: true, message: t('trade.content.form.seasonCountRequired') }]}
                >
                  <InputNumber min={1} max={50} placeholder={t('trade.content.form.seasonCountRequired')} style={{ width: 200 }} />
                </Form.Item>
              </Col>
              {seasonRows.length > 0 && (
                <Col span={24}>
                  <Divider titlePlacement="left" style={{ margin: '8px 0' }}>{t('trade.content.form.seasonDetails')}</Divider>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'center', padding: '4px 8px', background: '#fafafa', border: '1px solid #f0f0f0', width: 80 }}>{t('content.col.seriesOrdinal')}</th>
                        <th style={{ textAlign: 'center', padding: '4px 8px', background: '#fafafa', border: '1px solid #f0f0f0' }}>{t('trade.content.form.episodeCount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seasonRows.map((row, idx) => (
                        <tr key={row.series_ordinal}>
                          <td style={{ textAlign: 'center', padding: '4px 8px', border: '1px solid #f0f0f0' }}>
                            {row.series_ordinal}
                          </td>
                          <td style={{ padding: '4px 8px', border: '1px solid #f0f0f0' }}>
                            <InputNumber
                              min={0}
                              max={999}
                              value={row.episode_count}
                              style={{ width: '100%' }}
                              onChange={(val) => {
                                const updated = [...seasonRows]
                                updated[idx] = { ...updated[idx], episode_count: val ?? 0 }
                                setSeasonRows(updated)
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Col>
              )}
            </>
          )}

          {/* ── SCHEDULE 专属字段 ─────────────────────────────── */}
          {currentType === 'SCHEDULE' && (
            <>
              <Col span={12}>
                <Form.Item
                  name="parent_id"
                  label={t('trade.content.form.channelName')}
                  rules={[{ required: true, message: t('trade.content.form.channelRequired') }]}
                >
                  <Select
                    showSearch
                    allowClear
                    placeholder={t('trade.content.form.channelRequired')}
                    options={channelOptions.map((c) => ({ label: c.title, value: c.id }))}
                    filterOption={(input, opt) =>
                      String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="begin_time"
                  label={t('trade.content.form.beginTime')}
                  rules={[{ required: true, message: t('trade.content.form.beginTimeRequired') }]}
                >
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="end_time"
                  label={t('trade.content.form.endTime')}
                  rules={[{ required: true, message: t('trade.content.form.endTimeRequired') }]}
                >
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </>
          )}
        </Row>
      </Form>
    </Modal>
  )
}
