import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Col,
  Empty,
  Form,
  Popconfirm,
  Row,
  Spin,
  Table,
  Tabs,
  Tooltip,
  message,
} from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import TrimInput from '../../components/TrimInput'
import {
  getCategory,
  getCategoryContents,
  getCategoryFieldValues,
  getCategoryI18n,
  removeCategoryContent,
} from '../../api/categories'
import { getCustomFields } from '../../api/customFields'
import { getDictTree } from '../../api/dicts'
import { getMultiLanguageOptions } from '../../api/i18n'
import type { CategoryListItem, CustomFieldListItem, EntityFieldValueItem, EntityI18nItem } from '../../types/basic'
import type { DictNodeListItem } from '../../types/dict'
import type { LanguageOption } from '../../types/i18n'
import { useI18n } from '../../i18n/useI18n'
import SectionTitle from '../../components/SectionTitle'
import { usePermission } from '../../hooks/usePermission'

interface ContentRow {
  key: number
  id: number
  sequence: number
  content_name: string
  content_type: string
  genre: string
  status: string
}

// 根据自定义字段信息，将 code 值转换为显示 label
function resolveFieldDisplayValue(field: CustomFieldListItem, rawValue: string, preferredLanguage?: string): string {
  if (!rawValue) return ''
  const isSelect = field.field_type === 'DropList' || field.field_type === 'DropList_multiple'
  if (!isSelect) return rawValue
  const codes = rawValue.split(',').filter(Boolean)
  const labels = codes.map((code) => {
    const opt = field.options.find((o) => o.code === code)
    if (!opt) return code
    return opt.names[preferredLanguage ?? ''] ?? opt.names.default ?? Object.values(opt.names)[0] ?? code
  })
  return labels.join(', ')
}

export default function CategoryDetail() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<CategoryListItem | null>(null)
  const [parentName, setParentName] = useState<string | null>(null)
  const [platformMap, setPlatformMap] = useState<Record<string, string>>({})
  const [categoryTypeMap, setCategoryTypeMap] = useState<Record<string, string>>({})
  const [customFields, setCustomFields] = useState<CustomFieldListItem[]>([])
  const [fieldValues, setFieldValues] = useState<Record<number, string>>({})
  const [i18nValues, setI18nValues] = useState<EntityI18nItem[]>([])
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([])
  const [contentRows, setContentRows] = useState<ContentRow[]>([])
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.basic.categories.operate')

  useEffect(() => {
    if (!id) {
      void message.error(t('category.detail.msgInvalidId'), 5)
      navigate('/basic/categories', { replace: true })
      return
    }

    void (async () => {
      setLoading(true)
      try {
        const categoryId = Number(id)
        const [detail, savedFields, savedI18n, fields, dicts, contents, langs] = await Promise.all([
          getCategory(categoryId),
          getCategoryFieldValues(categoryId),
          getCategoryI18n(categoryId),
          getCustomFields({ page: 1, page_size: 200, belongings: ['ALL', 'Category'] }),
          getDictTree(),
          getCategoryContents(categoryId),
          getMultiLanguageOptions(),
        ])

        setCategory(detail)
        const filteredFields = fields.items.filter(
          (item) => item.belongings.includes('ALL') || item.belongings.includes('Category'),
        )
        setCustomFields(filteredFields)
        setI18nValues(savedI18n)
        setLanguageOptions(langs)
        setContentRows(
          contents.map((c, index) => ({
            key: c.id,
            id: c.id,
            sequence: index + 1,
            content_name: c.content_name,
            content_type: c.content_type,
            genre: c.genre,
            status: c.status,
          })),
        )

        const nextFieldValues: Record<number, string> = {}
        savedFields.forEach((item: EntityFieldValueItem) => {
          nextFieldValues[item.custom_field_id] = item.value ?? ''
        })
        setFieldValues(nextFieldValues)

        const platformRoot = dicts.find((item) => item.code === 'Platform')
        const typeRoot = dicts.find((item) => item.code === 'Category_Type')
        const toMap = (nodes?: DictNodeListItem[]) =>
          Object.fromEntries((nodes ?? []).map((item) => [item.code, item.name]))
        setPlatformMap(toMap(platformRoot?.children))
        setCategoryTypeMap(toMap(typeRoot?.children))

        // 加载父级栏目名称
        if (detail.parent_id) {
          try {
            const parent = await getCategory(detail.parent_id)
            setParentName(parent.name)
          } catch (err) {
            setParentName(String(detail.parent_id))
          }
        }
      } catch (err) {
      } finally {
        setLoading(false)
      }
    })()
  }, [id, navigate])

  const handleRemoveContent = async (contentId: number) => {
    if (!id) return
    try {
      await removeCategoryContent(Number(id), contentId)
      setContentRows((prev) =>
        prev.filter((r) => r.id !== contentId).map((r, idx) => ({ ...r, sequence: idx + 1 })),
      )
      void message.success(t('common.msg.removed'), 3)
    } catch (err) {
    }
  }

  // 过滤掉第一个语言类型（English），只展示从第二个开始的语言
  const filteredLanguageOptions = useMemo(() => {
    return languageOptions.slice(1)
  }, [languageOptions])

  // 获取第一个语言（defaultLang）的 code
  const defaultLangCode = useMemo(() => languageOptions[0]?.code ?? '', [languageOptions])

  // language_code → language_name 映射
  const langCodeToName = useMemo(() => {
    const map: Record<string, string> = {}
    filteredLanguageOptions.forEach((o) => {
      map[o.code] = o.name
    })
    return map
  }, [filteredLanguageOptions])

  // 获取所有支持多语言的字段
  const multiLanguageFields = useMemo(() => {
    return customFields.filter((f) => f.multi_language)
  }, [customFields])

  // Multi Languages 按语言分组，建立 language_code -> field_code -> value 的映射
  const i18nValueMap = useMemo(() => {
    const map: Record<string, Record<string, string>> = {}
    i18nValues.forEach((item) => {
      if (!map[item.language]) map[item.language] = {}
      map[item.language][item.field_name] = item.value ?? ''
    })
    return map
  }, [i18nValues])

  // Custom Fields 展示行（多语言字段显示 defaultLang 下的值）
  const customFieldRows = useMemo(() => {
    return customFields.map((field) => {
      let rawValue: string
      if (field.multi_language) {
        // 多语言字段从 i18nValueMap 中获取 defaultLang 下的值
        rawValue = i18nValueMap[defaultLangCode]?.[field.field_code] ?? ''
      } else {
        // 普通字段从 fieldValues 中获取
        rawValue = fieldValues[field.id] ?? ''
      }
      return {
        key: field.id,
        field_name: field.field_name,
        value: resolveFieldDisplayValue(field, rawValue),
      }
    })
  }, [customFields, fieldValues, i18nValueMap, defaultLangCode])

  const contentColumns: ColumnsType<ContentRow> = [
    { title: t('category.detail.contentSequence'), dataIndex: 'sequence', key: 'sequence', width: 90 },
    {
      title: t('category.detail.contentName'),
      dataIndex: 'content_name',
      key: 'content_name',
      render: (name: string, record) => {
        const getDetailPath = () => {
          if (record.content_type === 'CHANNEL') return `/live/channels/${record.id}`
          if (record.content_type === 'SCHEDULE') return `/live/schedules/${record.id}`
          return `/contents/${record.id}`
        }
        return (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(getDetailPath())}>
            {name}
          </Button>
        )
      },
    },
    { title: t('category.detail.contentType'), dataIndex: 'content_type', key: 'content_type', width: 140 },
    { title: t('category.detail.genre'), dataIndex: 'genre', key: 'genre', width: 140 },
    { title: t('category.detail.contentStatus'), dataIndex: 'status', key: 'status', width: 120 },
    {
      title: t('common.action'),
      key: 'action',
      width: 90,
      render: (_, record) =>
        canOperate ? (
          <Popconfirm
            title={t('category.detail.confirmRemoveContent')}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            onConfirm={() => void handleRemoveContent(record.id)}
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        ) : null,
    },
  ]

  if (loading) {
    return (
      <div className="main-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!category) {
    return (
      <div className="main-container">
        <Empty description={t('category.detail.emptyCategory')} />
      </div>
    )
  }

  return (
    <div className="main-container">
      {/* Basic Info */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('common.basicInfo')} />
        <div style={{ paddingLeft: 20 }}>
          <Form layout="vertical">
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item label={t('category.col.categoryId')}>
                  <TrimInput value={String(category.id)} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('category.col.platform')}>
                  <TrimInput value={platformMap[category.platform] ?? category.platform} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('category.detail.parentCategory')}>
                  <TrimInput
                    value={category.parent_id ? (parentName ?? String(category.parent_id)) : '—'}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('category.col.categoryName')}>
                  <TrimInput value={category.name} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('category.detail.sequence')}>
                  <TrimInput value={String(category.sequence)} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('category.col.categoryType')}>
                  <TrimInput
                    value={
                      category.category_type
                        ? (categoryTypeMap[category.category_type] ?? category.category_type)
                        : '—'
                    }
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('category.detail.maxVodCount')}>
                  <TrimInput value={String(category.vod_count)} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('category.detail.jumpCategoryCode')}>
                  <TrimInput value={category.jump_category_code || '—'} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('category.detail.status')}>
                  <TrimInput
                    value={category.status === 1 ? t('category.detail.valid') : t('category.detail.invalid')}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('category.detail.ingestStatus')}>
                  <TrimInput
                    value={(() => {
                      const s = category.ingest_status
                      if (!s || s === 'None') return '—'
                      return s
                    })()}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label={t('category.detail.description')}>
                  <TrimInput.TextArea
                    value={category.description || '—'}
                    disabled
                    style={{ background: '#f5f5f5' }}
                    autoSize={{ minRows: 2, maxRows: 4 }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      </div>

      {/* Custom Fields */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('category.detail.tabCustomFields')} />
        <div style={{ paddingLeft: 20 }}>
          {customFieldRows.length === 0 ? (
            <Empty description={t('category.detail.noCustomFields')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Form layout="vertical">
              <Row gutter={24}>
                {customFieldRows.map((row) => (
                  <Col span={8} key={row.key}>
                    <Form.Item label={row.field_name}>
                      <Tooltip title={row.value || '—'}>
                        <TrimInput value={row.value || '—'} disabled style={{ background: '#f5f5f5' }} />
                      </Tooltip>
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            </Form>
          )}
        </div>
      </div>

      {/* Multi Languages */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('category.detail.tabMultiLanguages')} />
        <div style={{ paddingLeft: 20 }}>
          {filteredLanguageOptions.length === 0 ? (
            <Empty description={t('category.detail.noMultiLanguages')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Tabs
              items={filteredLanguageOptions.map((lang) => ({
                key: lang.code,
                label: langCodeToName[lang.code] ?? lang.name ?? lang.code,
                children: (
                  <Form layout="vertical">
                    <Row gutter={24}>
                      <Col span={8}>
                        <Form.Item label={t('category.col.categoryName')}>
                          <TrimInput
                            value={i18nValueMap[lang.code]?.name ?? '—'}
                            disabled
                            style={{ background: '#f5f5f5' }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label={t('category.detail.description')}>
                          <Tooltip title={i18nValueMap[lang.code]?.description ?? '—'}>
                            <TrimInput
                              value={i18nValueMap[lang.code]?.description ?? '—'}
                              disabled
                              style={{ background: '#f5f5f5' }}
                            />
                          </Tooltip>
                        </Form.Item>
                      </Col>
                      {multiLanguageFields.map((field) => {
                        const rawValue = i18nValueMap[lang.code]?.[field.field_code] ?? ''
                        const displayValue = rawValue
                          ? resolveFieldDisplayValue(field, rawValue, lang.code)
                          : '—'
                        return (
                          <Col span={8} key={field.field_code}>
                            <Form.Item label={field.field_name}>
                              <Tooltip title={displayValue}>
                                <TrimInput value={displayValue} disabled style={{ background: '#f5f5f5' }} />
                              </Tooltip>
                            </Form.Item>
                          </Col>
                        )
                      })}
                    </Row>
                  </Form>
                ),
              }))}
            />
          )}
        </div>
      </div>

      {/* Contents */}
      <div>
        <SectionTitle title={t('category.detail.tabContents')} />
        <div style={{ paddingLeft: 20 }}>
          <Table<ContentRow>
            rowKey="key"
            columns={contentColumns}
            dataSource={contentRows}
            pagination={false}
            size="small"
            locale={{ emptyText: t('category.detail.noContents') }}
          />
        </div>
      </div>
    </div>
  )
}
