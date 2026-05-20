/**
 * EditContractModal - 编辑合同弹窗组件
 */

import { useEffect, useState } from 'react'
import {
  Button,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tooltip,
  message,
} from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { updateContract, deleteContract, getContractLicenses } from '../../api/contracts'
import TrimInput from '../TrimInput'
import type {
  ContractListItem,
  ContractCreatePayload,
  ContractPlatformItem,
  LicenseSimpleItem,
} from '../../types/trade'
import { useI18n } from '../../i18n/useI18n'
import { usePermission } from '../../hooks/usePermission'
import { useFormRules } from '../../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../../constants/form'

interface EditContractModalProps {
  open: boolean
  contract: ContractListItem | null
  platformOptions: { label: string; value: string }[]
  onClose: () => void
  onSuccess: () => void
  onDelete?: () => void
  /** 是否显示删除按钮 */
  showDelete?: boolean
  /** 是否显示添加内容按钮 */
  showAddContent?: boolean
  /** 点击添加内容回调 */
  onAddContent?: (contract: ContractListItem) => void
  /** 点击详情回调 */
  onDetail?: (contract: ContractListItem) => void
  /** 点击附件回调 */
  onAttachments?: (contract: ContractListItem) => void
}

interface ContractFormValues {
  name: string
  selected_platforms: string[]
  start_date?: dayjs.Dayjs
  end_date?: dayjs.Dayjs
  notes?: string
}

export default function EditContractModal({
  open,
  contract,
  platformOptions,
  onClose,
  onSuccess,
  onDelete,
  showDelete = true,
  showAddContent = true,
  onAddContent,
  onDetail,
  onAttachments,
}: EditContractModalProps) {
  const { t } = useI18n()
  const formRules = useFormRules()
  const [form] = Form.useForm<ContractFormValues>()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [platformRights, setPlatformRights] = useState<Record<string, boolean>>({})
  const [licenses, setLicenses] = useState<LicenseSimpleItem[]>([])

  const watchedPlatforms: string[] = Form.useWatch('selected_platforms', form) ?? []

  const { hasPermission } = usePermission()
  const canOperateContract = hasPermission('menu.trade.contracts.operate')

  useEffect(() => {
    if (open && contract) {
      const selectedPlatforms = contract.platforms.map((p) => p.platform)
      const rights: Record<string, boolean> = {}
      contract.platforms.forEach((p) => {
        rights[p.platform] = p.commercial_rights
      })
      setPlatformRights(rights)
      form.setFieldsValue({
        name: contract.name,
        selected_platforms: selectedPlatforms,
        start_date: contract.start_date ? dayjs(contract.start_date) : undefined,
        end_date: contract.end_date ? dayjs(contract.end_date) : undefined,
        notes: contract.notes ?? undefined,
      })
      // 加载许可证列表用于判断是否可删除
      getContractLicenses(contract.id).then(setLicenses).catch(() => {})
    }
  }, [open, contract, form])

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
    if (!contract) return
    const values = await form.validateFields()
    setLoading(true)
    try {
      const platforms: ContractPlatformItem[] = (values.selected_platforms ?? []).map((p) => ({
        platform: p,
        commercial_rights: platformRights[p] ?? false,
      }))
      const payload: ContractCreatePayload = {
        name: values.name,
        provider_id: contract.provider_id,
        platforms,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : undefined,
        notes: values.notes ?? undefined,
      }
      await updateContract(contract.id, payload)
      void message.success(t('contract.msg.updated'), 3)
      onSuccess()
      onClose()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('common.msg.updateFailed'), 5)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!contract) return
    setDeleting(true)
    try {
      await deleteContract(contract.id)
      void message.success(t('provider.detail.msgContractDeleted'), 3)
      onDelete?.()
      onClose()
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('provider.detail.msgContractDeleteFailed'), 5)
    } finally {
      setDeleting(false)
    }
  }

  const canDelete = (licenses?.length ?? 0) === 0

  return (
    <Modal
      title={t('contract.modal.titleEdit')}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={680}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={24}>
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

          <Col span={24}>
            <Form.Item name="selected_platforms" style={{ display: 'none' }}>
              <Select showSearch optionFilterProp="label" mode="multiple" />
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
              rules={[{ required: true, message: t('contract.form.endRequired') }]}
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

      {/* 底部操作按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <Space>
          {contract && onDetail && (
            <Tooltip title={t('common.detail')}>
              <Button icon={<InfoCircleOutlined />} onClick={() => onDetail(contract)} />
            </Tooltip>
          )}
          {contract && showAddContent && onAddContent && (
            <Tooltip title={t('contract.tooltip.addContent')}>
              <Button icon={<PlusOutlined />} onClick={() => onAddContent(contract)} />
            </Tooltip>
          )}
          {contract && onAttachments && (
            <Tooltip title={t('contract.tooltip.attachments')}>
              <Button icon={<DownloadOutlined />} onClick={() => onAttachments(contract)} />
            </Tooltip>
          )}
          {canOperateContract && showDelete && (
            <Popconfirm
              title={t('contract.confirmDelete', { name: contract?.name ?? '' })}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              onConfirm={() => void handleDelete()}
              disabled={!canDelete}
            >
              <Tooltip
                title={
                  !canDelete
                    ? t('contract.tooltip.cannotDeleteWithLicenses')
                    : t('common.delete')
                }
              >
                <Button icon={<DeleteOutlined />} danger disabled={!canDelete} loading={deleting} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
        <Space>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          {canOperateContract && (
            <Button type="primary" loading={loading} onClick={() => void handleSubmit()}>
              {t('common.confirm')}
            </Button>
          )}
        </Space>
      </div>
    </Modal>
  )
}

import { Popconfirm } from 'antd'
import { isHandledError } from '../../api'

