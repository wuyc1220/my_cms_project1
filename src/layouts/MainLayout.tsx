import { useState, useEffect, useMemo } from 'react'
import {Layout, Menu, Dropdown, Button, Typography, Modal, Tooltip} from 'antd'
import { Outlet, useNavigate, useLocation, useNavigationType } from 'react-router-dom'
import {
  MenuFoldOutlined, MenuUnfoldOutlined, DownOutlined, ReloadOutlined, ArrowLeftOutlined,
} from '@ant-design/icons'
import type { MessageKey } from '../i18n/messages'
import { logout as logoutApi, getSessionTimeout } from '../api/auth'
import { useAuthStore } from '../stores/authStore'
import { useI18n } from '../i18n/useI18n'
import ChangePasswordModal from '../components/ChangePasswordModal'
import GlobalSearch from '../components/GlobalSearch'
import { useIdleTimeout } from '../hooks/useIdleTimeout'
import { getIcon } from '../constants/iconMap'
import type { MenuItem } from '../types/menu'

// 根据 pathname 从菜单树中递归查找 i18n_key
function findMenuI18nKey(pathname: string, menus: MenuItem[]): string | null {
  for (const menu of menus) {
    if (menu.path === pathname) return menu.i18n_key
    if (menu.children) {
      const found = findMenuI18nKey(pathname, menu.children)
      if (found) return found
    }
  }
  return null
}

const { Header, Sider, Content } = Layout
const { Text } = Typography

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [openKeys, setOpenKeys] = useState<string[]>([])
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [forceChangePasswordOpen, setForceChangePasswordOpen] = useState(false)
  const [sessionTimeout, setSessionTimeout] = useState(30)
  const [refreshKey, setRefreshKey] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const navigationType = useNavigationType()
  const { user, logout, isLoggedIn, menus } = useAuthStore()
  const { t } = useI18n()

  // 页面标题：根据当前 pathname 从菜单中匹配 i18n_key
  const pageTitle = useMemo(() => {
    if (!menus.length) return ''

    // 精确匹配（列表页等）
    const exactKey = findMenuI18nKey(location.pathname, menus)
    if (exactKey) return t(exactKey as MessageKey)

    // 详情页：路径以数字 ID 结尾
    if (/\/\d+$/.test(location.pathname)) {
      const parentPath = location.pathname.replace(/\/\d+$/, '')
      const parentKey = findMenuI18nKey(parentPath, menus)
      if (parentKey) {
        const menuTitle = t(parentKey as MessageKey)
        const detailTitle = menuTitle.replace(/管理$| Management$/i, '')
        const separator = /[a-zA-Z]$/.test(detailTitle) ? ' ' : ''
        return `${detailTitle}${separator}${t('common.detail')}`
      }
    }

    // 兜底：部分详情页不在菜单树中
    if (location.pathname.startsWith('/contents/')) {
      return t('trade.content.detail.pageTitle')
    }
    if (location.pathname.startsWith('/workflow/editor/')) {
      return t('menu.workflow.processConfig')
    }

    return ''
  }, [location.pathname, menus, t])

  // 加载菜单数据
  useEffect(() => {
    if (isLoggedIn && menus.length === 0) {
      void useAuthStore.getState().loadMenus()
    }
  }, [isLoggedIn, menus.length])

  // 将后端菜单数据转换为 Ant Design Menu 的 items 格式
  const menuItems = useMemo(() => {
      const convertMenu = (items: MenuItem[]): NonNullable<Parameters<typeof Menu>[0]['items']> => {
          return items
              .filter((item) => item.menu_type !== 'permission')
              .map((item) => {
                  const key = item.path || String(item.id)
                  const labelText = t(item.i18n_key as Parameters<typeof t>[0])
                  const filteredChildren = item.children?.filter((c) => c.menu_type !== 'permission') || []
                  if (filteredChildren.length > 0) {
                      return {
                          key,
                          icon: getIcon(item.icon),
                          label: (
                              <Tooltip placement="right" title={labelText}>
                                  <span>{labelText}</span>
                              </Tooltip>
                          ),
                          children: convertMenu(item.children!),
                      }
                  }
                  return {
                      key,
                      icon: getIcon(item.icon),
                      label: (
                          <Tooltip placement="right" title={labelText}>
                              <span>{labelText}</span>
                          </Tooltip>
                      ),
                  }
              })
      }
    return convertMenu(menus)
  }, [menus, t])

  const handleLogout = async () => {
    try { await logoutApi() } catch (err) { /* ignore */ }
    logout()
    navigate('/login', { replace: true })
  }

  // 获取会话超时配置
  useEffect(() => {
    if (isLoggedIn) {
      void getSessionTimeout().then(setSessionTimeout)
    }
  }, [isLoggedIn])

  // 空闲超时检测
  useIdleTimeout({
    timeoutMinutes: sessionTimeout,
    enabled: isLoggedIn,
  })

  // 检查是否需要强制修改密码
  useEffect(() => {
    if (user?.force_change_password && isLoggedIn) {
      // 检查是否是从登录页面跳转过来的
      const state = location.state as { forceChangePassword?: boolean } | null
      if (state?.forceChangePassword || navigationType === 'PUSH') {
        setForceChangePasswordOpen(true)
      }
    }
  }, [user, isLoggedIn, location.state, navigationType])

  // 强制修改密码弹框关闭处理
  // @ts-ignore
  const handleForceChangePasswordClose = () => {
    // 不允许关闭，必须修改密码
  }

  // 强制修改密码成功后的处理
  const handleForceChangePasswordSuccess = () => {
    setForceChangePasswordOpen(false)
    // 更新用户状态
    if (user) {
      user.force_change_password = false
    }
  }

  const handleOpenChange = (keys: string[]) => {
    const latestOpenKey = keys.find((key) => !openKeys.includes(key))
    setOpenKeys(latestOpenKey ? [latestOpenKey] : [])
  }

  const userMenu = {
    items: [
      {
        key: 'change-pwd',
        label: t('common.changePassword'),
        onClick: () => setChangePasswordOpen(true),
      },
      { key: 'logout', label: t('common.logout'), onClick: handleLogout },
    ],
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 顶部 Header：横跨整个页面宽度 */}
      <Header
        style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          borderBottom: '1px solid #f0f0f0',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          height: 64,
        }}
      >
        {/* 左侧 Logo / 平台名称：始终显示，不随 Sider 折叠隐藏 */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 600,
            fontSize: 16,
            color: '#1f1f1f',
            whiteSpace: 'nowrap',
          }}
          title={t('app.title')}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <span>{t('app.title')}</span>
        </div>
        {/* 中间 全局搜索 */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <GlobalSearch />
        </div>
        {/* 右侧 用户下拉 */}
        <Dropdown menu={userMenu}>
          <Button type="text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span>{user ? (user.display_name || user.username) : t('common.user')}</span>
            <DownOutlined style={{ fontSize: 12 }} />
          </Button>
        </Dropdown>
      </Header>
      {/* Header 下方：左侧菜单 + 右侧内容 */}
      <Layout>
        <Sider
          collapsible
          collapsed={collapsed}
          trigger={null}
          width={220}
          theme="light"
          style={{
            overflow: 'auto',
            height: 'calc(100vh - 64px)',
            position: 'sticky',
            top: 64,
            borderRight: '1px solid #f0f0f0',
            background: '#fff',
          }}
        >
          <Menu
            theme="light"
            mode="inline"
            inlineCollapsed={collapsed}
            selectedKeys={[location.pathname]}
            openKeys={collapsed ? undefined : openKeys}
            onOpenChange={collapsed ? undefined : handleOpenChange}
            items={menuItems}
            onClick={({ key }) => { if (key.startsWith('/')) navigate(key) }}
            style={{ borderInlineEnd: 'none' }}
          />
        </Sider>
        <Content
          style={{
            background: '#f5f5f5',
            height: 'calc(100vh - 64px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 24px',
              background: '#fff',
              borderBottom: '1px solid #f0f0f0',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 600, color: '#1f1f1f' }}>
              {pageTitle}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {(/\/\d+$/.test(location.pathname) || new URLSearchParams(location.search).get('mode') === 'edit') && (
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  style={{ border: '1px solid #d9d9d9' }}
                  onClick={() => navigate(-1)}
                >
                  {t('common.back')}
                </Button>
              )}
              <Button
                type="text"
                icon={<ReloadOutlined />}
                style={{ border: '1px solid #d9d9d9' }}
                onClick={() => setRefreshKey((prev) => prev + 1)}
              >
                {t('common.refresh')}
              </Button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Outlet key={refreshKey} />
          </div>
        </Content>
      </Layout>
      {/* 普通修改密码弹框 */}
      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
      {/* 强制修改密码弹框 */}
      <Modal
        title={t('changePassword.title')}
        open={forceChangePasswordOpen}
        closable={false}
        maskClosable={false}
        footer={null}
        width={480}
      >
        <div style={{ marginBottom: 16, color: '#ff4d4f' }}>
          {t('changePassword.forceChangeHint')}
        </div>
        <ForceChangePasswordForm onSuccess={handleForceChangePasswordSuccess} />
      </Modal>
    </Layout>
  )
}

// 强制修改密码表单组件
function ForceChangePasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useI18n()
  const [form, setForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [minLength, setMinLength] = useState(8)

  // 获取密码最小长度配置
  useEffect(() => {
    void (async () => {
      try {
        const { getPasswordMinLength } = await import('../api/configs')
        const length = await getPasswordMinLength()
        setMinLength(length)
      } catch (err) {
        // 使用默认值
      }
    })()
  }, [])

  const handleSubmit = async () => {
    // 前端验证
    const newErrors: Record<string, string> = {}
    if (!form.old_password) newErrors.old_password = t('changePassword.oldPasswordRequired')
    if (!form.new_password) newErrors.new_password = t('changePassword.newPasswordRequired')
    if (!form.confirm_password) newErrors.confirm_password = t('changePassword.confirmPasswordRequired')
    if (form.new_password && form.new_password.length < minLength) {
      newErrors.new_password = t('changePassword.rules.minLength')
    }
    if (form.new_password !== form.confirm_password) {
      newErrors.confirm_password = t('changePassword.confirmPasswordMismatch')
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)
    try {
      const { changePassword } = await import('../api/auth')
      await changePassword({
        old_password: form.old_password,
        new_password: form.new_password,
        confirm_password: form.confirm_password,
      })
      onSuccess()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      const detail = error.response?.data?.detail
      if (detail) {
        if (detail.includes('旧密码错误')) {
          setErrors({ old_password: t('changePassword.errors.oldPasswordIncorrect') })
        } else {
          setErrors({ new_password: detail })
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Text>{t('changePassword.oldPassword')}</Text>
        <input
          type="password"
          className="ant-input ant-input-lg"
          style={{ width: '100%', marginTop: 4 }}
          value={form.old_password}
          onChange={(e) => {
            setForm({ ...form, old_password: e.target.value })
            setErrors({ ...errors, old_password: '' })
          }}
        />
        {errors.old_password && <Text type="danger">{errors.old_password}</Text>}
      </div>
      <div style={{ marginBottom: 12 }}>
        <Text>{t('changePassword.newPassword')}</Text>
        <input
          type="password"
          className="ant-input ant-input-lg"
          style={{ width: '100%', marginTop: 4 }}
          value={form.new_password}
          onChange={(e) => {
            setForm({ ...form, new_password: e.target.value })
            setErrors({ ...errors, new_password: '' })
          }}
        />
        {errors.new_password && <Text type="danger">{errors.new_password}</Text>}
      </div>
      <div style={{ marginBottom: 16 }}>
        <Text>{t('changePassword.confirmPassword')}</Text>
        <input
          type="password"
          className="ant-input ant-input-lg"
          style={{ width: '100%', marginTop: 4 }}
          value={form.confirm_password}
          onChange={(e) => {
            setForm({ ...form, confirm_password: e.target.value })
            setErrors({ ...errors, confirm_password: '' })
          }}
        />
        {errors.confirm_password && <Text type="danger">{errors.confirm_password}</Text>}
      </div>
      <Button type="primary" block loading={loading} onClick={handleSubmit}>
        {t('common.confirm')}
      </Button>
    </div>
  )
}
