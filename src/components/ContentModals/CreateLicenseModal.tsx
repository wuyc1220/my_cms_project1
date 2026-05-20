/**
 * CreateLicenseModal - 新增许可证弹窗组件
 *
 * 功能：
 *  - 支持创建许可证
 *  - 平台选择与广告权利配置
 *  - 支持预填合同
 */

import { useEffect, useState } from 'react'
import {
  Checkbox,
  Col,
  DatePicker,
  Form,
  InputNumber,
  Modal,
  Row,
  Select,
  Switch,
  TimePicker,
  message,
} from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { createLicense } from '../../api/licenses'
import { getContractsSimple } from '../../api/contracts'
import TrimInput from '../TrimInput'
import { getDictTree } from '../../api/dicts'
import type { LicenseCreatePayload, LicensePlatformItem, ContractSimpleItem } from '../../types/trade'
import type { DictNodeListItem } from '../../types/dict'
import { useI18n } from '../../i18n/useI18n'
import { isHandledError } from '../../api'
import { useFormRules } from '../../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../../constants/form'


// ─── 组件 Props ──────────────────────────────────────────────────────────────

interface CreateLicenseModalProps {
  open: boolean
  /** 预填合同 */
  prefilledContract?: { id: number; name: string } | null
  onClose: () => void
  onSuccess: (license: { id: number; name: string }) => void
}

// ─── 表单值类型 ──────────────────────────────────────────────────────────────

interface LicenseFormValues {
  name: string
  contract_id: number
  service_type: string
  platform_items?: LicensePlatformItem[]
  regions?: string[]
  start_date?: dayjs.Dayjs
  end_date?: dayjs.Dayjs
  mobile_download?: boolean
  download_duration?: number
  mobile_preview?: boolean
  preview_begin_time?: dayjs.Dayjs
  preview_end_time?: dayjs.Dayjs
  notes?: string
}

export default function CreateLicenseModal({
  open,
  prefilledContract,
  onClose,
  onSuccess,
}: CreateLicenseModalProps) {
  const { t } = useI18n()
  const formRules = useFormRules()
  const [form] = Form.useForm<LicenseFormValues>()
  const [loading, setLoading] = useState(false)

  // 下拉选项
  const [serviceTypeOptions, setServiceTypeOptions] = useState<{ label: string; value: string }[]>([])
  const [platformOptions, setPlatformOptions] = useState<{ label: string; value: string }[]>([])
  const [regionOptions, setRegionOptions] = useState<{ label: string; value: string }[]>([])
  const [contractOptions, setContractOptions] = useState<{ label: string; value: number }[]>([])

  // 平台选择状态
  const [checkedPlatforms, setCheckedPlatforms] = useState<string[]>([])
  const [platformRights, setPlatformRights] = useState<Record<string, boolean>>({})

  // 表单监听
  const mobileDownload = Form.useWatch('mobile_download', form)
  const mobilePreview = Form.useWatch('mobile_preview', form)

  // ─── 初始化 ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      void loadOptions()
      form.resetFields()
      setCheckedPlatforms([])
      setPlatformRights({})
      if (prefilledContract) {
        form.setFieldsValue({ contract_id: prefilledContract.id })
      }
    }
  }, [open, prefilledContract, form])

  const loadOptions = async () => {
    try {
      const [dicts, contracts] = await Promise.all([
        getDictTree(),
        getContractsSimple(),
      ])

      const svcRoot = dicts.find((d: DictNodeListItem) => d.code === 'ServiceType')
      setServiceTypeOptions(
        (svcRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })),
      )

      const platRoot = dicts.find((d: DictNodeListItem) => d.code === 'Platform')
      setPlatformOptions(
        (platRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })),
      )

      const regRoot = dicts.find((d: DictNodeListItem) => d.code === 'Regions')
      setRegionOptions(
        (regRoot?.children ?? []).map((c: DictNodeListItem) => ({ label: c.name, value: c.code })),
      )

      setContractOptions(contracts.map((c: ContractSimpleItem) => ({ label: c.name, value: c.id })))
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('license.msg.initFailed'), 5)
    }
  }

  // ─── 平台操作 ──────────────────────────────────────────────────────────────

  const syncPlatformItemsToForm = (checked: string[], rights: Record<string, boolean>) => {
    form.setFieldValue(
      'platform_items',
      checked.map((p) => ({ platform: p, ad_rights: rights[p] ?? false })),
    )
  }

  const togglePlatform = (platform: string) => {
    setCheckedPlatforms((prev) => {
      const next = prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
      syncPlatformItemsToForm(next, platformRights)
      return next
    })
  }

  const handleSelectAll = (checked: boolean) => {
    const next = checked ? platformOptions.map((o) => o.value) : []
    setCheckedPlatforms(next)
    syncPlatformItemsToForm(next, platformRights)
  }

  const toggleAdRights = (platform: string, checked: boolean) => {
    setPlatformRights((prev) => {
      const next = { ...prev, [platform]: checked }
      syncPlatformItemsToForm(checkedPlatforms, next)
      return next
    })
  }

  // ─── 提交表单 ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const values = await form.validateFields()
    setLoading(true)
    try {
      const platformItems: LicensePlatformItem[] = (values.platform_items ?? []).map((p) => ({
        platform: p.platform,
        ad_rights: p.ad_rights ?? false,
      }))

      const payload: LicenseCreatePayload = {
        name: values.name,
        contract_id: values.contract_id,
        service_type: values.service_type,
        platforms: platformItems,
        regions: values.regions ?? [],
        start_date: values.start_date!.format('YYYY-MM-DD'),
        end_date: values.end_date!.format('YYYY-MM-DD'),
        mobile_download: values.mobile_download ?? false,
        download_duration: values.mobile_download ? values.download_duration : undefined,
        mobile_preview: values.mobile_preview ?? false,
        preview_begin_time: values.mobile_preview ? values.preview_begin_time?.format('HH:mm:ss') : undefined,
        preview_end_time: values.mobile_preview ? values.preview_end_time?.format('HH:mm:ss') : undefined,
        notes: values.notes,
      }

      const result = await createLicense(payload)
      void message.success(t('license.msg.created'), 3)
      onSuccess({ id: result.id, name: result.name })
      onClose()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('common.msg.createFailed'), 5)
    } finally {
      setLoading(false)
    }
  }

  const closeModal = () => {
    form.resetFields()
    setCheckedPlatforms([])
    setPlatformRights({})
    onClose()
  }

  // ─── JSX ────────────────────────────────────────────────────────────────────

  return (
    <Modal
      title={`${t('provider.tooltip.addContract')}${prefilledContract ? ` — ${prefilledContract.name}` : ''}`}
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
          {/* 许可证名称 */}
          <Col span={12}>
            <Form.Item
              name="name"
              label={t('license.search.name')}
              rules={[{ required: true, message: t('license.form.nameRequired') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
            >
              <TrimInput placeholder={t('license.placeholder.nameFrm')} style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          {/* 所属合同 */}
          <Col span={12}>
            <Form.Item
              name="contract_id"
              label={t('license.label.contract')}
              rules={[{ required: true, message: t('license.form.contractRequired') }]}
            >
              <Select
                showSearch
                allowClear
                placeholder={t('license.placeholder.contract')}
                options={contractOptions}
                filterOption={(input, option) =>
                  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>

          {/* 服务类型 */}
          <Col span={12}>
            <Form.Item
              name="service_type"
              label={t('license.search.serviceType')}
              rules={[{ required: true, message: t('license.form.serviceTypeRequired') }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                allowClear
                placeholder={t('license.placeholder.serviceType')}
                options={serviceTypeOptions}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>

          {/* 开始日期 */}
          <Col span={12}>
            <Form.Item
              name="start_date"
              label={t('content.col.startDate')}
              rules={[{ required: true, message: t('license.form.startRequired') }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          {/* 结束日期 */}
          <Col span={12}>
            <Form.Item
              name="end_date"
              label={t('content.col.endDate')}
              rules={[{ required: true, message: t('license.form.endRequired') }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          {/* 地区 */}
          <Col span={12}>
            <Form.Item name="regions" label={t('license.label.regions')}>
              <Select
                showSearch
                optionFilterProp="label"
                mode="multiple"
                allowClear
                placeholder={t('license.placeholder.regions')}
                options={regionOptions}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>

          {/* 平台 + 广告权利 */}
          <Col span={24}>
            <Form.Item name="platform_items" style={{ display: 'none' }}>
              <Select mode="multiple" />
            </Form.Item>

            <div style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 8, fontSize: 14, color: 'rgba(0,0,0,0.88)' }}>
                {t('license.label.platform')}
              </div>
              <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
                {/* 表头 */}
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
                        checkedPlatforms.length === platformOptions.length
                      }
                      indeterminate={
                        checkedPlatforms.length > 0 &&
                        checkedPlatforms.length < platformOptions.length
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>{t('provider.detail.platform')}</div>
                  <div style={{ width: 130, textAlign: 'center' }}>{t('license.label.adRights')}</div>
                </div>

                {/* 数据行 */}
                {platformOptions.map((opt, idx) => {
                  const p = opt.value
                  const selected = checkedPlatforms.includes(p)
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
                        {p}
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
                          onChange={(checked) => toggleAdRights(p, checked)}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Col>

          {/* 移动端可下载 */}
          <Col span={12}>
            <Form.Item name="mobile_download" label={t('license.label.mobileDownload')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>

          {/* 下载有效天数 */}
          {mobileDownload && (
            <Col span={12}>
              <Form.Item name="download_duration" label={t('license.label.downloadDuration')}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder={t('license.placeholder.days')} />
              </Form.Item>
            </Col>
          )}

          {/* 移动端可预览 */}
          <Col span={12}>
            <Form.Item name="mobile_preview" label={t('license.label.mobilePreview')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>

          {/* 预览开始时间 */}
          {mobilePreview && (
            <Col span={12}>
              <Form.Item
                name="preview_begin_time"
                label={t('license.label.previewBeginTime')}
                rules={[{ required: true, message: t('license.form.previewBeginRequired') }]}
              >
                <TimePicker format="HH:mm:ss" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          )}

          {/* 预览结束时间 */}
          {mobilePreview && (
            <Col span={12}>
              <Form.Item
                name="preview_end_time"
                label={t('license.label.previewEndTime')}
                dependencies={['preview_begin_time']}
                rules={[
                  { required: true, message: t('license.form.previewEndRequired') },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const beginTime = getFieldValue('preview_begin_time')
                      if (!value || !beginTime || value.isAfter(beginTime)) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error(t('license.form.previewEndTimeAfterBegin')))
                    },
                  }),
                ]}
              >
                <TimePicker format="HH:mm:ss" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          )}

          {/* 备注 */}
          <Col span={24}>
            <Form.Item name="notes" label={t('common.notes')} rules={[formRules.maxLength(FORM_MAX_LENGTH.TEXT_AREA)]}>
              <TrimInput.TextArea rows={3} placeholder={t('license.placeholder.notes')} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}
