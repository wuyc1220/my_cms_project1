import { useEffect, useState } from 'react'
import { Form, Button, Card, Typography, Row, Col, message } from 'antd'
import { useNavigate, Navigate } from 'react-router-dom'
import { login as loginApi, getCaptcha } from '../api/auth'
import { useAuthStore, getFirstMenuPath } from '../stores/authStore'
import { useI18n } from '../i18n/useI18n'
import { isHandledError } from '../api'
import TrimInput from '../components/TrimInput'


const { Title } = Typography

interface LoginFormValues {
  username: string
  password: string
  captcha: string
}

export default function Login() {
  const navigate = useNavigate()
  const { isLoggedIn, login, loadCurrentUser, logout } = useAuthStore()
  const { t } = useI18n()
  const [captchaId, setCaptchaId] = useState('')
  const [captchaImage, setCaptchaImage] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm<LoginFormValues>()

  // 获取验证码
  const fetchCaptcha = async () => {
    try {
      const { captchaId: id, imageBlob } = await getCaptcha()
      setCaptchaId(id)
      // 创建图片URL
      const imageUrl = URL.createObjectURL(imageBlob)
      setCaptchaImage(imageUrl)
    } catch (err) {
      if (isHandledError(err)) return
      void message.error(t('login.captchaError'))
    }
  }

  useEffect(() => {
    if (!isLoggedIn) {
      void fetchCaptcha()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

  // 清理图片URL
  useEffect(() => {
    return () => {
      if (captchaImage) {
        URL.revokeObjectURL(captchaImage)
      }
    }
  }, [captchaImage])

  // 已登录用户访问 /login 时，交由首页重定向逻辑跳转到第一个有权限的页面
  if (isLoggedIn) return <Navigate to="/" replace />

  const handleSubmit = async (values: LoginFormValues) => {
    if (!captchaId) {
      void message.error(t('login.captchaRequired'))
      return
    }

    setLoading(true)
    try {
      const data = await loginApi(values.username, values.password, captchaId, values.captcha)
      login(data.access_token, {
        id: 0,
        username: data.username,
        display_name: data.display_name,
        status: 'active',
        role_codes: [],
      })
      await loadCurrentUser()
      await useAuthStore.getState().loadMenus()
      const { menus, menusLoaded } = useAuthStore.getState()
      const firstPath = getFirstMenuPath(menus)
      if (menusLoaded && !firstPath) {
        // 未分配任何页面菜单权限：提示并留在登录页
        void message.error(t('login.noMenuPermission'))
        logout()
        void fetchCaptcha()
        form.setFieldValue('captcha', '')
        return
      }
      // 有权限则进入第一个页面；菜单加载失败时进入首页由重定向逻辑兜底重试
      navigate(firstPath || '/', { replace: true })
    } catch (err) {
      if (!isHandledError(err)) {
        const error = err as { response?: { data?: { detail?: string } } }
        const detail = error.response?.data?.detail
        void message.error(detail || t('login.failed'))
      }
      void fetchCaptcha()
      form.setFieldValue('captcha', '')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
      }}
    >
      <Card style={{ width: 400 }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          {t('login.title')}
        </Title>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="username" rules={[{ required: true, message: t('login.usernameRequired') }]}>
            <TrimInput placeholder={t('login.usernamePlaceholder')} size="large" maxLength={100} />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: t('login.passwordRequired') }]}>
            <TrimInput.Password placeholder={t('login.passwordPlaceholder')} size="large" />
          </Form.Item>
          <Form.Item
            name="captcha"
            rules={[{ required: true, message: t('login.captchaRequired') }]}
          >
            <Row gutter={12}>
              <Col flex="auto">
                <TrimInput placeholder={t('login.captchaPlaceholder')} size="large" maxLength={100} />
              </Col>
              <Col>
                <img
                  src={captchaImage}
                  alt="captcha"
                  onClick={fetchCaptcha}
                  style={{
                    height: 40,
                    cursor: 'pointer',
                    borderRadius: 4,
                  }}
                  title={t('login.captchaRefresh')}
                />
              </Col>
            </Row>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              {t('login.submit')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
