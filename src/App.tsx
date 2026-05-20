import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntApp } from 'antd'
import { useAuthStore } from './stores/authStore'
import Login from './pages/Login'
import MainLayout from './layouts/MainLayout'
import Home from './pages/home/Home'
import Placeholder from './pages/Placeholder'
import UserManagement from './pages/system/UserManagement'
import UserDetail from './pages/system/UserDetail'
import RoleManagement from './pages/system/RoleManagement'
import RoleDetail from './pages/system/RoleDetail'
import ConfigManagement from './pages/system/ConfigManagement'
import DictManagement from './pages/system/DictManagement'
import TagManagement from './pages/basic/TagManagement'
import CustomTagManagement from './pages/basic/CustomTagManagement'
import GenreManagement from './pages/basic/GenreManagement'
import TypeManagement from './pages/basic/TypeManagement'
import PosterSizeManagement from './pages/basic/PosterSizeManagement'
import CategoryManagement from './pages/basic/CategoryManagement'
import CastManagement from './pages/basic/CastManagement'
import CategoryDetail from './pages/basic/CategoryDetail'
import CastDetail from './pages/basic/CastDetail'
import CustomFieldManagement from './pages/basic/CustomFieldManagement'
import PackageManagement from './pages/business/PackageManagement'
import PackageDetail from './pages/business/PackageDetail'
import TaskManagement from './pages/business/TaskManagement'
import TaskDetail from './pages/business/TaskDetail'
import PublishManagement from './pages/business/PublishManagement'
import ProviderManagement from './pages/trade/ProviderManagement'
import ProviderDetail from './pages/trade/ProviderDetail'
import ContractManagement from './pages/trade/ContractManagement'
import ContractDetail from './pages/trade/ContractDetail'
import LicenseManagement from './pages/trade/LicenseManagement'
import LicenseDetail from './pages/trade/LicenseDetail'
import ContentManagement from './pages/trade/ContentManagement'
import ContentDetail from './pages/trade/ContentDetail'
import VodContents from './pages/vod/VodContents'
import ContentDetailPage from './pages/content/ContentDetailPage'
import ChannelManagement from './pages/live/ChannelManagement'
import ChannelDetail from './pages/live/ChannelDetail'
import ScheduleManagement from './pages/live/ScheduleManagement'
import ScheduleDetail from './pages/live/ScheduleDetail'
import ArchiveManagement from './pages/live/ArchiveManagement'
import OperationLogManagement from './pages/system/OperationLogManagement'
import SensitiveWordManagement from './pages/system/SensitiveWordManagement'
import MenuManagement from './pages/system/MenuManagement'
import UsageLimits from './pages/system/UsageLimits'
import DataAuthorizationManagement from './pages/system/DataAuthorizationManagement'
import MetadataQualityMonitoring from './pages/ops/MetadataQualityMonitoring'
import MetadataQualityDetail from './pages/ops/MetadataQualityDetail'
import ScheduledTaskManagement from './pages/ops/ScheduledTaskManagement'
import ScheduledTaskDetail from './pages/ops/ScheduledTaskDetail'
import WorkflowConfigList from './pages/workflow/WorkflowConfigList'
import WorkflowEditor from './pages/workflow/WorkflowEditor'
import MetadataSourceManagement from './pages/metadataEnhance/MetadataSourceManagement'
import CrawlTaskManagement from './pages/metadataEnhance/CrawlTaskManagement'
import CrawlTaskDetail from './pages/metadataEnhance/CrawlTaskDetail'
import { useI18n } from './i18n/useI18n'
import type { MessageKey } from './i18n/messages'
import { getDefaultPageSizeConfig, setDefaultPageSize } from './constants/pagination'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  return isLoggedIn ? <>{children}</> : <Navigate to="/login" replace />
}

const placeholders: { path: string; titleKey: MessageKey }[] = [
  // /trade/contents 已实现，不再作为 placeholder
  // /live/channels /live/schedules /live/archives 已实现，不再作为 placeholder
  // /vod/contents 已实现，不再作为 placeholder
  // /business/publishes 已实现，不再作为 placeholder
  { path: '/system/users', titleKey: 'menu.system.users' },
  { path: '/system/roles', titleKey: 'menu.system.roles' },
  { path: '/system/dicts', titleKey: 'menu.system.dicts' },
  { path: '/system/configs', titleKey: 'menu.system.configs' },
  { path: '/system/logs', titleKey: 'menu.system.logs' },
]

export default function App() {
  const { t, antLocale } = useI18n()

  // 初始化默认分页大小配置
  useEffect(() => {
    void getDefaultPageSizeConfig().then((size) => {
      setDefaultPageSize(size)
    })
  }, [])

  return (
    <ConfigProvider
      locale={antLocale}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          colorSuccess: '#52c41a',
          colorWarning: '#faad14',
          colorError: '#ff4d4f',
          borderRadius: 6,
          fontSize: 14,
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
        },
        components: {
          Tooltip: {
            maxWidth: 600,
          },
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <MainLayout />
                </PrivateRoute>
              }
            >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Home />} />
            <Route path="basic/tags" element={<TagManagement />} />
            <Route path="basic/custom-tags" element={<CustomTagManagement />} />
            <Route path="basic/genres" element={<GenreManagement />} />
            <Route path="basic/types" element={<TypeManagement />} />
            <Route path="basic/poster-specs" element={<PosterSizeManagement />} />
            <Route path="basic/categories" element={<CategoryManagement />} />
            <Route path="basic/categories/:id" element={<CategoryDetail />} />
            <Route path="basic/casts" element={<CastManagement />} />
            <Route path="basic/casts/:id" element={<CastDetail />} />
            <Route path="basic/custom-fields" element={<CustomFieldManagement />} />
            <Route path="metadata-enhance/sources" element={<MetadataSourceManagement />} />
            <Route path="business/packages" element={<PackageManagement />} />
            <Route path="business/packages/:id" element={<PackageDetail />} />
            <Route path="business/tasks" element={<TaskManagement />} />
            <Route path="business/tasks/:id" element={<TaskDetail />} />
            <Route path="business/publishes" element={<PublishManagement />} />
            <Route path="trade/providers" element={<ProviderManagement />} />
            <Route path="trade/providers/:id" element={<ProviderDetail />} />
            <Route path="trade/contracts" element={<ContractManagement />} />
            <Route path="trade/contracts/:id" element={<ContractDetail />} />
            <Route path="trade/licenses" element={<LicenseManagement />} />
            <Route path="trade/licenses/:id" element={<LicenseDetail />} />
            <Route path="trade/contents" element={<ContentManagement />} />
            <Route path="trade/contents/:id" element={<ContentDetail />} />
            <Route path="live/channels" element={<ChannelManagement />} />
            <Route path="live/channels/:id" element={<ChannelDetail />} />
            <Route path="live/schedules" element={<ScheduleManagement />} />
            <Route path="live/schedules/:id" element={<ScheduleDetail />} />
            <Route path="live/archives" element={<ArchiveManagement />} />
            <Route path="vod/contents" element={<VodContents />} />
            <Route path="contents/:id" element={<ContentDetailPage />} />
            <Route path="system/users" element={<UserManagement />} />
            <Route path="system/users/:id" element={<UserDetail />} />
            <Route path="system/roles" element={<RoleManagement />} />
            <Route path="system/roles/:id" element={<RoleDetail />} />
            <Route path="system/configs" element={<ConfigManagement />} />
            <Route path="system/dicts" element={<DictManagement />} />
            <Route path="system/sensitive-words" element={<SensitiveWordManagement />} />
            <Route path="system/menus" element={<MenuManagement />} />
            <Route path="system/usage-limits" element={<UsageLimits />} />
            <Route path="system/data-authorization" element={<DataAuthorizationManagement />} />
            <Route path="system/logs" element={<OperationLogManagement />} />
            <Route path="ops/monitor" element={<MetadataQualityMonitoring />} />
            <Route path="ops/monitor/:id" element={<MetadataQualityDetail />} />
            <Route path="ops/cron" element={<ScheduledTaskManagement />} />
            <Route path="ops/cron/:id" element={<ScheduledTaskDetail />} />
            <Route path="workflow/configs" element={<WorkflowConfigList />} />
            <Route path="workflow/editor/:configId" element={<WorkflowEditor />} />
            <Route path="metadata-enhance/crawl-tasks" element={<CrawlTaskManagement />} />
            <Route path="metadata-enhance/crawl-tasks/:id" element={<CrawlTaskDetail />} />
            <Route path="workflow/process-config" element={<Placeholder title={t('menu.workflow.processConfig')} />} />
            {placeholders
              .filter(({ path }) =>
                path !== '/system/users' &&
                path !== '/system/users/:id' &&
                path !== '/system/roles' &&
                path !== '/system/roles/:id' &&
                path !== '/system/configs' &&
                path !== '/system/dicts' &&
                path !== '/system/usage-limits' &&
                path !== '/system/logs' &&
                path !== '/ops/monitor' &&
                path !== '/ops/cron'
              )
              .map(({ path, titleKey }) => (
                <Route
                  key={path}
                  path={path.slice(1)}
                  element={<Placeholder title={t(titleKey)} />}
                />
              ))}
          </Route>
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  )
}
