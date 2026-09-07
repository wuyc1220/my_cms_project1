import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { logout as logoutApi } from '../api/auth'
import { useAuthStore } from '../stores/authStore'
import { useI18n } from '../i18n/useI18n'

/** 当前账号未被分配任何可访问页面菜单时的提示页 */
export default function NoPermission() {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const { t } = useI18n()

  const handleLogout = async () => {
    try {
      await logoutApi()
    } catch {
      // 忽略登出接口失败
    }
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <Result
      status="403"
      title={t('noPermission.title')}
      subTitle={t('noPermission.desc')}
      extra={
        <Button type="primary" onClick={handleLogout}>
          {t('common.logout')}
        </Button>
      }
    />
  )
}
