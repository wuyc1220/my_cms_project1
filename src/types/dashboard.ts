/**
 * 看板统计模块类型定义
 */

// ═══════════════════════════════════════════════════════════
// 1. 基础数据项类型
// ═══════════════════════════════════════════════════════════

export interface PieDataItem {
  name: string
  value: number
}

export interface StatusCountItem {
  status_code: string
  status_name: string
  count: number
}

// ═══════════════════════════════════════════════════════════
// 2. 内容统计类型
// ═══════════════════════════════════════════════════════════

export interface PublishedStats {
  by_platform: PieDataItem[]
  by_content_type: PieDataItem[]
  by_genre: PieDataItem[]
  by_ingest_status: PieDataItem[]
}

export interface ContentStatusCount {
  waiting_for_materials: number
  in_progress: number
  ready_for_publish: number
  publishing: number
  published: number
  publish_failed: number
  no_active_license: number
  closed: number
  none_status: number
  /** 计算状态：临近过期数量（Published + 许可证 end_date 在窗口内） */
  near_expired: number
  /** 计算状态：本次统计实际生效的临近过期天数（NEAR_EXPIRY_DAYS 配置，点击跳转复用） */
  near_expiry_days: number
  /** 计算状态：已删除数量（is_discarded=true） */
  deleted: number
}

export interface GenreStatusMatrix {
  genres: string[]
  statuses: string[]
  data: Record<string, Record<string, number>>
}

// ═══════════════════════════════════════════════════════════
// 3. 任务统计类型
// ═══════════════════════════════════════════════════════════

export interface TaskCompletionStats {
  arrangement: PieDataItem[]
  review_l1: PieDataItem[]
  review_l2: PieDataItem[]
  review_l3: PieDataItem[]
}

export interface TaskStatusCount {
  pending: number
  completed: number
  not_assigned: number
}

export interface TaskAssignedMatrixItem {
  user_id: number
  user_name: string
  arrangement_pending: number
  review_l1_pending: number
  review_l2_pending: number
  review_l3_pending: number
  arrangement_completed: number
  review_completed: number
  completion_rate: number
}

export interface TaskAssignedMatrix {
  users: string[]
  data: TaskAssignedMatrixItem[]
}

// ═══════════════════════════════════════════════════════════
// 4. 用户配置类型
// ═══════════════════════════════════════════════════════════

export interface ModuleConfigItem {
  code: string
  name: string
  visible: boolean
  sort_order: number
}

export interface StatusConfigItem {
  code: string
  name: string
  visible: boolean
  sort_order: number
}

export interface GenreConfigItem {
  id: number
  name: string
  visible: boolean
  sort_order: number
}

export interface UserDashboardConfig {
  id: number
  user_id: number
  module_config: ModuleConfigItem[]
  content_status_config: StatusConfigItem[]
  content_genre_config: GenreConfigItem[]
}

export interface UserDashboardConfigUpdate {
  module_config: ModuleConfigItem[]
  content_status_config: StatusConfigItem[]
  content_genre_config: GenreConfigItem[]
}

// ═══════════════════════════════════════════════════════════
// 6. 看板综合数据类型
// ═══════════════════════════════════════════════════════════

export interface DashboardData {
  published_stats: PublishedStats
  content_status_count: ContentStatusCount
  genre_status_matrix: GenreStatusMatrix
  task_completion_stats: TaskCompletionStats
  task_status_count: TaskStatusCount
  task_assigned_matrix: TaskAssignedMatrix
  /** 当前用户是否可见任务相关模块（后端实时权限，前端显隐权威来源） */
  can_see_task_modules: boolean
}

// ═══════════════════════════════════════════════════════════
// 7. 模块代码常量
// ═══════════════════════════════════════════════════════════

export const MODULE_CODES = {
  PUBLISHED_STATS: 'published_stats',
  CONTENT_STATUS_COUNT: 'content_status_count',
  GENRE_STATUS_TABLE: 'genre_status_table',
  ASSIGNED_TO_ME: 'assigned_to_me',
  TASK_COMPLETION_STATS: 'task_completion_stats',
  TASK_STATUS_COUNT: 'task_status_count',
  TASK_ASSIGNED_TABLE: 'task_assigned_table',
  NOT_ASSIGNED_TASKS: 'not_assigned_tasks',
} as const

// 受任务权限控制的看板模块 code 集合（无 operate 权限时隐藏）
// 注意：未分配任务列表（not_assigned_tasks）不受权限控制，仅由自定义看板弹窗配置
export const TASK_MODULE_CODES: Set<string> = new Set([
  MODULE_CODES.TASK_COMPLETION_STATS,
  MODULE_CODES.TASK_STATUS_COUNT,
  MODULE_CODES.TASK_ASSIGNED_TABLE,
])

export const MODULE_NAMES: Record<string, string> = {
  [MODULE_CODES.PUBLISHED_STATS]: 'Vod Published Statistics',
  [MODULE_CODES.CONTENT_STATUS_COUNT]: 'Vod Status Count',
  [MODULE_CODES.GENRE_STATUS_TABLE]: 'Vod Genre/Status Table',
  [MODULE_CODES.ASSIGNED_TO_ME]: 'Assigned To Me Table',
  [MODULE_CODES.TASK_COMPLETION_STATS]: 'Task Completion Statistics',
  [MODULE_CODES.TASK_STATUS_COUNT]: 'Task Status Count',
  [MODULE_CODES.TASK_ASSIGNED_TABLE]: 'Task Assigned/Status Table',
  [MODULE_CODES.NOT_ASSIGNED_TASKS]: 'Not Assigned Tasks Table',
}

// 默认模块配置
export const DEFAULT_MODULE_CONFIG: ModuleConfigItem[] = [
  { code: MODULE_CODES.PUBLISHED_STATS, name: MODULE_NAMES[MODULE_CODES.PUBLISHED_STATS], visible: true, sort_order: 1 },
  { code: MODULE_CODES.CONTENT_STATUS_COUNT, name: MODULE_NAMES[MODULE_CODES.CONTENT_STATUS_COUNT], visible: true, sort_order: 2 },
  { code: MODULE_CODES.GENRE_STATUS_TABLE, name: MODULE_NAMES[MODULE_CODES.GENRE_STATUS_TABLE], visible: true, sort_order: 3 },
  { code: MODULE_CODES.ASSIGNED_TO_ME, name: MODULE_NAMES[MODULE_CODES.ASSIGNED_TO_ME], visible: true, sort_order: 4 },
  { code: MODULE_CODES.TASK_COMPLETION_STATS, name: MODULE_NAMES[MODULE_CODES.TASK_COMPLETION_STATS], visible: true, sort_order: 5 },
  { code: MODULE_CODES.TASK_STATUS_COUNT, name: MODULE_NAMES[MODULE_CODES.TASK_STATUS_COUNT], visible: true, sort_order: 6 },
  { code: MODULE_CODES.TASK_ASSIGNED_TABLE, name: MODULE_NAMES[MODULE_CODES.TASK_ASSIGNED_TABLE], visible: true, sort_order: 7 },
  { code: MODULE_CODES.NOT_ASSIGNED_TASKS, name: MODULE_NAMES[MODULE_CODES.NOT_ASSIGNED_TASKS], visible: true, sort_order: 8 },
]

