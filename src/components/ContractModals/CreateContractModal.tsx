/**
 * CreateContractModal - 新增合同弹窗组件
 */

import { useEffect, useState } from 'react'
import {
  Checkbox,
  Col,
  DatePicker,
  Form,
  Modal,
  Row,
  Select,
  Switch,
  message,
} from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { createContract } from '../../api/contracts'
import TrimInput from '../TrimInput'
import type {
  ContractCreatePayload,
  ContractPlatformItem,
} from '../../types/trade'
import { useI18n } from '../../i18n/useI18n'
import { isHandledError } from '../../api'
import { useFormRules } from '../../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../../constants/form'


interface CreateContractModalProps {
  open: boolean
  platformOptions: { label: string; value: string }[]
  /** 预填供应商（从 ProviderManagement 点击时传入） */
  prefilledProvider?: { id: number; name: string } | null
  /** 供应商下拉选项（从 ContractManagement 使用时需要） */
  providerOptions?: { label: string; value: number }[]
  onClose: () => void
  onSuccess: () => void
}

interface ContractFormValues {
  name: string
  provider_id?: number
  selected_platforms: string[]
  start_date?: dayjs.Dayjs
  end_date?: dayjs.Dayjs
  notes?: string
}

export default function CreateContractModal({
  open,
  platformOptions,
  prefilledProvider,
  providerOptions,
  onClose,
  onSuccess,
}: CreateContractModalProps) {
  const { t } = useI18n()
  const formRules = useFormRules()
  const [form] = Form.useForm<ContractFormValues>()
  const [loading, setLoading] = useState(false)
  const [platformRights, setPlatformRights] = useState<Record<string, boolean>>({})

  const watchedPlatforms: string[] = Form.useWatch('selected_platforms', form) ?? []

  useEffect(() => {
    if (open) {
      form.resetFields()
      setPlatformRights({})
      if (prefilledProvider) {
        form.setFieldsValue({ provider_id: prefilledProvider.id })
      }
    }
  }, [open, prefilledProvider, form])

  const handlePlatformChange = (values: string[]) => {
    setPlatformRights((prev) => {
      const next: Record<string, boolean> = {}
      values.forEach((p) => {
        next[p] = prev[p] ?? false
      })
      return next
    })
  }

  const togglePlatform = (platform: string) => {
    const current = (form.getFieldValue('selected_platforms') as string[]) ?? []
    const next = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform]
    form.setFieldValue('selected_platforms', next)
    handlePlatformChange(next)
  }

  const handleSelectAllPlatforms = (checked: boolean) => {
    const next = checked ? platformOptions.map((o) => o.value) : []
    form.setFieldValue('selected_platforms', next)
    handlePlatformChange(next)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    setLoading(true)
    try {
      const platforms: ContractPlatformItem[] = (values.selected_platforms ?? []).map((p) => ({
        platform: p,
        commercial_rights: platformRights[p] ?? false,
      }))
      const providerId = prefilledProvider?.id ?? values.provider_id
      if (!providerId) {
        void form.setFields([{ name: 'provider_id', errors: [t('contract.form.providerRequired')] }])
        setLoading(false)
        return
      }
      const payload: ContractCreatePayload = {
        name: values.name,
        provider_id: providerId,
        platforms,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : undefined,
        notes: values.notes ?? undefined,
      }
      await createContract(payload)
      void message.success(t('contract.msg.created'), 3)
      onSuccess()
      onClose()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('common.msg.createFailed'), 5)
    } finally {
      setLoading(false)
    }
  }

  const showProviderSelect = !prefilledProvider && providerOptions && providerOptions.length > 0

  return (
    <Modal
      title={`${t('provider.tooltip.addContract')}${prefilledProvider ? ` — ${prefilledProvider.name}` : ''}`}
      open={open}
      onCancel={onClose}
      onOk={() => void handleSubmit()}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      confirmLoading={loading}
      destroyOnHidden
      width={700}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="name"
              label={t('contract.search.name')}
              rules={[
                { required: true, message: t('contract.form.nameRequired') },
                formRules.maxLength(FORM_MAX_LENGTH.INPUT),
                {
                  validator: (_, value) => {
                    if (value && value.trim() === '') {
                      return Promise.reject(new Error(t('contract.form.nameWhitespace')))
                    }
                    return Promise.resolve()
                  },
                },
              ]}
            >
              <TrimInput placeholder={t('contract.placeholder.name')} style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          {/* 供应商选择（如果没有预填供应商则显示） */}
          {showProviderSelect && (
            <Col span={12}>
              <Form.Item
                name="provider_id"
                label={t('contract.search.provider')}
                rules={[{ required: true, message: t('contract.form.providerRequired') }]}
              >
                <Select
                  allowClear
                  showSearch
                  placeholder={t('contract.placeholder.provider')}
                  options={providerOptions}
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          )}

          <Col span={24}>
            <Form.Item name="selected_platforms" style={{ display: 'none' }}>
              <Select mode="multiple" />
            </Form.Item>

            <div style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 8, fontSize: 14, color: 'rgba(0,0,0,0.88)' }}>
                {t('contract.label.platform')}
              </div>
              <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '9px 16px',
                    background: '#fafafa',
                    borderBottom: '1px solid #d9d9d9',
                    fontWeight: 600,
                    fontSize: 13,
                    color: '#262626',
                  }}
                >
                  <div style={{ width: 36 }}>
                    <Checkbox
                      checked={
                        platformOptions.length > 0 &&
                        watchedPlatforms.length === platformOptions.length
                      }
                      indeterminate={
                        watchedPlatforms.length > 0 &&
                        watchedPlatforms.length < platformOptions.length
                      }
                      onChange={(e) => handleSelectAllPlatforms(e.target.checked)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>{t('provider.detail.platform')}</div>
                  <div style={{ width: 130, textAlign: 'center' }}>{t('contract.label.commercialRights')}</div>
                </div>

                {platformOptions.map((opt, idx) => {
                  const p = opt.value
                  const selected = watchedPlatforms.includes(p)
                  const hasRights = platformRights[p] ?? false
                  return (
                    <div
                      key={p}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 16px',
                        borderBottom:
                          idx < platformOptions.length - 1 ? '1px solid #f0f0f0' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        background: selected ? '#fff' : '#fafafa',
                      }}
                      onClick={() => togglePlatform(p)}
                    >
                      <div style={{ width: 36 }}>
                        <Checkbox
                          checked={selected}
                          onChange={() => togglePlatform(p)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div
                        style={{
                          flex: 1,
                          fontSize: 13,
                          color: selected ? '#262626' : '#8c8c8c',
                          transition: 'color 0.15s',
                        }}
                      >
                        {opt.label}
                      </div>
                      <div
                        style={{ width: 130, textAlign: 'center' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Switch
                          checked={hasRights}
                          disabled={!selected}
                          checkedChildren={<CheckOutlined />}
                          unCheckedChildren={<CloseOutlined />}
                          onChange={(checked) =>
                            setPlatformRights((prev) => ({ ...prev, [p]: checked }))
                          }
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Col>

          <Col span={12}>
            <Form.Item
              name="start_date"
              label={t('content.col.startDate')}
              rules={[{ required: true, message: t('contract.form.startRequired') }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="end_date"
              label={t('content.col.endDate')}
              dependencies={['start_date']}
              rules={[
                { required: true, message: t('contract.form.endRequired') },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const startDate = getFieldValue('start_date')
                    if (!value || !startDate || value.isAfter(startDate) || value.isSame(startDate, 'day')) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error(t('contract.form.endDateAfterStart')))
                  },
                }),
              ]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item name="notes" label={t('common.notes')} rules={[formRules.maxLength(FORM_MAX_LENGTH.TEXT_AREA)]}>
              <TrimInput.TextArea rows={3} placeholder={t('contract.placeholder.notes')} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}
