import { useEffect, useState, useMemo, useCallback } from 'react'
import { Spin, message, Button } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import type {
  DashboardData,
  UserDashboardConfig,
  ModuleConfigItem,
  StatusConfigItem,
  PieDataItem,
} from '../../types/dashboard'
import { COMPUTED_STATUS_ITEMS, MODULE_CODES } from '../../types/dashboard'
import { getDashboardData, getDashboardConfig } from '../../api/dashboard'
import PublishedStats from './components/PublishedStats'
import ContentStatusCount from './components/ContentStatusCount'
import GenreStatusMatrix from './components/GenreStatusMatrix'
import AssignedToMeTable from './components/AssignedToMeTable'
import TaskCompletionStats from './components/TaskCompletionStats'
import TaskStatusCount from './components/TaskStatusCount'
import TaskAssignedMatrix from './components/TaskAssignedMatrix'
import NotAssignedTasksTable from './components/NotAssignedTasksTable'
import CustomizeModal from './components/CustomizeModal'
import { useI18n } from '../../i18n/useI18n'
import { isHandledError } from '../../api'
import { useAuthStore } from '../../stores/authStore'

const TASK_MODULE_CODES: Set<string> = new Set([
  MODULE_CODES.TASK_COMPLETION_STATS,
  MODULE_CODES.TASK_STATUS_COUNT,
  MODULE_CODES.TASK_ASSIGNED_TABLE,
  MODULE_CODES.NOT_ASSIGNED_TASKS,
])


const Home: React.FC = () => {
  const { t } = useI18n()
  const user = useAuthStore((s) => s.user)
  const roleCodes = (user?.role_codes || []).map((c) => c.toUpperCase())
  const isAdmin = roleCodes.includes('ADMIN')
  const hasTaskAssign = roleCodes.includes('TASK_ASSIGN')
  const canSeeTaskModules = isAdmin || hasTaskAssign

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [config, setConfig] = useState<UserDashboardConfig | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const mergeComputedStatuses = (config: StatusConfigItem[]): StatusConfigItem[] => {
    const existingCodes = new Set(config.map((s) => s.code))
    const merged = [...config]
    for (const item of COMPUTED_STATUS_ITEMS) {
      if (!existingCodes.has(item.code)) {
        merged.push({ ...item, sort_order: merged.length + 1 })
      }
    }
    return merged
  }

  // 加载看板数据和配置
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [dashboardData, dashboardConfig] = await Promise.all([
        getDashboardData(),
        getDashboardConfig(),
      ])
      setData(dashboardData)

      const mergedConfig = {
        ...dashboardConfig,
        content_status_config: mergeComputedStatuses(dashboardConfig.content_status_config),
      }
      setConfig(mergedConfig)
    } catch (error) {
      if (isHandledError(error)) return
      message.error(t('dashboard.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadData()
  }, [])

  // 根据配置过滤和排序模块
  const visibleModules = useMemo(() => {
    if (!config?.module_config) return []
    return config.module_config
      .filter((m: ModuleConfigItem) => m.visible)
      .filter((m: ModuleConfigItem) => canSeeTaskModules || !TASK_MODULE_CODES.has(m.code))
      .sort((a: ModuleConfigItem, b: ModuleConfigItem) => a.sort_order - b.sort_order)
  }, [config, canSeeTaskModules])

  // 根据配置过滤状态
  const visibleStatuses = useMemo(() => {
    if (!config?.content_status_config) return []
    return config.content_status_config
      .filter((s) => s.visible)
      .map((s) => s.code)
  }, [config])

  // 根据配置过滤题材
  const visibleGenres = useMemo(() => {
    if (!config?.content_genre_config) return []
    return config.content_genre_config.filter((g) => g.visible).map((g) => g.name)
  }, [config])

  // 渲染模块
  const renderModule = (moduleCode: string) => {
    if (!data) return null

    switch (moduleCode) {
      case MODULE_CODES.PUBLISHED_STATS:
        const filteredByGenre = visibleGenres
          .map((name) => data.published_stats.by_genre.find((g) => g.name === name))
          .filter((g): g is PieDataItem => g !== undefined)
        const filteredPublishedStats = {
          ...data.published_stats,
          by_genre: filteredByGenre,
        }
        return <PublishedStats data={filteredPublishedStats} />

      case MODULE_CODES.CONTENT_STATUS_COUNT:
        const statusNameMap = Object.fromEntries(
          (config?.content_status_config || []).map((s: StatusConfigItem) => [s.code, s.name])
        )
        return <ContentStatusCount data={data.content_status_count} visibleStatuses={visibleStatuses} statusNameMap={statusNameMap} />

      case MODULE_CODES.GENRE_STATUS_TABLE:
        const statusNameMapForMatrix = Object.fromEntries(
          (config?.content_status_config || []).map((s: StatusConfigItem) => [s.code, s.name])
        )
        return <GenreStatusMatrix data={data.genre_status_matrix} statusNameMap={statusNameMapForMatrix} />

      case MODULE_CODES.ASSIGNED_TO_ME:
        return <AssignedToMeTable />

      case MODULE_CODES.TASK_COMPLETION_STATS:
        return <TaskCompletionStats data={data.task_completion_stats} />

      case MODULE_CODES.TASK_STATUS_COUNT:
        return <TaskStatusCount data={data.task_status_count} />

      case MODULE_CODES.TASK_ASSIGNED_TABLE:
        return <TaskAssignedMatrix data={data.task_assigned_matrix} />

      case MODULE_CODES.NOT_ASSIGNED_TASKS:
        return <NotAssignedTasksTable onDataChange={loadData} />

      default:
        return null
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="main-container">
      {/* 设置按钮 - 在第一个卡片上方右侧 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button
          type="text"
          icon={<SettingOutlined style={{ fontSize: 18 }} />}
          onClick={() => setModalOpen(true)}
          title={t('dashboard.customize')}
        />
      </div>

      {/* 看板模块列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {visibleModules.map((module: ModuleConfigItem) => (
          <div key={module.code}>{renderModule(module.code)}</div>
        ))}
      </div>

      {/* 自定义看板弹框 */}
      <CustomizeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfigChange={loadData}
      />
    </div>
  )
}

export default Home
