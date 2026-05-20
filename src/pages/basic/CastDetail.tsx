import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Col,
  Empty,
  Form,
  Row,
  Spin,
  Tabs,
  message,
} from 'antd'
import { PictureOutlined } from '@ant-design/icons'
import SectionTitle from '../../components/SectionTitle'
import TrimInput from '../../components/TrimInput'
import { getCast, getCastFieldValues, getCastI18n } from '../../api/casts'
import { getCustomFields } from '../../api/customFields'
import { getMultiLanguageOptions } from '../../api/i18n'
import PostersModal from '../../components/PostersModal'
import type { CastListItem, CustomFieldListItem, EntityFieldValueItem, EntityI18nItem } from '../../types/basic'
import type { LanguageOption } from '../../types/i18n'
import { useI18n } from '../../i18n/useI18n'

function resolveFieldDisplayValue(field: CustomFieldListItem, rawValue: string, preferredLanguage?: string): string {
  if (!rawValue) return ''
  const isSelect = field.field_type === 'DropList' || field.field_type === 'DropList_multiple'
  if (!isSelect) return rawValue
  const codes = rawValue.split(',').filter(Boolean)
  return codes
    .map((code) => {
      const opt = field.options.find((o) => o.code === code)
      if (!opt) return code
      return opt.names[preferredLanguage ?? ''] ?? opt.names.default ?? Object.values(opt.names)[0] ?? code
    })
    .join(', ')
}

export default function CastDetail() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [cast, setCast] = useState<CastListItem | null>(null)
  const [customFields, setCustomFields] = useState<CustomFieldListItem[]>([])
  const [fieldValues, setFieldValues] = useState<Record<number, string>>({})
  const [i18nValues, setI18nValues] = useState<EntityI18nItem[]>([])
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([])
  const [postersOpen, setPostersOpen] = useState(false)

  useEffect(() => {
    if (!id) {
      void message.error(t('cast.detail.msgInvalidId'), 5)
      navigate('/basic/casts', { replace: true })
      return
    }

    void (async () => {
      setLoading(true)
      try {
        const castId = Number(id)
        const [detail, savedFields, savedI18n, fields, langs] = await Promise.all([
          getCast(castId),
          getCastFieldValues(castId),
          getCastI18n(castId),
          getCustomFields({ page: 1, page_size: 200, belongings: ['ALL', 'Cast'] }),
          getMultiLanguageOptions(),
        ])

        setCast(detail)
        const filteredFields = fields.items.filter(
          (item) => item.belongings.includes('ALL') || item.belongings.includes('Cast'),
        )
        setCustomFields(filteredFields)
        setI18nValues(savedI18n)
        setLanguageOptions(langs)

        const nextFieldValues: Record<number, string> = {}
        savedFields.forEach((item: EntityFieldValueItem) => {
          nextFieldValues[item.custom_field_id] = item.value ?? ''
        })
        setFieldValues(nextFieldValues)

      } catch (err) {
      } finally {
        setLoading(false)
      }
    })()
  }, [id, navigate])

  // 过滤掉第一个语言类型（English），只展示从第二个开始的语言
  const filteredLanguageOptions = useMemo(() => {
    return languageOptions.slice(1)
  }, [languageOptions])

  // 获取第一个语言（defaultLang）的 code
  const defaultLangCode = useMemo(() => languageOptions[0]?.code ?? '', [languageOptions])

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

  if (loading) {
    return (
      <div className="main-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!cast) {
    return (
      <div className="main-container">
        <Empty description={t('cast.detail.emptyDetail')} />
      </div>
    )
  }

  return (
    <div className="main-container">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={<PictureOutlined />} onClick={() => setPostersOpen(true)}>
          {t('cast.detail.posters')}
        </Button>
      </div>

      {/* 基本信息 */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('common.basicInfo')} />
        <div style={{ paddingLeft: 20 }}>
          <Form layout="vertical">
            <Row gutter={24}>
              <Col span={6}>
                <Form.Item label={t('cast.detail.castId')}>
                  <TrimInput value={String(cast.id)} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label={t('cast.detail.castName')}>
                  <TrimInput value={cast.name} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label={t('cast.detail.ingestStatus')}>
                  <TrimInput
                    disabled
                    style={{ background: '#f5f5f5' }}
                    value={cast.ingest_status && cast.ingest_status !== 'None' ? cast.ingest_status : '—'}
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label={t('cast.detail.status')}>
                  <TrimInput
                    disabled
                    style={{ background: '#f5f5f5' }}
                    value={cast.status === 1 ? 'Active' : 'Inactive'}
                  />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label={t('cast.detail.description')}>
                  <TrimInput value={cast.description || '—'} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      </div>

      {/* 自定义字段 */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('cast.detail.customFields')} />
        <div style={{ paddingLeft: 20 }}>
          {customFieldRows.length === 0 ? (
            <Empty description={t('cast.detail.noCustomFields')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Form layout="vertical">
              <Row gutter={24}>
                {customFieldRows.map((row) => (
                  <Col span={6} key={row.key}>
                    <Form.Item label={row.field_name}>
                      <TrimInput value={row.value || '—'} disabled style={{ background: '#f5f5f5' }} />
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            </Form>
          )}
        </div>
      </div>

      {/* 多语言 */}
      <div>
        <SectionTitle title={t('cast.detail.multiLanguages')} />
        <div style={{ paddingLeft: 20 }}>
          {multiLanguageFields.length === 0 ? (
            <Empty description={t('cast.detail.noMultiLanguages')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Tabs
              items={filteredLanguageOptions.map((lang) => ({
                key: lang.code,
                label: langCodeToName[lang.code] ?? lang.name ?? lang.code,
                children: (
                  <Form layout="vertical">
                    <Row gutter={24}>
                      <Col span={6}>
                        <Form.Item label={t('cast.detail.castName')}>
                          <TrimInput
                            value={i18nValueMap[lang.code]?.name ?? '—'}
                            disabled
                            style={{ background: '#f5f5f5' }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item label={t('cast.detail.description')}>
                          <TrimInput
                            value={i18nValueMap[lang.code]?.description ?? '—'}
                            disabled
                            style={{ background: '#f5f5f5' }}
                          />
                        </Form.Item>
                      </Col>
                      {multiLanguageFields.map((field) => {
                        const rawValue = i18nValueMap[lang.code]?.[field.field_code] ?? ''
                        const displayValue = rawValue
                          ? resolveFieldDisplayValue(field, rawValue, lang.code)
                          : '—'
                        return (
                          <Col span={6} key={field.field_code}>
                            <Form.Item label={field.field_name}>
                              <TrimInput value={displayValue} disabled style={{ background: '#f5f5f5' }} />
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

      <PostersModal
        open={postersOpen}
        entityType="cast"
        entityId={cast.id}
        entityName={cast.name}
        onClose={() => setPostersOpen(false)}
      />
    </div>
  )
}
