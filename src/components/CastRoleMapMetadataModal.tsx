/**
 * CastRoleMapMetadataModal — 人物角色关联元数据编辑弹框
 *
 * 包含 2 个标签页：Main / Custom Fields
 * - Main：Cast Name（只读）、CastRole（下拉选择）
 * - Custom Fields：Belonging = CastRoleMap 的自定义字段
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Col,
  Form,
  InputNumber,
  Modal,
  Row,
  Select,
  Spin,
  Tabs,
  App,
} from 'antd'
import { getDictChildren } from '../api/dicts'
import { getCustomFields } from '../api/customFields'
import {
  getCastRoleMap,
  updateCastRoleMap,
  getCastRoleMapFieldValues,
  saveCastRoleMapFieldValues,
} from '../api/castRoleMap'
import { useI18n } from '../i18n/useI18n'
import TrimInput from './TrimInput'
import { isHandledError } from '../api'
import type {
  CastRoleMapItem,
  CustomFieldListItem,
  EntityFieldValueItem,
} from '../types/basic'
import type { LanguageOption } from '../types/i18n'

interface CastRoleMapMetadataModalProps {
  open: boolean
  mapId: number | null
  /** 未保存的临时项数据（mapId < 0 时使用） */
  pendingItem?: CastRoleMapItem | null
  /** 更新临时项数据的回调 */
  onUpdatePendingItem?: (mapId: number, data: Partial<CastRoleMapItem>) => void
  readOnly?: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function CastRoleMapMetadataModal({
  open,
  mapId,
  pendingItem = null,
  onUpdatePendingItem,
  readOnly = false,
  onClose,
  onSuccess,
}: CastRoleMapMetadataModalProps) {
  const { t } = useI18n()
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('main')

  // 数据状态
  const [presetRoles, setPresetRoles] = useState<Pick<LanguageOption, 'code' | 'name'>[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldListItem[]>([])

  // 弹框打开时重置到 Main 标签
  useEffect(() => {
    if (open) {
      setActiveTab('main')
    }
  }, [open])

  // 加载预设角色和自定义字段配置
  useEffect(() => {
    if (!open) return
    const loadConfig = async () => {
      try {
        const [roles, cfRes] = await Promise.all([
          getDictChildren('Cast_Role').catch(() => []),
          getCustomFields({
            page: 1,
            page_size: 500,
            belongings: ['ALL', 'CastRoleMap'],
          }).catch(() => ({ items: [], total: 0 })),
        ])
        setPresetRoles(roles)
        setCustomFields(cfRes.items ?? [])
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
    
    // 如果是临时 ID（负数），直接使用父组件传递的数据
    if (mapId < 0 && pendingItem) {
      form.setFieldsValue({
        cast_name: pendingItem.cast_name ?? '',
        role_name: pendingItem.role_name ?? '',
        role_code: pendingItem.role_code ?? '',
      })
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
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('content.metadata.loadFailed'), 5)
    } finally {
      setLoading(false)
    }
  }, [mapId, open, pendingItem, form, message, t])

  useEffect(() => {
    if (open && mapId) {
      void loadMapData()
    }
  }, [open, mapId, loadMapData])

  // 加载自定义字段值（依赖 customFields）
  const loadFieldValues = useCallback(async () => {
    // 临时 ID 不加载自定义字段值
    if (!mapId || !open || customFields.length === 0 || mapId < 0) return
    try {
      const fieldValues = await getCastRoleMapFieldValues(mapId).catch(() => [] as EntityFieldValueItem[])

      const customFieldValues: Record<string, unknown> = {}
      for (const fv of fieldValues) {
        const field = customFields.find(f => f.id === fv.custom_field_id)
        if (field) {
          let val: unknown = fv.value
          if (field.field_type === 'multi_select' || field.field_type === 'DropList_multiple') {
            if (typeof val === 'string' && val.includes(',')) {
              val = val.split(',').map(v => v.trim()).filter(Boolean)
            } else if (typeof val === 'string' && val) {
              val = [val]
            }
          } else if (field.field_type === 'Integer' || field.field_type === 'Decimal') {
            if (typeof val === 'string' && val) {
              const n = Number(val)
              if (!isNaN(n)) val = n
            }
          }
          customFieldValues[field.field_code] = val
        }
      }
      form.setFieldsValue({ custom_field_values: customFieldValues })
    } catch (err) {
      if (isHandledError(err)) return
      message.error(t('content.metadata.loadFailed'), 5)
    }
  }, [mapId, open, customFields, form, message, t])

  useEffect(() => {
    if (open && mapId && customFields.length > 0) {
      void loadFieldValues()
    }
  }, [open, mapId, customFields, loadFieldValues])

  // 保存
  const handleSave = async () => {
    if (!mapId || readOnly) return
    
    let values: Record<string, unknown> | null = null
    try {
      values = await form.validateFields()
    } catch (error) {
      // Ant Design 会自动在表单字段上显示校验错误（红色边框 + 错误消息）
      message.warning(t('content.metadata.requiredCheck'), 3)

      // 判断第一个错误字段属于哪个 tab，自动切换
      const errorInfo = error as { errorFields?: Array<{ name: (string | number)[] }> }
      const firstErrorField = errorInfo.errorFields?.[0]?.name
      if (firstErrorField) {
        const isCustomField = firstErrorField[0] === 'custom_field_values'
        if (isCustomField) {
          setActiveTab('customFields')
        } else {
          setActiveTab('main')
        }
      }
      return
    }

    setSaving(true)
    try {
      // 如果是临时 ID，更新父组件的 pendingAdditions
      if (mapId < 0) {
        onUpdatePendingItem?.(mapId, {
          role_name: (values?.role_name as string) || null,
          role_code: (values?.role_code as string) || null,
        })
        message.success(t('content.castRoleMap.updateSuccess'), 3)
        onSuccess?.()
        onClose()
        return
      }
      
      // 1. 更新角色信息
      await updateCastRoleMap(mapId, {
        role_name: (values?.role_name as string) || null,
        role_code: (values?.role_code as string) || null,
      })

      // 2. 保存自定义字段值
      const cfValues = values?.custom_field_values as Record<string, unknown> | undefined
      if (cfValues && customFields.length > 0) {
        const payload = {
          values: customFields.map(field => {
            const raw = cfValues[field.field_code]
            let val: string | null = null
            if (raw !== undefined && raw !== null && raw !== '') {
              if (Array.isArray(raw)) {
                val = raw.join(',')
              } else {
                val = String(raw)
              }
            }
            return {
              custom_field_id: field.id,
              value: val,
            }
          }),
        }
        await saveCastRoleMapFieldValues(mapId, payload)
      }

      message.success(t('content.castRoleMap.updateSuccess'), 3)
      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      message.error(detail ?? t('content.castRoleMap.saveFailed'), 5)
    } finally {
      setSaving(false)
    }
  }

  // 角色选择变化时同步更新 role_code
  const handleRoleChange = (roleName: string) => {
    const role = presetRoles.find(r => r.name === roleName)
    form.setFieldsValue({
      role_name: roleName,
      role_code: role?.code ?? '',
    })
  }

  // Custom Fields Tab
  const customFieldsTab = useMemo(() => {
    if (customFields.length === 0) {
      return <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>No custom fields configured</div>
    }
    return (
      <Row gutter={16}>
        {customFields.map(field => {
          const isRequired = field.mandatory
          const options = field.options.map(o => ({ value: o.code, label: o.names?.['en'] ?? o.code }))
          return (
            <Col span={12} key={field.id}>
              <Form.Item
                name={['custom_field_values', field.field_code]}
                label={field.field_name}
                rules={isRequired ? [{ required: true, message: t('content.metadata.required') }] : undefined}
              >
                {field.field_type === 'DropList' ? (
                  <Select showSearch optionFilterProp="label" allowClear placeholder="Please select" options={options} disabled={readOnly} />
                ) : field.field_type === 'DropList_multiple' ? (
                  <Select showSearch optionFilterProp="label" mode="multiple" allowClear placeholder="Please select" options={options} disabled={readOnly} />
                ) : field.field_type === 'LongText' ? (
                  <TrimInput.TextArea rows={2} disabled={readOnly} />
                ) : field.field_type === 'Integer' || field.field_type === 'Decimal' ? (
                  <InputNumber style={{ width: '100%' }} disabled={readOnly} />
                ) : (
                  <TrimInput disabled={readOnly} />
                )}
              </Form.Item>
            </Col>
          )
        })}
      </Row>
    )
  }, [customFields, readOnly, t])

  return (
    <Modal
      title="Metadata"
      open={open}
      onCancel={onClose}
      onOk={() => void handleSave()}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      confirmLoading={saving}
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
                label: 'Main',
                forceRender: true,
                children: (
                  <>
                    <Form.Item
                      name="cast_name"
                      label="Cast Name"
                    >
                      <TrimInput disabled />
                    </Form.Item>
                    <Form.Item
                      name="role_name"
                      label="CastRole"
                      rules={[{ required: true, message: 'Please select role' }]}
                    >
                      <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder="Select role"
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
                label: 'Custom Fields',
                forceRender: true,
                children: customFieldsTab,
              },
            ]}
          />
        </Form>
      </Spin>
    </Modal>
  )
}
