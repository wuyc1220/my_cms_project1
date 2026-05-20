/**
 * ChangePasswordModal — 修改密码弹框
 */

import { useState, useEffect } from 'react'
import {
  Button,
  Form,
  Modal,
  Space,
  message,
} from 'antd'
import { changePassword } from '../api/auth'
import { getPasswordMinLength } from '../api/configs'
import { useI18n } from '../i18n/useI18n'
import { isHandledError } from '../api'
import TrimInput from './TrimInput'


interface ChangePasswordModalProps {
  open: boolean
  onClose: () => void
}

interface FormValues {
  old_password: string
  new_password: string
  confirm_password: string
}

export default function ChangePasswordModal({
  open,
  onClose,
}: ChangePasswordModalProps) {
  const { t } = useI18n()
  const [form] = Form.useForm<FormValues>()
  const [loading, setLoading] = useState(false)
  const [minLength, setMinLength] = useState(8)

  // 获取密码最小长度配置
  useEffect(() => {
    if (open) {
      void getPasswordMinLength().then(setMinLength)
    }
  }, [open])

  // 根据后端错误关键词获取国际化文本
  const getLocalizedError = (detail: string, _fieldName: 'old_password' | 'new_password' | 'confirm_password'): string => {
    // 旧密码错误
    if (detail.includes('旧密码错误')) {
      return t('changePassword.errors.oldPasswordIncorrect')
    }
    // 两次输入不一致
    if (detail.includes('两次输入')) {
      return t('changePassword.confirmPasswordMismatch')
    }
    // 新密码与旧密码相同
    if (detail.includes('新密码不能与旧密码相同')) {
      return t('changePassword.errors.sameAsOld')
    }
    // 密码长度
    if (detail.includes('密码长度') || detail.includes('少于')) {
      return t('changePassword.rules.minLength')
    }
    // 复杂度
    if (detail.includes('至少3种')) {
      return t('changePassword.rules.complexity')
    }
    // 连续重复字符
    if (detail.includes('连续重复')) {
      return t('changePassword.rules.noRepeat')
    }
    // 连续序列
    if (detail.includes('连续的字符序列')) {
      return t('changePassword.rules.noSequence')
    }
    // 与账号相同
    if (detail.includes('与账号相同')) {
      return t('changePassword.rules.notUsername')
    }
    // 常见单词
    if (detail.includes('常见单词') || detail.includes('常见英文单词') || detail.includes('拼音')) {
      return t('changePassword.rules.notCommon')
    }
    // 键盘序列
    if (detail.includes('键盘序列')) {
      return t('changePassword.rules.notKeyboard')
    }
    // 默认返回原始错误
    return detail
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      await changePassword({
        old_password: values.old_password,
        new_password: values.new_password,
        confirm_password: values.confirm_password,
      })
      void message.success(t('changePassword.success'))
      form.resetFields()
      onClose()
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const error = err as { response?: { data?: { detail?: string } } }
      const detail = error.response?.data?.detail
      if (detail) {
        // 根据错误信息判断是哪个字段的问题
        if (detail.includes('旧密码错误')) {
          form.setFields([
            {
              name: 'old_password',
              errors: [getLocalizedError(detail, 'old_password')],
            },
          ])
        } else if (detail.includes('两次输入')) {
          form.setFields([
            {
              name: 'confirm_password',
              errors: [getLocalizedError(detail, 'confirm_password')],
            },
          ])
        } else {
          // 其他密码验证错误显示在新密码字段下方
          form.setFields([
            {
              name: 'new_password',
              errors: [getLocalizedError(detail, 'new_password')],
            },
          ])
        }
      } else {
        void message.error(t('changePassword.failed'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    form.resetFields()
    onClose()
  }

  // 验证密码长度
  const validatePasswordLength = (_: unknown, value: string) => {
    if (value && value.length < minLength) {
      return Promise.reject(new Error(t('changePassword.rules.minLength')))
    }
    return Promise.resolve()
  }

  // 验证重复密码与新密码是否一致
  const validateConfirmPassword = (_: unknown, value: string) => {
    const newPassword = form.getFieldValue('new_password')
    if (value && newPassword && value !== newPassword) {
      return Promise.reject(new Error(t('changePassword.confirmPasswordMismatch')))
    }
    return Promise.resolve()
  }

  return (
    <Modal
      title={t('changePassword.title')}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={480}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="old_password"
          label={t('changePassword.oldPassword')}
          rules={[
            { required: true, message: t('changePassword.oldPasswordRequired') },
          ]}
        >
          <TrimInput.Password
            placeholder={t('changePassword.oldPasswordPlaceholder')}
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="new_password"
          label={t('changePassword.newPassword')}
          rules={[
            { required: true, message: t('changePassword.newPasswordRequired') },
            { validator: validatePasswordLength },
          ]}
        >
          <TrimInput.Password
            placeholder={t('changePassword.newPasswordPlaceholder')}
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="confirm_password"
          label={t('changePassword.confirmPassword')}
          rules={[
            { required: true, message: t('changePassword.confirmPasswordRequired') },
            { validator: validateConfirmPassword },
          ]}
        >
          <TrimInput.Password
            placeholder={t('changePassword.confirmPasswordPlaceholder')}
            size="large"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button type="primary" loading={loading} onClick={handleSubmit}>
              {t('common.confirm')}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
