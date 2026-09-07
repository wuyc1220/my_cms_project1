import { useState, useEffect, useMemo } from 'react'
import {Layout, Menu, Dropdown, Button, Tooltip} from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
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

function findMenuI18nKey(pathname: string, menus: MenuItem[]): string | null {
  for (const menu of menus) {
    if (menu.children) {
      const found = findMenuI18nKey(pathname, menu.children)
      if (found) return found
    }
    if (menu.path === pathname) return menu.i18n_key
  }
  return null
}

const { Header, Sider, Content } = Layout

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [openKeys, setOpenKeys] = useState<string[]>([])
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [forceChangePasswordOpen, setForceChangePasswordOpen] = useState(false)
  const [sessionTimeout, setSessionTimeout] = useState(30)
  const [refreshKey, setRefreshKey] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isLoggedIn, menus, menusLoaded } = useAuthStore()
  const { t } = useI18n()

  const pageTitle = useMemo(() => {
    if (!menus.length) return ''

    const exactKey = findMenuI18nKey(location.pathname, menus)
    if (exactKey) return t(exactKey as MessageKey)

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

    if (location.pathname.startsWith('/contents/')) {
      return t('trade.content.detail.pageTitle')
    }
    if (location.pathname.startsWith('/workflow/editor/')) {
      return t('menu.workflow.processConfig')
    }

    return ''
  }, [location.pathname, menus, t])

  useEffect(() => {
    if (isLoggedIn && !menusLoaded) {
      void useAuthStore.getState().loadMenus()
    }
  }, [isLoggedIn, menusLoaded])

  const menuItems = useMemo(() => {
      const convertMenu = (items: MenuItem[]): NonNullable<Parameters<typeof Menu>[0]['items']> => {
          return items
              .filter((item) => item.menu_type !== 'permission')
              .map((item) => {
                  const key = item.path || String(item.id)
                  const translated = t(item.i18n_key as Parameters<typeof t>[0])
                  const labelText = translated === item.i18n_key ? item.name : translated
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

  useEffect(() => {
    if (isLoggedIn) {
      void getSessionTimeout().then(setSessionTimeout)
    }
  }, [isLoggedIn])

  useIdleTimeout({
    timeoutMinutes: sessionTimeout,
    enabled: isLoggedIn,
  })

  useEffect(() => {
    if (user?.force_change_password && isLoggedIn) {
      setForceChangePasswordOpen(true)
    }
  }, [user, isLoggedIn])

  const handleForceChangePasswordClose = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleForceChangePasswordSuccess = () => {
    setForceChangePasswordOpen(false)
    void useAuthStore.getState().loadCurrentUser()
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
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <GlobalSearch />
        </div>
        <Dropdown menu={userMenu}>
          <Button type="text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span>
              {user
                ? `${user.display_name || user.username} (${user.username})`
                : t('common.user')}
            </span>
            <DownOutlined style={{ fontSize: 12 }} />
          </Button>
        </Dropdown>
      </Header>
      <Layout>
        <Sider
          collapsible
          collapsed={collapsed}
          trigger={null}
          width={330}
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
      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
      <ChangePasswordModal
        open={forceChangePasswordOpen}
        onClose={handleForceChangePasswordClose}
        forceMode
        onSuccess={handleForceChangePasswordSuccess}
      />
    </Layout>
  )
}
