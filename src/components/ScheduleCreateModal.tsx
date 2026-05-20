/**
 * ScheduleCreateModal — 新增节目单弹框（公共组件）
 *
 * 用于三个入口：
 *  1. 节目单管理页（可选择频道）
 *  2. 频道列表页操作栏（频道只读）
 *  3. 频道详情页 Schedule Tab（频道只读）
 */

import { useState } from 'react'
import {
  Col,
  DatePicker,
  Form,
  message,
  Modal,
  Row,
  Select,
} from 'antd'
import { useI18n } from '../i18n/useI18n'
import { useFormRules } from '../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../constants/form'
import { createSchedule, getChannelsSimple } from '../api/live'
import { getAuthUsers } from '../api/dataAuth'
import { useAuthStore } from '../stores/authStore'
import TrimInput from './TrimInput'
import type { ScheduleCreatePayload } from '../types/live'
import type { ContentSimpleItem } from '../types/content'
import type { UserSimpleItem } from '../types/dataAuth'
import { isHandledError } from '../api'


interface ScheduleCreateModalProps {
  open: boolean
  /** 预设频道ID，传入则频道只读 */
  channelId?: number
  /** 预设频道名称，channelId 存在时必传 */
  channelName?: string
  onClose: () => void
  /** 创建成功回调 */
  onSuccess?: () => void
}

export default function ScheduleCreateModal({
  open,
  channelId,
  channelName,
  onClose,
  onSuccess,
}: ScheduleCreateModalProps) {
  const { t } = useI18n()
  const formRules = useFormRules()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [channels, setChannels] = useState<ContentSimpleItem[]>([])
  const [userOptions, setUserOptions] = useState<{ label: string; value: number }[]>([])
  const { user: currentUser } = useAuthStore()

  // 是否为频道只读模式（从频道页发起）
  const isChannelReadOnly = !!channelId

  // 加载频道列表（如果不是频道只读模式）
  const loadChannels = async () => {
    try {
      const data = await getChannelsSimple()
      setChannels(data)
    } catch (err) {
      // 不阻塞
    }
  }

  // 加载用户列表（用于任务分配）
  const loadUsers = async () => {
    try {
      const users = await getAuthUsers()
      const options = users.map((u: UserSimpleItem) => ({
        label: u.display_name ? `${u.display_name}（${u.username}）` : u.username,
        value: u.id,
      }))
      setUserOptions(options)
      // 默认选中当前登录用户
      if (currentUser?.id) {
        form.setFieldsValue({ assign_to: currentUser.id })
      }
    } catch (err) {
      setUserOptions([])
    }
  }

  // 弹框打开时初始化
  const handleAfterOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      form.resetFields()
      if (channelId) {
        form.setFieldsValue({ parent_id: channelId })
      }
      // 加载用户列表
      void loadUsers()
      // 如果不是频道只读模式，加载频道列表
      if (!channelId && channels.length === 0) {
        void loadChannels()
      }
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      const payload: ScheduleCreatePayload = {
        title: values.title,
        parent_id: isChannelReadOnly ? channelId! : values.parent_id,
        begin_time: values.begin_time.toISOString(),
        end_time: values.end_time.toISOString(),
        assign_to: values.assign_to ?? null,
      }
      await createSchedule(payload)
      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const detail = ((err as { response?: { data?: { detail?: string } } }).response?.data?.detail)
      if (detail) void message.error(detail, 5)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={t('live.schedule.modal.titleNew')}
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      confirmLoading={loading}
      destroyOnHidden
      width={640}
      afterOpenChange={handleAfterOpenChange}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="title"
              label={t('live.schedule.form.programName')}
              rules={[{ required: true, message: t('live.schedule.form.programNameRequired') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}
            >
              <TrimInput placeholder={t('common.placeholder.enter')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('live.schedule.form.contentType')}>
              <TrimInput value="SCHEDULE" disabled />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="begin_time"
              label={t('common.col.beginTime')}
              rules={[{ required: true, message: t('live.schedule.form.beginTimeRequired') }]}
            >
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="end_time"
              label={t('common.col.endTime')}
              rules={[{ required: true, message: t('live.schedule.form.endTimeRequired') }]}
            >
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name={isChannelReadOnly ? undefined : 'parent_id'}
              label={t('live.schedule.form.channelName')}
              rules={isChannelReadOnly ? undefined : [{ required: true, message: t('live.schedule.form.channelRequired') }]}
            >
              {isChannelReadOnly ? (
                <TrimInput value={channelName ?? ''} disabled />
              ) : (
                <Select
                  placeholder={t('common.placeholder.selectChannel')}
                  options={channels.map((c) => ({ label: c.title, value: c.id }))}
                  showSearch
                  filterOption={(inp, opt) =>
                    (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())
                  }
                  style={{ width: '100%' }}
                />
              )}
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="assign_to"
              label={t('live.schedule.form.assignTo')}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={t('common.placeholder.select')}
                style={{ width: '100%' }}
                allowClear
                options={userOptions}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}
