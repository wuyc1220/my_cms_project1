/**
 * MaterialsModal — 材料注入弹框
 *
 * 三 Tab：
 *   1. 材料添加（表单）
 *   2. 材料文件（列表 + 删除）
 *   3. 材料历史（操作记录）
 *
 * readOnly 模式：隐藏「材料添加」Tab 与删除按钮，仅允许查看。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Col,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
  Switch,
  Tabs,
  Tooltip,
  Upload,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload'
import ResizableTable from './ResizableTable'
import TrimInput from './TrimInput'
import CustomFieldControl from './CustomFieldControl'
import { formatApiValue, getCustomFieldRules, getCustomFieldPlaceholder, getOptionLabel } from '../utils/customField'
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { FORM_MAX_LENGTH } from '../constants/form'
import { PAGINATION_CONFIG } from '../constants/pagination'
import { useFormRules } from '../hooks/useFormRules'

import { uploadAttachment } from '../api/attachments'
import { createMovie, deleteMovie, getMoviesByContentId, getMovieHistoryByContentId, saveMovieI18n, saveMovieFieldValues } from '../api/movies'
import { getMultiLanguageOptions } from '../api/i18n'
import { getDictChildren } from '../api/dicts'
import { getPublicConfig } from '../api/configs'
import { getCustomFields } from '../api/customFields'
import { useSensitiveCheck } from '../hooks/useSensitiveCheck'
import { useI18n } from '../i18n/useI18n'
import type { MovieItem, MovieHistoryItem } from '../types/metadata'
import type { LanguageOption } from '../types/i18n'
import type { CustomFieldListItem } from '../types/basic'
import { isHandledError } from '../api'


interface MaterialsModalProps {
  open: boolean
  contentId: number
  contentName?: string
  onClose: () => void
  /** 固定材料类型：1=Movie, 2=Trailer, 3=Subtitle；不传则可选择 */
  fixedType?: number
  /** 只读模式：隐藏添加 Tab 与删除操作 */
  readOnly?: boolean
  /** 禁用 Movie（正片）类型：归档内容不允许注入正片材料 */
  disableMovieType?: boolean
}

export default function MaterialsModal({
  open,
  contentId,
  contentName,
  onClose,
  fixedType,
  readOnly = false,
  disableMovieType = false,
}: MaterialsModalProps) {
  const { t } = useI18n()
  const { checkSensitive } = useSensitiveCheck()
  const formRules = useFormRules()
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState('add')

  // Material Files
  const [movies, setMovies] = useState<MovieItem[]>([])
  const [moviesLoading, setMoviesLoading] = useState(false)

  // Material History
  const [histories, setHistories] = useState<MovieHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Add form state
  const [submitting, setSubmitting] = useState(false)
  const [fileSource, setFileSource] = useState<'local' | 'temp' | 'external'>('local')
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([])
  const [publishFlag, setPublishFlag] = useState(true)

  // ── 动态数据 ──────────────────────────────────────────────
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldListItem[]>([])
  const [dictOptions, setDictOptions] = useState<Record<string, LanguageOption[]>>({})
  const [deeplinkHint, setDeeplinkHint] = useState('')

  const watchType = Form.useWatch('movie_type', form)
  const isTrailer = (watchType ?? fixedType) === 2
  const isSubtitle = (watchType ?? fixedType) === 3

  // ── 加载数据 ──────────────────────────────────────────────

  const loadMovies = useCallback(async () => {
    setMoviesLoading(true)
    try {
      const resp = await getMoviesByContentId(contentId)
      // 固定材料类型时 Material Files 仅展示对应 type 的文件，按类型分开展示
      setMovies(fixedType !== undefined ? resp.items.filter((m) => Number(m.movie_type) === fixedType) : resp.items)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('content.materials.loadError'), 5)
    } finally {
      setMoviesLoading(false)
    }
  }, [contentId, fixedType, t])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const resp = await getMovieHistoryByContentId(contentId)
      // 与 Material Files 保持一致：固定类型时历史也只展示对应 type 的记录
      setHistories(fixedType !== undefined ? resp.items.filter((h) => Number(h.movie_type) === fixedType) : resp.items)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('content.materials.loadError'), 5)
    } finally {
      setHistoryLoading(false)
    }
  }, [contentId, fixedType, t])

  useEffect(() => {
    if (!open) return
    if (activeTab === 'files') {
      void loadMovies()
    } else if (activeTab === 'history') {
      void loadHistory()
    }
  }, [open, activeTab, loadMovies, loadHistory])

  // 打开弹框时重置表单；只读模式下默认切换到 files
  useEffect(() => {
    if (open) {
      form.resetFields()
      setFileSource('local')
      setUploadFileList([])
      setPublishFlag(true)
      if (fixedType !== undefined) {
        form.setFieldsValue({ movie_type: fixedType })
      }
      if (readOnly) {
        setActiveTab('files')
      }
    }
  }, [open, form, fixedType, readOnly])

  // 打开弹框时加载多语言、自定义字段、字典选项、配置
  useEffect(() => {
    if (!open) return
    void (async () => {
      try {
        const [langs, fields, definitionOpts, audioTypeOpts, screenFormatOpts, mediaserviceOpts] = await Promise.all([
          getMultiLanguageOptions(),
          getCustomFields({ page: 1, page_size: 200, belongings: ['ALL', 'Movie'] }),
          getDictChildren('Definition'),
          getDictChildren('AudioType'),
          getDictChildren('ScreenFormat'),
          getDictChildren('Mediaservice'),
        ])
        setLanguageOptions(langs)
        setCustomFields(fields.items)
        setDictOptions({
          Definition: definitionOpts,
          AudioType: audioTypeOpts,
          ScreenFormat: screenFormatOpts,
          mediaservice: mediaserviceOpts,
        })
      } catch (e) {
        if (!isHandledError(e)) console.error('[MaterialsModal] load options error:', e)
      }

      try {
        const hint = await getPublicConfig('MOVIE_DEEPLINK_HINT')
        setDeeplinkHint(hint ?? t('content.materials.deeplinkHint'))
      } catch (e) {
        setDeeplinkHint(t('content.materials.deeplinkHint'))
      }
    })()
  }, [open, t])

  // ── 提交表单（Ant Design onFinish 模式，values 已通过表单校验） ──

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (readOnly) return

    // 归档内容不允许注入 Movie（正片）材料
    if (disableMovieType && Number(values.movie_type) === 1) {
      void message.error(t('content.materials.movieTypeDisabledForArchive'), 5)
      return
    }

    // 文件非表单字段，单独校验
    if (publishFlag && fileSource === 'local' && uploadFileList.length === 0) {
      void message.error(t('content.materials.pleaseSelectFile'), 5)
      return
    }

    // 获取文件对象（兼容不同版本的 Ant Design）
    const uploadFile = uploadFileList[0]
    const file = (uploadFile?.originFileObj || uploadFile) as File | undefined
    if (publishFlag && fileSource === 'local' && !file) {
      void message.error(t('content.materials.pleaseSelectFile'), 5)
      return
    }

    setSubmitting(true)
    try {
      let fileName: string
      let filePath: string
      let fileSize: number

      let relativePath: string | undefined

      if (publishFlag && fileSource === 'local') {
        const uploadResult = await uploadAttachment(file!, 'materials')
        fileName = uploadResult.file_name
        filePath = uploadResult.storage_url
        relativePath = uploadResult.file_path
        fileSize = uploadResult.file_size
      } else {
        filePath = (values.file_path as string) ?? '/uploads/materials'
        fileName = filePath.split('/').pop() ?? 'unknown'
        fileSize = file?.size ?? 0
      }

      const payload: Omit<MovieItem, 'id' | 'content_id' | 'created_at'> = {
        file_name: fileName,
        file_path: filePath,
        relative_path: relativePath,
        file_size: String(fileSize),
        movie_type: String(values.movie_type as number),
        sequence: (values.sequence as number) ?? null,
        audio_type: (values.audio_type as string) ?? null,
        screen_format: (values.screen_format as string) ?? null,
        closed_captioning: (values.closed_captioning as boolean) ?? true,
        // 字幕类型未填写时保持为空（后端存 NULL）；其他类型由必填校验保证有值
        duration: values.duration != null ? String(values.duration) : null,
        definition: (values.definition as string) ?? null,
        mediaservice: (values.mediaservice as string) ?? null,
        encryption: (values.encryption as boolean) ?? true,
        // Trailer 固定 publish_flag=true，其他类型使用表单值
        publish_flag: isTrailer ? true : (values.publish_flag as boolean) ?? true,
        deeplink: (values.deeplink as string) ?? null,
      }

      // 敏感词预校验：提交前先检查所有文本字段（含 Trailer 多语言名称、自定义字段）
      const checkData: Record<string, unknown> = { ...payload }
      if (isTrailer && languageOptions.length > 0) {
        const i18nNames: Record<string, string> = {}
        languageOptions.forEach((lang) => {
          const nameValue = values[`name_${lang.code}`] as string | undefined
          if (nameValue) i18nNames[lang.code] = nameValue
        })
        if (Object.keys(i18nNames).length > 0) checkData.i18n_names = i18nNames
      }
      if (customFields.length > 0) {
        const cfValues: Record<string, string> = {}
        customFields.forEach((cf) => {
          const v = formatApiValue(cf.field_type, values[`cf_${cf.id}`])
          if (v !== '') cfValues[String(cf.id)] = v
        })
        if (Object.keys(cfValues).length > 0) checkData.custom_fields = cfValues
      }
      const ok = await checkSensitive(checkData)
      if (!ok) return

      const newMovie = await createMovie(contentId, payload)

      // 保存多语言名称
      if (isTrailer && languageOptions.length > 0) {
        await Promise.all(
          languageOptions.map((lang) => {
            const nameValue = values[`name_${lang.code}`] as string | undefined
            if (!nameValue) return Promise.resolve()
            return saveMovieI18n(newMovie.id, {
              language: lang.code,
              fields: { name: nameValue },
            })
          }),
        )
      }

      // 保存自定义字段值
      if (customFields.length > 0) {
        const fieldValues = customFields
          .map((cf) => ({
            custom_field_id: cf.id,
            value: formatApiValue(cf.field_type, values[`cf_${cf.id}`]),
          }))
          .filter((fv) => fv.value !== '')
        if (fieldValues.length > 0) {
          await saveMovieFieldValues(newMovie.id, { values: fieldValues })
        }
      }

      void message.success(t('content.materials.addSuccess'), 3)
      form.resetFields()
      setUploadFileList([])
      // 切换到 Files tab 并刷新
      setActiveTab('files')
      await loadMovies()
      // 关闭弹框，触发父组件刷新内容详情和状态
      onClose()
    } catch (e: unknown) {
      if (isHandledError(e)) return
      // eslint-disable-next-line no-console
      console.error('[MaterialsModal] submit error:', e)
      void message.error(t('content.materials.addFailed'), 5)
    } finally {
      setSubmitting(false)
    }
  }

  // ── 删除 ──────────────────────────────────────────────────

  const handleDelete = async (movieId: number) => {
    if (readOnly) return
    try {
      await deleteMovie(movieId)
      void message.success(t('content.materials.deleteSuccess'), 3)
      await loadMovies()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('content.materials.deleteFailed'), 5)
    }
  }

  // ── 辅助函数 ──────────────────────────────────────────────

  const getMovieTypeLabel = (type: number) => {
    if (type === 1) return t('content.materials.typeMovie')
    if (type === 2) return t('content.materials.typeTrailer')
    if (type === 3) return t('content.materials.typeSubtitle')
    return String(type)
  }

  const getDictName = (options: LanguageOption[], code: string): string => {
    const found = options.find((o) => o.code === code)
    return found?.name ?? code
  }

  const getDefinitionLabel = (defVal: string) => {
    return getDictName(dictOptions.Definition ?? [], defVal)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // ── Material Files 列定义 ─────────────────────────────────

  const fileColumns: ColumnsType<MovieItem> = [
    {
      title: t('content.materials.fileName'),
      dataIndex: 'file_name',
      key: 'file_name',
      width: 200,
      ellipsis: true,
      render: (v: string) => v?.split('/').pop() ?? v,
    },
    {
      title: t('content.col.type'),
      dataIndex: 'movie_type',
      key: 'movie_type',
      width: 110,
      render: (v: number) => getMovieTypeLabel(v),
      ellipsis: true,
    },
    {
      title: t('content.materials.col.fileSize'),
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      render: (v: number) => formatFileSize(v),
    },
    {
      title: t('content.col.audioType'),
      dataIndex: 'audio_type',
      key: 'audio_type',
      width: 110,
      render: (v?: string) => (v ? getDictName(dictOptions.AudioType ?? [], v) : '—'),
      ellipsis: true,
    },
    {
      title: t('content.col.screenFormat'),
      dataIndex: 'screen_format',
      key: 'screen_format',
      width: 120,
      render: (v?: string) => (v ? getDictName(dictOptions.ScreenFormat ?? [], v) : '—'),
      ellipsis: true,
    },
    {
      title: t('content.col.closedCaptioning'),
      dataIndex: 'closed_captioning',
      key: 'closed_captioning',
      width: 130,
      render: (v: boolean) => <Switch checked={v} disabled size="small" />,
      ellipsis: true,
    },
    {
      title: t('content.col.duration'),
      dataIndex: 'duration',
      key: 'duration',
      width: 90,
    },
    {
      title: t('content.col.definition'),
      dataIndex: 'definition',
      key: 'definition',
      width: 100,
      render: (v?: string) => (v ? getDefinitionLabel(v) : '—'),
      ellipsis: true,
    },
    {
      title: t('content.col.encryption'),
      dataIndex: 'encryption',
      key: 'encryption',
      width: 100,
      render: (v: boolean) => <Switch checked={v} disabled size="small" />,
      ellipsis: true,
    },
    {
      title: t('content.col.publishFlag'),
      dataIndex: 'publish_flag',
      key: 'publish_flag',
      width: 110,
      render: (v: boolean) => <Switch checked={v} disabled size="small" />,
      ellipsis: true,
    },
    {
      title: t('content.col.deeplink'),
      dataIndex: 'deeplink',
      key: 'deeplink',
      width: 200,
      ellipsis: true,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('content.col.action'),
      key: 'action',
      fixed: 'right' as const,
      width: 80,
      render: (_: unknown, record: MovieItem) => {
        return readOnly
          ? (
            <Tooltip title={t('common.delete')}>
              <Button type="link" size="small" icon={<DeleteOutlined />} disabled />
            </Tooltip>
          )
          : (
            <Popconfirm
              title={t('content.materials.confirmDelete')}
              onConfirm={() => void handleDelete(record.id)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Tooltip title={t('common.delete')}>
                <Button type="link" danger size="small" icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )
      },
    },
  ]

  // ── Material History 列定义 ───────────────────────────────

  const historyColumns: ColumnsType<MovieHistoryItem> = [
    {
      title: t('content.materials.fileName'),
      dataIndex: 'file_name',
      key: 'file_name',
      width: 200,
      ellipsis: true,
      render: (v: string) => v?.split('/').pop() ?? v,
    },
    {
      title: t('content.col.type'),
      dataIndex: 'movie_type',
      key: 'movie_type',
      width: 110,
      render: (v: number) => getMovieTypeLabel(v),
    },
    {
      title: t('content.materials.col.fileSize'),
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      render: (v: number) => formatFileSize(v),
    },
    {
      title: t('content.materials.col.processedAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v?: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—'),
    },
    {
      title: t('content.materials.col.processedBy'),
      dataIndex: 'processed_by',
      key: 'processed_by',
      width: 140,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('content.materials.col.processedType'),
      dataIndex: 'processed_type',
      key: 'processed_type',
      width: 120,
    },
  ]

  // ── Tab 内容 ──────────────────────────────────────────────

  const tabItems = [
    {
      key: 'add',
      label: t('content.materials.tab.add'),
      children: (
        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
          onFinish={(values) => void handleSubmit(values)}
          initialValues={{
            movie_type: fixedType,
            closed_captioning: true,
            encryption: true,
            publish_flag: true,
          }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="movie_type"
                label={t('content.materials.type')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <Select showSearch disabled={fixedType !== undefined} placeholder={t('common.placeholder.select')} filterOption={(input, option) => String(option?.label ?? option?.children ?? '').toLowerCase().includes(input.toLowerCase())}>
                  <Select.Option value={1} disabled={disableMovieType}>
                    {t('content.materials.typeMovie')}
                  </Select.Option>
                  <Select.Option value={2}>{t('content.materials.typeTrailer')}</Select.Option>
                  <Select.Option value={3}>{t('content.materials.typeSubtitle')}</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="audio_type" label={t('content.materials.audioType')}>
                <Select showSearch optionFilterProp="children" allowClear placeholder={t('common.placeholder.select')}>
                  {(dictOptions.AudioType ?? []).map((opt) => (
                    <Select.Option key={opt.code} value={opt.code}>
                      {opt.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="screen_format" label={t('content.materials.screenFormat')}>
                <Select showSearch optionFilterProp="children" allowClear placeholder={t('common.placeholder.select')}>
                  {(dictOptions.ScreenFormat ?? []).map((opt) => (
                    <Select.Option key={opt.code} value={opt.code}>
                      {opt.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="closed_captioning"
                label={t('content.materials.closedCaptioning')}
                valuePropName="checked"
              >
                <Switch checkedChildren={t('common.yes')} unCheckedChildren={t('common.no')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="duration"
                label={t('content.materials.duration')}
                rules={isSubtitle ? [] : [{ required: true, message: t('common.required') }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} max={5999} placeholder={t('common.placeholder.enter')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="definition"
                label={t('content.materials.definition')}
                rules={isSubtitle ? [] : [{ required: true, message: t('common.required') }]}
              >
                <Select showSearch placeholder={t('common.placeholder.select')} filterOption={(input, option) => String(option?.label ?? option?.children ?? '').toLowerCase().includes(input.toLowerCase())}>
                  {(dictOptions.Definition ?? []).map((opt) => (
                    <Select.Option key={opt.code} value={opt.code}>
                      {opt.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="encryption"
                label={t('content.materials.encryption')}
                valuePropName="checked"
              >
                <Switch checkedChildren={t('common.yes')} unCheckedChildren={t('common.no')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="publish_flag"
                label={t('content.materials.publishFlag')}
                valuePropName="checked"
              >
                <Switch
                  checkedChildren={t('common.yes')}
                  unCheckedChildren={t('common.no')}
                  disabled={isTrailer}
                  onChange={(checked: boolean) => {
                    setPublishFlag(checked)
                    if (checked) {
                      // YES → 上传文件模式，清除 deeplink
                      form.setFieldsValue({ deeplink: undefined })
                    } else {
                      // NO → Deeplink 模式，清除文件相关字段
                      setFileSource('local')
                      setUploadFileList([])
                      form.setFieldsValue({
                        file_path: undefined,
                      })
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="mediaservice" label={t('content.materials.mediaservice')} rules={[{ required: true, message: t('common.required') }]}>
                <Select showSearch allowClear placeholder={t('common.placeholder.select')} filterOption={(input, option) => String(option?.label ?? option?.children ?? '').toLowerCase().includes(input.toLowerCase())}>
                  {(dictOptions.mediaservice ?? []).map((opt) => (
                    <Select.Option key={opt.code} value={opt.code}>
                      {opt.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* Trailer-specific: Sequence + Multi-language names */}
          {isTrailer && (
            <>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="sequence" label={t('content.materials.sequence')}>
                    <InputNumber style={{ width: '100%' }} min={1} max={9999} placeholder="1-9999" />
                  </Form.Item>
                </Col>
                {languageOptions.slice(0, 2).map((lang) => (
                  <Col key={lang.code} span={8}>
                    <Form.Item
                      name={`name_${lang.code}`}
                      label={t('content.materials.nameLabel', { lang: lang.code })}
                      rules={[{ required: true, message: t('common.required') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
                    >
                      <TrimInput placeholder={t('content.materials.namePlaceholder', { lang: lang.code })} />
                    </Form.Item>
                  </Col>
                ))}
              </Row>
              {languageOptions.length > 2 && (
                <Row gutter={16}>
                  {languageOptions.slice(2).map((lang) => (
                    <Col key={lang.code} span={8}>
                      <Form.Item
                        name={`name_${lang.code}`}
                        label={t('content.materials.nameLabel', { lang: lang.code })}
                        rules={[{ required: true, message: t('common.required') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
                      >
                        <TrimInput placeholder={t('content.materials.namePlaceholder', { lang: lang.code })} />
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
              )}
            </>
          )}

          {customFields.length > 0 && (
            <Row gutter={16}>
              {customFields.map((cf) => {
                const fieldName = `cf_${cf.id}`
                return (
                  <Col span={8} key={cf.id}>
                    <Form.Item name={fieldName} label={cf.field_name}
                      rules={getCustomFieldRules(cf, t('customField.validation.integerOnly'), t)}
                    >
                      <CustomFieldControl
                        fieldType={cf.field_type}
                        options={cf.options.map((o) => ({ value: o.code, label: getOptionLabel(o.names, languageOptions[0]?.code ?? '', languageOptions.map((l) => l.code)) || o.code }))}
                        placeholder={getCustomFieldPlaceholder(cf, t)}
                      />
                    </Form.Item>
                  </Col>
                )
              })}
            </Row>
          )}

          {/* PublishFlag=0(NO)时显示 Deeplink */}
          {!publishFlag && (
            <Form.Item
              name="deeplink"
              label={t('content.materials.deeplink')}
              rules={[{ required: true, message: t('common.required') }, formRules.maxLength(FORM_MAX_LENGTH.DEEPLINK)]}
            >
              <TrimInput.TextArea
                rows={4}
                placeholder={deeplinkHint}
              />
            </Form.Item>
          )}

          {/* PublishFlag=1(YES)时显示文件上传 */}
          {publishFlag && (
            <>
              <Form.Item label={t('content.materials.fileSource')} required>
                <Radio.Group
                  value={fileSource}
                  onChange={(e) => setFileSource(e.target.value)}
                >
                  <Radio value="local">{t('content.materials.sourceLocal')}</Radio>
                  <Radio value="temp">{t('content.materials.sourceTemp')}</Radio>
                  <Radio value="external">{t('content.materials.sourceExternal')}</Radio>
                </Radio.Group>
              </Form.Item>

              {fileSource === 'local' && (
                <Form.Item label={t('content.materials.selectFile')} required>
                  <Upload
                    fileList={uploadFileList}
                    onChange={({ fileList }) => setUploadFileList(fileList.slice(-1))}
                    beforeUpload={() => false}
                    maxCount={1}
                  >
                    <Button icon={<UploadOutlined />}>{t('content.materials.selectFile')}</Button>
                  </Upload>
                </Form.Item>
              )}

              {fileSource === 'external' && (
                <>
                  <Form.Item
                    name="file_path"
                    label={t('content.materials.downloadLink')}
                    rules={[{ required: true, message: t('common.required') }, formRules.maxLength(FORM_MAX_LENGTH.DOWNLOAD_LINK)]}
                  >
                    <TrimInput placeholder="sftp://user:password@host:port/path/to/file" />
                  </Form.Item>
                </>
              )}

              {fileSource === 'temp' && (
                <Form.Item
                    name="file_path"
                    label={t('content.materials.downloadLink')}
                    rules={[{ required: true, message: t('common.required') }, formRules.maxLength(FORM_MAX_LENGTH.DOWNLOAD_LINK)]}
                  >
                  <TrimInput placeholder={t('content.materials.tempFilePathPlaceholder')} />
                </Form.Item>
              )}

            </>
          )}

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Button style={{ marginRight: 8 }} htmlType="button" onClick={onClose}>
              {t('content.materials.cancel')}
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {t('content.materials.submit')}
            </Button>
          </div>
        </Form>
      )
    },
    {
      key: 'files',
      label: t('content.materials.tab.files'),
      children: (
        <ResizableTable<MovieItem>
          rowKey="id"
          loading={moviesLoading}
          columns={fileColumns}
          dataSource={movies}
          size="small"
          scroll={{ x: 1450 }}
          pagination={{
            defaultPageSize: 10,
            placement: ['bottomCenter'],
            showTotal: (n) => t('pagination.total', { n }),
            showSizeChanger: true,
            pageSizeOptions: PAGINATION_CONFIG.pageSizeOptions.map(String),
          }}
          locale={{ emptyText: t('content.materials.noFiles') }}
        />
      ),
    },
    {
      key: 'history',
      label: t('content.materials.tab.history'),
      children: (
        <ResizableTable<MovieHistoryItem>
          rowKey="id"
          loading={historyLoading}
          columns={historyColumns}
          dataSource={histories}
          size="small"
          scroll={{ x: 1000 }}
          pagination={{
            defaultPageSize: 10,
            placement: ['bottomCenter'],
            showTotal: (n) => t('pagination.total', { n }),
            showSizeChanger: true,
            pageSizeOptions: PAGINATION_CONFIG.pageSizeOptions.map(String),
          }}
          locale={{ emptyText: t('content.materials.noHistory') }}
        />
      ),
    },
  ].filter((item) => !readOnly || item.key !== 'add')

  return (
    <Modal
      open={open}
      title={contentName ? `${t('content.materials.title')} — ${contentName}` : t('content.materials.title')}
      onCancel={onClose}
      footer={null}
      width={960}
      destroyOnHidden
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </Modal>
  )
}
