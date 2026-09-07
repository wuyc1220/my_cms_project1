/**
 * CastRoleMapMetadataModal — 人物角色关联元数据编辑弹框
 *
 * 包含 2 个标签页：Main / Custom Fields
 * - Main：Cast Name（只读）、CastRole（下拉选择）
 * - Custom Fields：Belonging = CastRoleMap 的自定义字段
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Col,
  Form,
  Modal,
  Row,
  Select,
  Spin,
  Tabs,
  App,
} from 'antd'
import { getDictChildren, getDictTree } from '../api/dicts'
import { getCustomFields } from '../api/customFields'
import { getCastRoleMap, getCastRoleMapFieldValues, getCastRoleMapI18n } from '../api/castRoleMap'
import { getMultiLanguageOptions } from '../api/i18n'
import { getFieldOptionLabel, parseApiValue, getCustomFieldRules, getCustomFieldPlaceholder } from '../utils/customField'
import { useI18n } from '../i18n/useI18n'
import TrimInput from './TrimInput'
import CustomFieldControl from './CustomFieldControl'
import { isHandledError } from '../api'
import type {
  CastRoleMapItem,
  CustomFieldListItem,
  EntityFieldValueItem,
  EntityI18nItem,
} from '../types/basic'
import type { LanguageOption } from '../types/i18n'
import type { DictNodeListItem } from '../types/dict'

/** 元数据编辑结果（通过回调传回父组件） */
export interface MetadataEditResult {
  /** 基础字段变更 */
  basicData: {
    role_name?: string | null
    role_code?: string | null
  }
  /** 自定义字段值变更 */
  customFieldValues: Record<string, unknown>
  /** 多语言字段值变更（按语言分组，值为表单原始值，提交时由父组件格式化） */
  i18nValues?: Record<string, Record<string, unknown>>
}

interface CastRoleMapMetadataModalProps {
  open: boolean
  mapId: number | null
  /** 未保存的临时项数据（mapId < 0 时使用） */
  pendingItem?: CastRoleMapItem | null
  /** 当前项的已编辑数据（用于恢复之前编辑的值） */
  pendingEditValues?: MetadataEditResult | null
  /** 更新临时项基础数据的回调 */
  onUpdatePendingItem?: (mapId: number, data: Partial<CastRoleMapItem>) => void
  /** 编辑确认回调：将完整编辑数据传回父组件，由父组件统一提交 */
  onEditData?: (mapId: number, result: MetadataEditResult) => void
  readOnly?: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function CastRoleMapMetadataModal({
  open,
  mapId,
  pendingItem = null,
  pendingEditValues = null,
  onUpdatePendingItem,
  onEditData,
  readOnly = false,
  onClose,
  onSuccess,
}: CastRoleMapMetadataModalProps) {
  const { t } = useI18n()
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('main')

  // 数据状态
  const [presetRoles, setPresetRoles] = useState<Pick<LanguageOption, 'code' | 'name'>[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldListItem[]>([])
  const [multiLanguages, setMultiLanguages] = useState<{ value: string; label: string }[]>([])
  const [defaultLanguage, setDefaultLanguage] = useState<string>('')
  const [currentLanguage, setCurrentLanguage] = useState<string>('')

  // 当前正在编辑的 mapId（用于检测切换）
  const currentMapIdRef = useRef<number | null>(null)

  // 弹框打开时重置到 Main 标签
  useEffect(() => {
    if (open) {
      setActiveTab('main')
      currentMapIdRef.current = null
    }
  }, [open])

  // 加载预设角色和自定义字段配置
  useEffect(() => {
    if (!open) return
    const loadConfig = async () => {
      try {
        const [roles, cfRes, dictTree, langs] = await Promise.all([
          getDictChildren('Cast_Role').catch(() => []),
          getCustomFields({
            page: 1,
            page_size: 500,
            belongings: ['ALL', 'CastRoleMap'],
          }).catch(() => ({ items: [], total: 0 })),
          getDictTree().catch(() => [] as DictNodeListItem[]),
          getMultiLanguageOptions().catch(() => [] as LanguageOption[]),
        ])
        setPresetRoles(roles)
        setCustomFields(cfRes.items ?? [])

        const defaultLang = langs[0]?.code ?? ''
        setDefaultLanguage(defaultLang)
        setCurrentLanguage(defaultLang)

        // 解析 Multi_Languages 字典为扁平选项
        const flattenDict = (nodes: DictNodeListItem[]): { value: string; label: string }[] => {
          const result: { value: string; label: string }[] = []
          for (const node of nodes) {
            if (node.children?.length) {
              if (node.code === 'Multi_Languages') {
                result.push(...node.children.map(c => ({ value: c.code, label: c.name })))
              }
              result.push(...flattenDict(node.children))
            }
          }
          return result
        }
        setMultiLanguages(flattenDict(dictTree))
      } catch (err) {
        if (isHandledError(err)) return
        message.error(t('content.metadata.loadFailed'), 5)
      }
    }
    void loadConfig()
  }, [open, t, message])

  // 加载 CastRoleMap 基础数据（不依赖 customFields）
  const loadMapData = useCallback(async () => {
    if (!mapId || !open) return

    // 检测 mapId 是否切换，切换时重置整个表单
    if (currentMapIdRef.current !== mapId) {
      form.resetFields()
    }
    currentMapIdRef.current = mapId

    // 如果是临时 ID（负数），直接使用父组件传递的数据
    if (mapId < 0 && pendingItem) {
      form.setFieldsValue({
        cast_name: pendingItem.cast_name ?? '',
        role_name: pendingItem.role_name ?? '',
        role_code: pendingItem.role_code ?? '',
      })
      // 关键修复：对于临时项，也需要从 pendingEditValues 恢复自定义字段值
      if (pendingEditValues?.customFieldValues) {
        const customFieldValues = { ...pendingEditValues.customFieldValues }
        form.setFieldsValue({ custom_field_values: customFieldValues })
        console.log('[CastRoleMapMetadata] Loaded custom fields for temp item from pendingEditValues:', customFieldValues)
      } else {
        // 关键修复：如果没有 pendingEditValues，清空自定义字段值，防止数据串扰
        const emptyCf: Record<string, unknown> = {}
        for (const f of customFields) {
          emptyCf[f.field_code] = null
        }
        form.setFieldsValue({ custom_field_values: emptyCf })
        console.log('[CastRoleMapMetadata] Cleared custom fields for new temp item in loadMapData')
      }
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const mapItem = await getCastRoleMap(mapId)

      form.setFieldsValue({
        cast_name: mapItem.cast_name ?? '',
        role_name: mapItem.role_name ?? '',
        role_code: mapItem.role_code ?? '',
      })

      // 应用 pending 中的基础字段编辑值（覆盖数据库值）
      if (pendingEditValues?.basicData) {
        form.setFieldsValue({
          role_name: pendingEditValues.basicData.role_name ?? '',
          role_code: pendingEditValues.basicData.role_code ?? '',
        })
      }
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('content.metadata.loadFailed'), 5)
    } finally {
      setLoading(false)
    }
  }, [mapId, open, pendingItem, pendingEditValues, customFields, form, message, t])

  useEffect(() => {
    if (open && mapId) {
      void loadMapData()
    }
  }, [open, mapId, loadMapData])

  // 加载自定义字段值（依赖 customFields）
  const loadFieldValues = useCallback(async () => {
    // 检查基本条件
    if (!mapId || !open || customFields.length === 0) return

    // 多语言字段集合（用于区分表单路径）
    const mlFields = customFields.filter(f => f.multi_language)
    const hasMultiLang = mlFields.length > 0

    // 对于临时项（mapId < 0），只需要从 pendingEditValues 恢复数据，不需要从后端加载
    if (mapId < 0) {
      if (pendingEditValues?.customFieldValues) {
        const customFieldValues = { ...pendingEditValues.customFieldValues }
        form.setFieldsValue({ custom_field_values: customFieldValues })
        console.log('[CastRoleMapMetadata] Loaded custom fields for temp item from pendingEditValues:', customFieldValues)
      } else {
        // 关键修复：如果没有 pendingEditValues，清空自定义字段值，防止数据串扰
        const emptyCf: Record<string, unknown> = {}
        for (const f of customFields) {
          if (!f.multi_language) emptyCf[f.field_code] = null
        }
        form.setFieldsValue({ custom_field_values: emptyCf })
        console.log('[CastRoleMapMetadata] Cleared custom fields for new temp item')
      }
      // 恢复多语言字段值
      if (hasMultiLang) {
        const i18nValues = pendingEditValues?.i18nValues ?? {}
        form.setFieldsValue({ i18n: i18nValues })
      }
      return
    }

    // 先清空自定义字段值，防止切换 item 时数据串扰
    const emptyCf: Record<string, unknown> = {}
    for (const f of customFields) {
      if (!f.multi_language) emptyCf[f.field_code] = null
    }
    form.setFieldsValue({ custom_field_values: emptyCf })

    try {
      const [fieldValues, i18nItems] = await Promise.all([
        getCastRoleMapFieldValues(mapId).catch(() => [] as EntityFieldValueItem[]),
        hasMultiLang ? getCastRoleMapI18n(mapId).catch(() => [] as EntityI18nItem[]) : Promise.resolve([] as EntityI18nItem[]),
      ])

      const customFieldValues: Record<string, unknown> = {}
      for (const fv of fieldValues) {
        const field = customFields.find(f => f.id === fv.custom_field_id)
        if (field && !field.multi_language) {
          customFieldValues[field.field_code] = parseApiValue(field.field_type, fv.value)
        }
      }
      form.setFieldsValue({ custom_field_values: customFieldValues })

      // 多语言字段值：按语言分组写入 i18n 表单字段
      if (hasMultiLang) {
        const i18nValues: Record<string, Record<string, unknown>> = {}
        for (const item of i18nItems) {
          if (!i18nValues[item.language]) i18nValues[item.language] = {}
          const field = mlFields.find(f => f.field_code === item.field_name)
          if (field) {
            i18nValues[item.language][item.field_name] = parseApiValue(field.field_type, item.value)
          }
        }
        form.setFieldsValue({ i18n: i18nValues })
      }

      // 应用 pending 中的自定义字段编辑值（覆盖数据库值）
      if (pendingEditValues?.customFieldValues) {
        form.setFieldsValue({ custom_field_values: { ...pendingEditValues.customFieldValues } })
      }
      if (hasMultiLang && pendingEditValues?.i18nValues) {
        form.setFieldsValue({ i18n: { ...pendingEditValues.i18nValues } })
      }
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('content.metadata.loadFailed'), 5)
    }
  }, [mapId, open, customFields, pendingEditValues, form, message, t])

  useEffect(() => {
    if (open && mapId && customFields.length > 0) {
      void loadFieldValues()
    }
  }, [open, mapId, customFields, loadFieldValues])

  // 保存（纯前端操作：收集表单数据，通过回调传回父组件）
  const handleSave = async () => {
    if (!mapId || readOnly) return

    let values: Record<string, unknown> | null = null
    try {
      values = await form.validateFields()
    } catch (error) {
      message.warning(t('content.metadata.requiredCheck'), 3)

      // 判断第一个错误字段属于哪个 tab，自动切换
      const errorInfo = error as { errorFields?: Array<{ name: (string | number)[] }> }
      const firstErrorField = errorInfo.errorFields?.[0]?.name
      if (firstErrorField) {
        const root = firstErrorField[0]
        if (root === 'custom_field_values') {
          setActiveTab('customFields')
        } else if (root === 'i18n') {
          // 默认语言的多语言字段仍在 Custom Fields tab，其它语言在 Multi Languages tab
          const lang = firstErrorField[1]?.toString()
          setActiveTab(lang && lang !== defaultLanguage ? 'multiLanguages' : 'customFields')
        } else {
          setActiveTab('main')
        }
      }
      return
    }

    const basicData = {
      role_name: (values?.role_name as string) || null,
      role_code: (values?.role_code as string) || null,
    }
    const cfValues = (values?.custom_field_values as Record<string, unknown> | undefined) ?? {}
    const i18nValues = (values?.i18n as Record<string, Record<string, unknown>> | undefined) ?? {}

    // 如果是临时 ID，更新父组件的 pendingAdditions
    if (mapId < 0) {
      onUpdatePendingItem?.(mapId, basicData)
      // 临时项的自定义字段值也需要通过 onEditData 回调传递给父组件，以便下次编辑时恢复
      onEditData?.(mapId, { basicData, customFieldValues: cfValues, i18nValues })
      onSuccess?.()
      onClose()
      return
    }

    // 已存在的项：将编辑数据传回父组件，由父组件在最终 Confirm 时统一提交
    onEditData?.(mapId, { basicData, customFieldValues: cfValues, i18nValues })
    onSuccess?.()
    onClose()
  }

  // 角色选择变化时同步更新 role_code
  const handleRoleChange = (roleName: string) => {
    const role = presetRoles.find(r => r.name === roleName)
    form.setFieldsValue({
      role_name: roleName,
      role_code: role?.code ?? '',
    })
  }

  // 多语言自定义字段（决定是否显示 Multi Languages 标签页）
  const mlCustomFields = useMemo(() => customFields.filter(f => f.multi_language), [customFields])
  const hasMultiLang = mlCustomFields.length > 0

  // Custom Fields Tab（默认语言：multi_language 字段走 i18n[defaultLanguage] 路径，其余走 custom_field_values）
  const customFieldsTab = useMemo(() => {
    if (customFields.length === 0) {
      return <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>{t('content.metadata.noCustomFields')}</div>
    }
    const languageOrder = multiLanguages.map(l => l.value)
    return (
      <Row gutter={16}>
        {customFields.map(field => {
          const namePath = field.multi_language
            ? (['i18n', defaultLanguage, field.field_code] as (string | number)[])
            : (['custom_field_values', field.field_code] as (string | number)[])
          const options = field.options.map(o => ({ value: o.code, label: getFieldOptionLabel(field, o.code, defaultLanguage || languageOrder[0], languageOrder) }))
          return (
            <Col span={12} key={field.id}>
              <Form.Item
                name={namePath}
                label={field.field_name}
                rules={getCustomFieldRules(field, t('customField.validation.integerOnly'), t)}
              >
                <CustomFieldControl fieldType={field.field_type} options={options} disabled={readOnly} placeholder={getCustomFieldPlaceholder(field, t)} />
              </Form.Item>
            </Col>
          )
        })}
      </Row>
    )
  }, [customFields, readOnly, t, multiLanguages, defaultLanguage])

  // Multi Languages Tab（非默认语言的多语言自定义字段）
  const multiLanguagesTab = useMemo(() => {
    if (!hasMultiLang) return null
    const languages = multiLanguages.filter(l => l.value !== defaultLanguage)
    if (languages.length === 0) {
      return <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>{t('content.metadata.noOtherLanguages')}</div>
    }
    const selectedLang = currentLanguage && currentLanguage !== defaultLanguage
      ? currentLanguage
      : languages[0]?.value || null
    const languageOrder = multiLanguages.map(l => l.value)

    // 清除某语言下的全部字段
    const handleClear = (lang: string) => {
      const current = form.getFieldValue('i18n') as Record<string, Record<string, unknown>> | undefined
      const cleared: Record<string, unknown> = {}
      const langData = current?.[lang] ?? {}
      for (const key of Object.keys(langData)) {
        cleared[key] = undefined
      }
      form.setFieldsValue({ i18n: { ...current, [lang]: cleared } })
    }

    return (
      <Row gutter={16}>
        {/* 左侧语言列表 */}
        <Col span={6}>
          <div style={{ borderRight: '1px solid #f0f0f0', paddingRight: 8 }}>
            {languages.map(lang => (
              <div
                key={lang.value}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: selectedLang === lang.value ? '#e6f4ff' : 'transparent',
                  borderRadius: 6,
                  marginBottom: 4,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onClick={() => setCurrentLanguage(lang.value)}
              >
                <span>{lang.label}</span>
                <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); handleClear(lang.value) }}>
                  {t('content.metadata.clear')}
                </Button>
              </div>
            ))}
          </div>
        </Col>

        {/* 右侧语言表单 */}
        <Col span={18}>
          {languages.map(lang => (
            <div key={lang.value} style={{ display: selectedLang === lang.value ? 'block' : 'none' }}>
              {selectedLang === lang.value && (
                <div style={{ marginBottom: 12, fontWeight: 600 }}>
                  {t('content.metadata.language')}: {lang.label}
                </div>
              )}
              <Row gutter={16}>
                {mlCustomFields.map(field => {
                  const options = field.options.map(o => ({ value: o.code, label: getFieldOptionLabel(field, o.code, lang.value, languageOrder) }))
                  // 多语言 Tab 不做必填校验，仅保留非 required 规则
                  const mlRules = (getCustomFieldRules(field, t('customField.validation.integerOnly'), t) ?? []).filter(r => !r.required)
                  return (
                    <Col span={12} key={field.id}>
                      <Form.Item name={['i18n', lang.value, field.field_code]} label={field.field_name} rules={mlRules.length > 0 ? mlRules : undefined}>
                        <CustomFieldControl fieldType={field.field_type} options={options} disabled={readOnly} placeholder={getCustomFieldPlaceholder(field, t)} />
                      </Form.Item>
                    </Col>
                  )
                })}
              </Row>
            </div>
          ))}
        </Col>
      </Row>
    )
  }, [hasMultiLang, multiLanguages, defaultLanguage, currentLanguage, mlCustomFields, form, t, readOnly])

  return (
    <Modal
      title={t('content.metadata.title')}
      open={open}
      onCancel={onClose}
      onOk={() => void handleSave()}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      width={640}
      destroyOnHidden
    >
      <Spin spinning={loading}>
        <Form form={form} layout="vertical">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'main',
                label: t('content.metadata.tab.main'),
                forceRender: true,
                children: (
                  <>
                    <Form.Item
                      name="cast_name"
                      label={t('content.castRoleMap.castName')}
                    >
                      <TrimInput disabled />
                    </Form.Item>
                    <Form.Item
                      name="role_name"
                      label={t('content.castRoleMap.castRole')}
                      rules={[{ required: true, message: t('content.castRoleMap.selectRole') }]}
                    >
                      <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder={t('content.castRoleMap.selectRole')}
                        disabled={readOnly}
                        onChange={handleRoleChange}
                        options={presetRoles.map(r => ({ label: r.name, value: r.name }))}
                      />
                    </Form.Item>
                    <Form.Item name="role_code" hidden>
                      <TrimInput />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: 'customFields',
                label: t('content.metadata.tab.customFields'),
                forceRender: true,
                children: customFieldsTab,
              },
              ...(hasMultiLang ? [{
                key: 'multiLanguages',
                label: t('content.metadata.tab.multiLanguages'),
                forceRender: true,
                children: multiLanguagesTab,
              }] : []),
            ]}
          />
        </Form>
      </Spin>
    </Modal>
  )
}
