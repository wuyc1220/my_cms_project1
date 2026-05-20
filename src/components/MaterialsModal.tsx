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
  Table,
  Tabs,
  Upload,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload'
import TrimInput from './TrimInput'
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

import { uploadAttachment } from '../api/attachments'
import { createMovie, deleteMovie, getMoviesByContentId, getMovieHistoryByContentId, saveMovieI18n, saveMovieFieldValues } from '../api/movies'
import { getMultiLanguageOptions } from '../api/i18n'
import { getDictChildren } from '../api/dicts'
import { getPublicConfig } from '../api/configs'
import { getCustomFields } from '../api/customFields'
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

  // ── 加载数据 ──────────────────────────────────────────────

  const loadMovies = useCallback(async () => {
    setMoviesLoading(true)
    try {
      const resp = await getMoviesByContentId(contentId)
      setMovies(resp.items)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('content.materials.loadError'), 5)
    } finally {
      setMoviesLoading(false)
    }
  }, [contentId, t])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const resp = await getMovieHistoryByContentId(contentId)
      setHistories(resp.items)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('content.materials.loadError'), 5)
    } finally {
      setHistoryLoading(false)
    }
  }, [contentId, t])

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
          getDictChildren('mediaservice'),
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
        setDeeplinkHint(hint ?? 'Please enter deeplink URL')
      } catch (e) {
        setDeeplinkHint('Please enter deeplink URL')
      }
    })()
  }, [open])

  // ── 提交表单（Ant Design onFinish 模式，values 已通过表单校验） ──

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (readOnly) return

    // 归档内容不允许注入 Movie（正片）材料
    if (disableMovieType && Number(values.movie_type) === 1) {
      void message.error(t('content.materials.movieTypeDisabledForArchive'), 5)
      return
    }

    // 文件非表单字段，单独校验
    if (!publishFlag && fileSource === 'local' && uploadFileList.length === 0) {
      void message.error('Please select a file', 5)
      return
    }

    // 获取文件对象（兼容不同版本的 Ant Design）
    const uploadFile = uploadFileList[0]
    const file = (uploadFile?.originFileObj || uploadFile) as File | undefined
    if (!publishFlag && fileSource === 'local' && !file) {
      void message.error('Please select a file', 5)
      return
    }

    setSubmitting(true)
    try {
      let fileName: string
      let filePath: string
      let fileSize: number

      if (!publishFlag && fileSource === 'local') {
        const uploadResult = await uploadAttachment(file!, 'materials')
        fileName = uploadResult.file_name
        filePath = uploadResult.file_path
        fileSize = uploadResult.file_size
      } else {
        filePath = (values.file_path as string) ?? '/uploads/materials'
        fileName = filePath.split('/').pop() ?? 'unknown'
        fileSize = file?.size ?? 0
      }

      const payload: Omit<MovieItem, 'id' | 'content_id' | 'created_at'> = {
        file_name: fileName,
        file_path: filePath,
        file_size: String(fileSize),
        movie_type: String(values.movie_type as number),
        sequence: (values.sequence as number) ?? null,
        audio_type: (values.audio_type as string) ?? null,
        screen_format: (values.screen_format as string) ?? null,
        closed_captioning: (values.closed_captioning as boolean) ?? true,
        duration: String((values.duration as number) ?? 0),
        definition: (values.definition as string) ?? 'SD',
        mediaservice: (values.mediaservice as string) ?? null,
        encryption: (values.encryption as boolean) ?? true,
        publish_flag: (values.publish_flag as boolean) ?? true,
        deeplink: (values.deeplink as string) ?? null,
      }

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
            value: String(values[`cf_${cf.id}`] ?? ''),
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
      void message.error('Failed to add material', 5)
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
      void message.error('Failed to delete material', 5)
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
      ellipsis: true,
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
      title: t('content.col.audioType'),
      dataIndex: 'audio_type',
      key: 'audio_type',
      width: 110,
      render: (v?: string) => (v ? getDictName(dictOptions.AudioType ?? [], v) : '—'),
    },
    {
      title: t('content.col.screenFormat'),
      dataIndex: 'screen_format',
      key: 'screen_format',
      width: 120,
      render: (v?: string) => (v ? getDictName(dictOptions.ScreenFormat ?? [], v) : '—'),
    },
    {
      title: t('content.col.closedCaptioning'),
      dataIndex: 'closed_captioning',
      key: 'closed_captioning',
      width: 130,
      render: (v: boolean) => <Switch checked={v} disabled size="small" />,
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
      render: (v: string) => getDefinitionLabel(v),
    },
    {
      title: t('content.col.encryption'),
      dataIndex: 'encryption',
      key: 'encryption',
      width: 100,
      render: (v: boolean) => <Switch checked={v} disabled size="small" />,
    },
    {
      title: t('content.col.publishFlag'),
      dataIndex: 'publish_flag',
      key: 'publish_flag',
      width: 110,
      render: (v: boolean) => <Switch checked={v} disabled size="small" />,
    },
    {
      title: t('content.col.deeplink'),
      dataIndex: 'deeplink',
      key: 'deeplink',
      ellipsis: true,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('content.col.action'),
      key: 'action',
      fixed: 'right' as const,
      width: 80,
      render: (_: unknown, record: MovieItem) => {
        if (readOnly) {
          return <Button type="link" size="small" icon={<DeleteOutlined />} disabled />
        }
        return (
          <Popconfirm
            title={t('content.materials.confirmDelete')}
            onConfirm={() => void handleDelete(record.id)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />} />
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
      ellipsis: true,
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
                rules={[{ required: true, message: 'Required' }]}
              >
                <Select showSearch disabled={fixedType !== undefined} placeholder="Please select" filterOption={(input, option) => String(option?.label ?? option?.children ?? '').toLowerCase().includes(input.toLowerCase())}>
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
                <Select showSearch optionFilterProp="label" allowClear placeholder="Please select">
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
                <Select showSearch optionFilterProp="label" allowClear placeholder="Please select">
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
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="duration"
                label={t('content.materials.duration')}
                rules={[{ required: true, message: 'Required' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} max={5999} placeholder="Please enter" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="definition"
                label={t('content.materials.definition')}
                rules={[{ required: true, message: 'Required' }]}
              >
                <Select showSearch optionFilterProp="label" placeholder="Please select">
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
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="publish_flag"
                label={t('content.materials.publishFlag')}
                valuePropName="checked"
              >
                <Switch
                  checkedChildren="Yes"
                  unCheckedChildren="No"
                  onChange={(checked: boolean) => {
                    setPublishFlag(checked)
                    if (checked) {
                      setFileSource('local')
                      setUploadFileList([])
                      form.setFieldsValue({
                        file_path: undefined,
                        ftp_account: undefined,
                        ftp_password: undefined,
                      })
                    } else {
                      form.setFieldsValue({ deeplink: undefined })
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="mediaservice" label="Mediaservice" rules={[{ required: true, message: 'Required' }]}>
                <Select showSearch optionFilterProp="label" allowClear placeholder="Please select">
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
                  <Form.Item name="sequence" label="Sequence">
                    <InputNumber style={{ width: '100%' }} min={1} max={9999} placeholder="1-9999" />
                  </Form.Item>
                </Col>
                {languageOptions.slice(0, 2).map((lang) => (
                  <Col key={lang.code} span={8}>
                    <Form.Item
                      name={`name_${lang.code}`}
                      label={`Name (${lang.code})`}
                      rules={[{ required: true, message: 'Required' }]}
                    >
                      <TrimInput placeholder={`Name_${lang.code}`} />
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
                        label={`Name (${lang.code})`}
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <TrimInput placeholder={`Name_${lang.code}`} />
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
              )}
            </>
          )}

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <Row gutter={16}>
              {customFields.map((cf) => {
                const fieldName = `cf_${cf.id}`
                const fieldLabel = cf.field_name
                const rules = cf.mandatory ? [{ required: true, message: 'Required' }] : undefined
                return (
                  <Col span={8} key={cf.id}>
                    <Form.Item name={fieldName} label={fieldLabel} rules={rules}>
                      {cf.field_type === 'DropList' && cf.options.length > 0 ? (
                        <Select showSearch optionFilterProp="label" allowClear placeholder="Please select">
                          {cf.options.map((opt) => (
                            <Select.Option key={opt.code} value={opt.code}>
                              {opt.names?.en ?? opt.code}
                            </Select.Option>
                          ))}
                        </Select>
                      ) : (
                        <TrimInput placeholder={`Enter ${cf.field_name}`} />
                      )}
                    </Form.Item>
                  </Col>
                )
              })}
            </Row>
          )}

          {/* 发布标识开启时显示必填 Deeplink */}
          {publishFlag && (
            <Form.Item
              name="deeplink"
              label={t('content.materials.deeplink')}
              rules={[{ required: true, message: 'Required' }]}
            >
              <TrimInput.TextArea
                rows={4}
                placeholder={deeplinkHint}
              />
            </Form.Item>
          )}

          {/* 发布标识关闭时显示文件来源 */}
          {!publishFlag && (
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
                    rules={[{ required: true, message: 'Required' }]}
                  >
                    <TrimInput placeholder="Please enter download link" />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="ftp_account"
                        label={t('content.materials.ftpAccount')}
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <TrimInput placeholder="Please enter" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="ftp_password"
                        label={t('content.materials.ftpPassword')}
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <TrimInput.Password placeholder="Please enter" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )}

              {fileSource === 'temp' && (
                <Form.Item
                  name="file_path"
                  label={t('content.materials.selectFile')}
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <TrimInput placeholder="Please enter temporary file path" />
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
      ),
    },
    {
      key: 'files',
      label: t('content.materials.tab.files'),
      children: (
        <Table<MovieItem>
          rowKey="id"
          loading={moviesLoading}
          columns={fileColumns}
          dataSource={movies}
          size="small"
          scroll={{ x: 1300 }}
          pagination={{ pageSize: 10, position: ['bottomCenter'] }}
          locale={{ emptyText: t('content.materials.noFiles') }}
        />
      ),
    },
    {
      key: 'history',
      label: t('content.materials.tab.history'),
      children: (
        <Table<MovieHistoryItem>
          rowKey="id"
          loading={historyLoading}
          columns={historyColumns}
          dataSource={histories}
          size="small"
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 10, position: ['bottomCenter'] }}
          locale={{ emptyText: t('content.materials.noHistory') }}
        />
      ),
    },
  ]

  return (
    <Modal
      open={open}
      title={contentName ? `${t('content.materials.title')} — ${contentName}` : t('content.materials.title')}
      onCancel={onClose}
      footer={null}
      width={960}
      destroyOnClose
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </Modal>
  )
}
