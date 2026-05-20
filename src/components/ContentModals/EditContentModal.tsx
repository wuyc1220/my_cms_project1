/**
 * EditContentModal - 编辑内容弹窗组件
 *
 * 功能：
 *  - 根据 contentId 加载内容详情并回填表单
 *  - 根据内容类型动态显示不同表单字段
 *  - content_type 字段在编辑模式下只读
 *  - 调用 updateContent 接口更新内容
 */

import { useEffect, useState } from 'react'
import {
  Col,
  DatePicker,
  Form,
  InputNumber,
  Modal,
  Row,
  Select,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { getContent, updateContent, getSeriesSimple, getChannelsSimple } from '../../api/contents'
import { getGenres } from '../../api/genres'
import { getCustomTags } from '../../api/customTags'
import TrimInput from '../TrimInput'
import type { ContentUpdatePayload, ContentSimpleItem, SeasonDetailRow } from '../../types/content'
import type { GenreListItem, CustomTagListItem } from '../../types/basic'
import { useI18n } from '../../i18n/useI18n'
import { isHandledError } from '../../api'
import { useFormRules } from '../../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../../constants/form'


const CONTENT_TYPES = [
  { label: 'MOVIE', value: 'MOVIE' },
  { label: 'EPISODE', value: 'EPISODE' },
  { label: 'SEASON', value: 'SEASON' },
  { label: 'SERIES', value: 'SERIES' },
  { label: 'CHANNEL', value: 'CHANNEL' },
  { label: 'SCHEDULE', value: 'SCHEDULE' },
]

interface EditContentModalProps {
  open: boolean
  contentId: number | null
  onClose: () => void
  onSuccess: () => void
}

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

export default function EditContentModal({
  open,
  contentId,
  onClose,
  onSuccess,
}: EditContentModalProps) {
  const { t, language, options } = useI18n()
  const formRules = useFormRules()
  const [form] = Form.useForm<ContentFormValues>()
  const [loading, setLoading] = useState(false)

  const [genreOptions, setGenreOptions] = useState<{ label: string; value: number }[]>([])
  const [customTagOptions, setCustomTagOptions] = useState<{ label: string; value: number }[]>([])
  const [seriesOptions, setSeriesOptions] = useState<ContentSimpleItem[]>([])
  const [channelOptions, setChannelOptions] = useState<ContentSimpleItem[]>([])

  const currentType = Form.useWatch('content_type', form)

  useEffect(() => {
    if (!open || !contentId) return

    const defaultLanguageCode = options[0]?.code ?? language

    const loadOptions = async () => {
      try {
        const [genres, customTags, series, channels] = await Promise.all([
          getGenres({ page: 1, page_size: 500, languages: [defaultLanguageCode] }),
          getCustomTags({ page: 1, page_size: 500 }),
          getSeriesSimple(),
          getChannelsSimple(),
        ])
        setGenreOptions(genres.items.map((g: GenreListItem) => ({ label: g.name, value: g.id })))
        setCustomTagOptions(customTags.items.map((ct: CustomTagListItem) => ({ label: ct.name, value: ct.id })))
        setSeriesOptions(series)
        setChannelOptions(channels)
      } catch (err) {
        if (isHandledError(err)) return
        void message.error(t('trade.content.msg.initFailed'), 5)
      }
    }

    const loadDetail = async () => {
      try {
        const detail = await getContent(contentId)
        form.setFieldsValue({
          title: detail.content.title,
          content_type: detail.content.content_type,
          genre_id: detail.content.genre_id,
          custom_tag_ids: detail.content.custom_tag_ids ?? [],
          parent_id: detail.content.parent_id,
          sequence: detail.content.sequence,
          volumn_count: detail.content.volumn_count,
          begin_time: detail.content.begin_time ? dayjs(detail.content.begin_time) : undefined,
          end_time: detail.content.end_time ? dayjs(detail.content.end_time) : undefined,
        })
      } catch (err) {
        if (isHandledError(err)) return
        void message.error(t('trade.content.msg.loadFailed'), 5)
      }
    }

    void loadOptions()
    void loadDetail()
  }, [open, contentId, form, t, language, options])

  const handleSubmit = async () => {
    if (!contentId) return
    const values = await form.validateFields()
    setLoading(true)
    try {
      const payload: ContentUpdatePayload = {
        title: values.title,
        genre_id: values.genre_id,
        custom_tag_ids: values.custom_tag_ids,
        parent_id: values.parent_id,
        sequence: values.sequence,
        begin_time: values.begin_time?.toISOString(),
        end_time: values.end_time?.toISOString(),
      }
      await updateContent(contentId, payload)
      void message.success(t('trade.content.msg.updated'), 3)
      onSuccess()
      closeModal()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('common.msg.updateFailed'), 5)
    } finally {
      setLoading(false)
    }
  }

  const closeModal = () => {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title={t('trade.content.modal.titleEdit')}
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
          <Col span={12}>
            <Form.Item
              name="title"
              label={t('content.col.contentName')}
              rules={[{ required: true, message: t('trade.content.form.nameRequired') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
            >
              <TrimInput placeholder={t('trade.content.form.nameRequired')} style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="content_type"
              label={t('content.col.contentType')}
              rules={[{ required: true, message: t('trade.content.form.typeRequired') }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                disabled
                placeholder={t('trade.content.form.typeRequired')}
                options={CONTENT_TYPES}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>

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

          {currentType === 'SERIES' && (
            <Col span={12}>
              <Form.Item
                name="volumn_count"
                label={t('trade.content.form.volumnCount')}
                rules={[{ required: true, message: t('trade.content.form.episodeCountRequired') }]}
              >
                <InputNumber min={1} max={999} disabled placeholder={t('trade.content.form.episodeCountRequired')} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          )}

          {currentType === 'SEASON' && (
            <Col span={24}>
              <Form.Item
                name="volumn_count"
                label={t('trade.content.form.seasonCount')}
                rules={[{ required: true, message: t('trade.content.form.seasonCountRequired') }]}
              >
                <InputNumber min={1} max={50} disabled placeholder={t('trade.content.form.seasonCountRequired')} style={{ width: 200 }} />
              </Form.Item>
            </Col>
          )}

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
                  dependencies={['begin_time']}
                  rules={[
                    { required: true, message: t('trade.content.form.endTimeRequired') },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const beginTime = getFieldValue('begin_time')
                        if (!value || !beginTime || value.isAfter(beginTime)) {
                          return Promise.resolve()
                        }
                        return Promise.reject(new Error(t('trade.content.form.endTimeAfterBegin')))
                      },
                    }),
                  ]}
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
