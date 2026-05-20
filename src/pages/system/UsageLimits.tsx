/**
 * UsageLimits — 使用限制配置页面
 *
 * 展示供应商数量限制、VOD内容条数限制、内容总容量限制。
 * 支持修改已开发项的限制值，待开发项输入框禁用。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Button,
  Form,
  InputNumber,
  Space,
  Spin,
  message,
} from 'antd'
import { getUsageLimits, updateUsageLimits } from '../../api/usageLimits'
import type {
  UsageLimitItem,
  UsageLimitsResponse,
} from '../../types/usageLimit'
import { useI18n } from '../../i18n/useI18n'
import type { MessageKey } from '../../i18n/messages'
import { isHandledError } from '../../api'


/** 限制类型对应的 i18n key */
const LIMIT_TYPE_LABEL_KEY: Record<string, string> = {
  supplier_count: 'usageLimits.supplierCount',
  content_count: 'usageLimits.contentCount',
  storage_capacity: 'usageLimits.storageCapacity',
}

/** 限制类型说明对应的 i18n key */
const LIMIT_TYPE_DESC_KEY: Record<string, string> = {
  supplier_count: 'usageLimits.supplierCountDesc',
  content_count: 'usageLimits.contentCountDesc',
  storage_capacity: 'usageLimits.storageCapacityDesc',
}

/** 限制类型排序权重（越小越靠前） */
const LIMIT_TYPE_ORDER: Record<string, number> = {
  supplier_count: 1,
  content_count: 2,
  storage_capacity: 3,
}

export default function UsageLimits() {
  const { t } = useI18n()
  const tRef = useRef(t)
  tRef.current = t

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [limits, setLimits] = useState<UsageLimitItem[]>([])
  const [editValues, setEditValues] = useState<Record<string, number | null>>({})

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data: UsageLimitsResponse = await getUsageLimits()
      setLimits(data.items)
      const vals: Record<string, number | null> = {}
      data.items.forEach((item) => {
        vals[item.limit_type] = item.limit_value
      })
      setEditValues(vals)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(tRef.current('common.msg.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleSave = async () => {
    const emptyField = limits.find(
      (item) => editValues[item.limit_type] === null || editValues[item.limit_type] === undefined
    )
    if (emptyField) {
      return
    }

    const changedItems = limits
      .filter((item) => editValues[item.limit_type] !== item.limit_value)
      .map((item) => ({
        limit_type: item.limit_type,
        limit_value: editValues[item.limit_type] as number,
      }))

    if (changedItems.length === 0) {
      void message.info(t('usageLimits.noChanges'))
      return
    }

    setSaving(true)
    try {
      const data = await updateUsageLimits({ items: changedItems })
      setLimits(data.items)
      const vals: Record<string, number | null> = {}
      data.items.forEach((item) => {
        vals[item.limit_type] = item.limit_value
      })
      setEditValues(vals)
      void message.success(t('usageLimits.msg.saved'))
    } catch (err) {
      // error handled by axios interceptor
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    const vals: Record<string, number | null> = {}
    limits.forEach((item) => {
      vals[item.limit_type] = item.limit_value
    })
    setEditValues(vals)
  }

  const hasChanges = limits.some(
    (item) => editValues[item.limit_type] !== item.limit_value
  )

  const renderFormItem = (item: UsageLimitItem) => {
    const labelKey = LIMIT_TYPE_LABEL_KEY[item.limit_type] || item.limit_type
    const descKey = LIMIT_TYPE_DESC_KEY[item.limit_type]
    const editValue = editValues[item.limit_type]
    const isEmpty = editValue === null || editValue === undefined

    return (
      <Form.Item
        key={item.limit_type}
        label={
          <span>
            <span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>
            {t(labelKey as MessageKey)}
          </span>
        }
        validateStatus={isEmpty ? 'error' : undefined}
        help={isEmpty ? t('usageLimits.fieldRequired', { field: t(labelKey as MessageKey) }) : undefined}
        style={{ marginBottom: 24 }}
      >
        <Space align="baseline" size={30}>
          <InputNumber
            value={editValue}
            onChange={(val) => {
              setEditValues((prev) => ({
                ...prev,
                [item.limit_type]: val,
              }))
            }}
            min={-1}
            step={1}
            style={{ width: 280 }}
          />
          {descKey && (
            <span style={{ color: '#666', fontSize: 14 }}>{t(descKey as MessageKey)}</span>
          )}
        </Space>
      </Form.Item>
    )
  }

  return (
    <Spin spinning={loading}>
      <div className="main-container">
        <Form layout="vertical" style={{ maxWidth: '100%' }}>
          {[...limits]
            .sort((a, b) => (LIMIT_TYPE_ORDER[a.limit_type] ?? 99) - (LIMIT_TYPE_ORDER[b.limit_type] ?? 99))
            .map(renderFormItem)}
        </Form>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}>
          <Space size={16}>
            <Button
              onClick={handleDiscard}
              disabled={!hasChanges}
            >
              {t('usageLimits.discard')}
            </Button>
            <Button
              type="primary"
              onClick={() => void handleSave()}
              loading={saving}
              disabled={!hasChanges}
            >
              {t('usageLimits.save')}
            </Button>
          </Space>
        </div>
      </div>
    </Spin>
  )
}
