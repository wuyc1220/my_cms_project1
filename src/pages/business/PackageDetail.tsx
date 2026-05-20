import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
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
  Tag,
  Tooltip,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getPackage, getPackageContents, getPackageFieldValues, getPackageI18n, removeContentFromPackage } from '../../api/packages'
import { getCustomFields } from '../../api/customFields'
import { getDictTree } from '../../api/dicts'
import { getMultiLanguageOptions } from '../../api/i18n'
import TrimInput from '../../components/TrimInput'
import type { PackageListItem, ContentSimpleItem } from '../../types/package'
import type { CustomFieldListItem, EntityFieldValueItem, EntityI18nItem } from '../../types/basic'
import type { DictNodeListItem } from '../../types/dict'
import type { LanguageOption } from '../../types/i18n'
import { useI18n } from '../../i18n/useI18n'
import { usePermission } from '../../hooks/usePermission'
import { isHandledError } from '../../api'
import SectionTitle from '../../components/SectionTitle'
import { PAGINATION_CONFIG } from '../../constants/pagination'


// 根据自定义字段类型，将存储的 code 值转换为可读的 label
// 对于下拉框/多选下拉框，按逗号分隔 code，逐一查找对应 option 名称
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

export default function PackageDetail() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const packageId = Number(id)

  const [loading, setLoading] = useState(true)
  const [packageInfo, setPackageInfo] = useState<PackageListItem | null>(null)
  const [contents, setContents] = useState<ContentSimpleItem[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldListItem[]>([])
  const [fieldValues, setFieldValues] = useState<Record<number, string>>({})
  const [i18nValues, setI18nValues] = useState<EntityI18nItem[]>([])
  const [packageTypeMap, setPackageTypeMap] = useState<Record<string, string>>({})
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([])
  const [contentPage, setContentPage] = useState(1)
  const [contentPageSize, setContentPageSize] = useState(PAGINATION_CONFIG.defaultPageSize)
  const [contentTotal, setContentTotal] = useState(0)
  const [contentsLoading, setContentsLoading] = useState(false)
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.business.packages.operate')

  const loadContents = useCallback(async () => {
    setContentsLoading(true)
    try {
      const res = await getPackageContents(packageId, { page: contentPage, page_size: contentPageSize })
      setContents(res.items)
      setContentTotal(res.total)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('package.detail.msg.loadFailed'), 5)
    } finally {
      setContentsLoading(false)
    }
  }, [packageId, contentPage, contentPageSize, t])

  useEffect(() => {
    if (!isNaN(packageId)) {
      void loadContents()
    }
  }, [packageId, loadContents])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const [pkg, fields, dicts, langs, fv, i18n] = await Promise.all([
          getPackage(packageId),
          getCustomFields({ page: 1, page_size: 200, belongings: ['ALL', 'Package'] }),
          getDictTree(),
          getMultiLanguageOptions(),
          getPackageFieldValues(packageId),
          getPackageI18n(packageId),
        ])
        setPackageInfo(pkg)
        setCustomFields(
          fields.items.filter(
            (f: CustomFieldListItem) => f.belongings.includes('ALL') || f.belongings.includes('Package'),
          ),
        )
        setLanguageOptions(langs)
        setI18nValues(i18n)

        const pkgTypeRoot = dicts.find((d: DictNodeListItem) => d.code === 'Package_Type')
        setPackageTypeMap(
          Object.fromEntries((pkgTypeRoot?.children ?? []).map((c: DictNodeListItem) => [c.code, c.name])),
        )

        const nextFieldValues: Record<number, string> = {}
        fv.forEach((item: EntityFieldValueItem) => {
          nextFieldValues[item.custom_field_id] = item.value ?? ''
        })
        setFieldValues(nextFieldValues)
      } catch (err) {
        if (isHandledError(err)) return
        void message.error(t('package.detail.msg.loadFailed'), 5)
      } finally {
        setLoading(false)
      }
    })()
  }, [packageId])

  const handleRemoveContent = async (contentId: number) => {
    try {
      await removeContentFromPackage(packageId, contentId)
      void message.success(t('package.detail.msg.removed'), 3)
      void loadContents()
    } catch (err) {
      // 错误已在拦截器中处理
    }
  }

  // 获取所有支持多语言的字段
  const multiLanguageFields = useMemo(() => {
    return customFields.filter((f) => f.multi_language)
  }, [customFields])

  // 过滤掉第一个语言类型（English），只展示从第二个开始的语言
  const filteredLanguageOptions = useMemo(() => {
    return languageOptions.slice(1)
  }, [languageOptions])

  // 默认语言代码（第一个语言，通常是 English）
  const defaultLangCode = useMemo(() => {
    return languageOptions[0]?.code ?? ''
  }, [languageOptions])

  const langCodeToName = useMemo(() => {
    const map: Record<string, string> = {}
    filteredLanguageOptions.forEach((o) => {
      map[o.code] = o.name
    })
    return map
  }, [filteredLanguageOptions])

  // Multi Languages 按语言分组，建立 language_code -> field_code -> value 的映射
  const i18nValueMap = useMemo(() => {
    const map: Record<string, Record<string, string>> = {}
    i18nValues.forEach((item) => {
      if (!map[item.language]) map[item.language] = {}
      map[item.language][item.field_name] = item.value ?? ''
    })
    return map
  }, [i18nValues])

  const contentColumns: ColumnsType<ContentSimpleItem> = [
    {
      title: t('package.detail.contentName'),
      dataIndex: 'title',
      key: 'title',
      ellipsis: { showTitle: false },
      render: (val: string) => <Tooltip title={val}><span>{val}</span></Tooltip>,
    },
    {
      title: t('package.detail.contentType'),
      dataIndex: 'content_type',
      key: 'content_type',
      width: 140,
    },
    {
      title: t('package.detail.genre'),
      dataIndex: 'genre',
      key: 'genre',
      width: 120,
      render: (val: string | null) => val || '—',
    },
    {
      title: t('package.detail.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (val: string) => (
        <Tag color={val === 'Published' ? 'success' : 'default'}>{val}</Tag>
      ),
    },
    {
      title: t('package.detail.license'),
      key: 'license',
      width: 90,
      render: (_, row) =>
        row.has_license ? (
          <Button type="link" size="small" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} disabled={!canOperate} />
        ) : (
          <Button type="link" size="small" icon={<ExclamationCircleOutlined style={{ color: '#d9d9d9' }} />} disabled={!canOperate} />
        ),
    },
    {
      title: t('common.action'),
      key: 'action',
      fixed: 'right',
      width: 80,
      render: (_, row) =>
        canOperate ? (
          <Popconfirm
            title={t('package.detail.confirmRemoveContent', { name: row.title })}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            onConfirm={() => void handleRemoveContent(row.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
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

  if (!packageInfo) {
    return (
      <div className="main-container">
        <Empty description={t('package.detail.emptyPackage')} />
      </div>
    )
  }

  return (
    <div className="main-container">
      {/* 基本信息 */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('common.basicInfo')} />
        <div style={{ paddingLeft: 20 }}>
          <Form layout="vertical">
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item label={t('package.detail.packageName')}>
                  <Tooltip title={packageInfo.name || undefined}>
                    <TrimInput value={packageInfo.name} disabled style={{ background: '#f5f5f5' }} />
                  </Tooltip>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('package.detail.platform')}>
                  <TrimInput
                    value={(packageInfo.platforms ?? []).length === 0 ? '—' : (packageInfo.platforms ?? []).join(', ')}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('package.detail.packageType')}>
                  <TrimInput
                    value={packageInfo.package_type
                      ? (packageTypeMap[packageInfo.package_type] ?? packageInfo.package_type)
                      : '—'}
                    disabled
                    style={{ background: '#f5f5f5' }}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={24}>
              <Col span={24}>
                <Form.Item label={t('package.detail.description')}>
                  <TrimInput value={packageInfo.description || '—'} disabled style={{ background: '#f5f5f5' }} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      </div>

      {/* Custom Fields - 一行展示3个 */}
      {customFields.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <SectionTitle title={t('package.detail.customFields')} />
          <div style={{ paddingLeft: 20 }}>
            <Form layout="vertical">
              <Row gutter={24}>
                {customFields.map((field) => {
                  // 多语言字段从 i18nValueMap 中获取 defaultLang 下的值
                  const rawValue = field.multi_language
                    ? (i18nValueMap[defaultLangCode]?.[field.field_code] ?? '')
                    : (fieldValues[field.id] ?? '')
                  return (
                    <Col span={8} key={field.id}>
                      <Form.Item label={field.field_name}>
                        <TrimInput
                          value={resolveFieldDisplayValue(field, rawValue, defaultLangCode) || '—'}
                          disabled
                          style={{ background: '#f5f5f5' }}
                        />
                      </Form.Item>
                    </Col>
                  )
                })}
              </Row>
            </Form>
          </div>
        </div>
      )}

      {/* Multi Languages - Tabs 形式 */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title={t('package.detail.multiLanguages')} />
        <div style={{ paddingLeft: 20 }}>
          {multiLanguageFields.length === 0 ? (
            <Empty description={t('package.detail.noMultiLanguages')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Tabs
              items={filteredLanguageOptions.map((lang) => ({
                key: lang.code,
                label: langCodeToName[lang.code] ?? lang.name ?? lang.code,
                children: (
                  <Form layout="vertical">
                    <Row gutter={24}>
                      {multiLanguageFields.map((field) => {
                        const rawValue = i18nValueMap[lang.code]?.[field.field_code] ?? ''
                        const displayValue = rawValue
                          ? resolveFieldDisplayValue(field, rawValue, lang.code)
                          : '—'
                        return (
                          <Col span={8} key={field.field_code}>
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

      {/* 关联内容列表 */}
      <div>
        <SectionTitle title={t('package.detail.contents')} />
        <div style={{ paddingLeft: 20 }}>
          <Table<ContentSimpleItem>
            rowKey="id"
            columns={contentColumns}
            dataSource={contents}
            loading={contentsLoading}
            scroll={{ x: 700 }}
            size="small"
            pagination={{
              defaultCurrent: 1,
              defaultPageSize: PAGINATION_CONFIG.defaultPageSize,
              total: contentTotal,
              showSizeChanger: true,
              pageSizeOptions: PAGINATION_CONFIG.pageSizeOptions.map(String),
              showTotal: (n) => t('pagination.total', { n }),
              position: ['bottomCenter'],
              onChange: (page, pageSize) => {
                setContentPage(pageSize !== contentPageSize ? 1 : page)
                setContentPageSize(pageSize)
              },
            }}
            locale={{ emptyText: t('package.detail.noContents') }}
          />
        </div>
      </div>
    </div>
  )
}
