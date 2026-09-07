import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  Form,
  Modal,
  Space,
  message,
} from 'antd'
import { changePassword, logout } from '../api/auth'
import { getPasswordPatternMinLen } from '../api/configs'
import { useI18n } from '../i18n/useI18n'
import { useAuthStore } from '../stores/authStore'
import { isHandledError } from '../api'
import TrimInput from './TrimInput'
import { validatePassword, PASSWORD_ERROR_I18N_KEYS } from '../utils/passwordValidation'

interface ChangePasswordModalProps {
  open: boolean
  onClose: () => void
  forceMode?: boolean
  onSuccess?: () => void
}

interface FormValues {
  old_password: string
  new_password: string
  confirm_password: string
}

export default function ChangePasswordModal({
  open,
  onClose,
  forceMode = false,
  onSuccess,
}: ChangePasswordModalProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const authStore = useAuthStore()
  const [form] = Form.useForm<FormValues>()
  const [loading, setLoading] = useState(false)
  const patternMinLenRef = useRef(6)

  useEffect(() => {
    if (!open) return
    getPasswordPatternMinLen()
      .then((v) => {
        patternMinLenRef.current = v
      })
      .catch(() => {
        // 获取配置失败时保持默认值 6
      })
  }, [open])

  const handleSubmit = async () => {
    let values: FormValues
    try {
      values = await form.validateFields()
    } catch {
      // 表单校验失败，错误已显示在对应字段上，无需额外提示
      return
    }
    setLoading(true)
    try {
      await changePassword({
        old_password: values.old_password,
        new_password: values.new_password,
        confirm_password: values.confirm_password,
      })
      void message.success(t('changePassword.success'))
      form.resetFields()
      onSuccess?.()
      // 修改密码成功后登出并跳转到登录页
      try {
        await logout()
      } catch {
        // 后端登出失败也继续清理本地状态
      }
      authStore.logout()
      navigate('/login', { replace: true })
    } catch (err: unknown) {
      if (isHandledError(err)) return
      const error = err as { response?: { data?: { error_code?: string; detail?: string } } }
      const errorCode = error.response?.data?.error_code
      const detail = error.response?.data?.detail
      if (errorCode === 'OLD_PASSWORD_INCORRECT') {
        form.setFields([
          { name: 'old_password', errors: [detail ?? ''] },
        ])
      } else if (errorCode === 'PASSWORDS_DO_NOT_MATCH') {
        form.setFields([
          { name: 'confirm_password', errors: [t('changePassword.confirmPasswordMismatch')] },
        ])
      } else if (detail) {
        form.setFields([
          { name: 'new_password', errors: [detail] },
        ])
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

  const validateNewPassword = (_: unknown, value: string) => {
    if (!value) return Promise.resolve()
    const errorCode = validatePassword(value, { username: authStore.user?.username, patternMinLen: patternMinLenRef.current })
    if (errorCode) {
      return Promise.reject(new Error(t(PASSWORD_ERROR_I18N_KEYS[errorCode])))
    }
    return Promise.resolve()
  }

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
      closable={forceMode}
      mask={{ closable: !forceMode }}
      onCancel={handleClose}
      footer={null}
      width={480}
      destroyOnHidden
    >
      {forceMode && (
        <Alert
          type="warning"
          showIcon
          message={t('changePassword.forceChangeHint')}
          style={{ marginBottom: 16 }}
        />
      )}
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
              { validator: validateNewPassword },
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
          dependencies={['new_password']}
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
