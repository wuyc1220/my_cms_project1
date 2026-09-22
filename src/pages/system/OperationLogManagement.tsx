import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  DatePicker,
  Form,
  Modal,
  Space,
  Tag,
  Typography,
  message, Tooltip,
} from 'antd'
import {
  ExportOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  clearOperationLogs,
  exportOperationLogs,
  getOperationLogs,
} from '../../api/operationLogs'
import type { OperationLogItem, OperationLogQueryParams } from '../../api/operationLogs'
import { useI18n } from '../../i18n/useI18n'
import type { MessageKey } from '../../i18n/messages'
import { useTablePagination } from '../../hooks/useTablePagination'
import SearchForm from '../../components/SearchForm'
import ResizableTable from '../../components/ResizableTable'
import type { SearchFieldConfig } from '../../types/searchForm'
import { useSearchForm } from '../../hooks/useSearchForm'
import { usePermission } from '../../hooks/usePermission'

const { RangePicker } = DatePicker
const { Text } = Typography

const OPERATION_TYPE_KEYS = [
  'USER_LOGIN', 'USER_LOGOUT', 'USER_CHANGE_PWD',
  'USER_CREATE', 'USER_EDIT', 'USER_DELETE', 'USER_RESET_PWD', 'USER_STATUS',
  'ROLE_CREATE', 'ROLE_EDIT', 'ROLE_DELETE', 'ROLE_PERM', 'ROLE_STATUS',
  'DICT_CREATE', 'DICT_EDIT', 'DICT_DELETE', 'DICT_STATUS',
  'CONFIG_CREATE', 'CONFIG_EDIT', 'CONFIG_DELETE',
  'MENU_CREATE', 'MENU_EDIT', 'MENU_DELETE', 'MENU_ASSIGN',
  'CONTENT_CREATE', 'CONTENT_EDIT', 'CONTENT_DELETE', 'CONTENT_PUBLISH', 'CONTENT_UNPUBLISH',
  'PUBLISH_NOW', 'UNPUBLISH_NOW', 'PUBLISH_BATCH', 'UNPUBLISH_BATCH',
  'PUBLISH_PLAN_CREATE', 'PUBLISH_PLAN_UPDATE', 'PUBLISH_PLAN_CANCEL',
  'CONTENT_REVIEW_INITIATE', 'CONTENT_REVIEW_APPROVE', 'CONTENT_REVIEW_REJECT',
  'PROVIDER_CREATE', 'PROVIDER_EDIT', 'PROVIDER_DELETE', 'PROVIDER_BATCH_DELETE',
  'CONTRACT_CREATE', 'CONTRACT_EDIT', 'CONTRACT_DELETE', 'CONTRACT_BATCH_DELETE', 'CONTRACT_ATTACHMENT_DELETE', 'CONTRACT_ATTACHMENT_UPLOAD',
  'LICENSE_CREATE', 'LICENSE_EDIT', 'LICENSE_DELETE', 'LICENSE_BATCH_DELETE', 'LICENSE_CONTENT_ADD', 'LICENSE_CONTENT_REMOVE',
  'PACKAGE_CREATE', 'PACKAGE_EDIT', 'PACKAGE_DELETE', 'PACKAGE_BATCH_DELETE', 'PACKAGE_CONTENT_ADD', 'PACKAGE_CONTENT_REMOVE',
  'SCHEDULE_CREATE', 'SCHEDULE_DELETE', 'SCHEDULE_EXPORT', 'SCHEDULE_BATCH_EXPORT', 'SCHEDULE_IMPORT',
  'CAST_CREATE', 'CAST_EDIT', 'CAST_DELETE', 'CAST_BATCH_DELETE',
  'CATEGORY_CREATE', 'CATEGORY_EDIT', 'CATEGORY_DELETE', 'CATEGORY_BATCH_DELETE',
  'GENRE_CREATE', 'GENRE_EDIT', 'GENRE_DELETE', 'GENRE_BATCH_DELETE',
  'TAG_CREATE', 'TAG_EDIT', 'TAG_DELETE', 'TAG_BATCH_DELETE',
  'CUSTOM_TAG_CREATE', 'CUSTOM_TAG_EDIT', 'CUSTOM_TAG_DELETE', 'CUSTOM_TAG_BATCH_DELETE',
  'CONTENT_TYPE_CREATE', 'CONTENT_TYPE_EDIT', 'CONTENT_TYPE_DELETE', 'CONTENT_TYPE_BATCH_DELETE',
  'POSTER_SIZE_CREATE', 'POSTER_SIZE_EDIT', 'POSTER_SIZE_DELETE', 'POSTER_SIZE_BATCH_DELETE',
  'CUSTOM_FIELD_CREATE', 'CUSTOM_FIELD_EDIT', 'CUSTOM_FIELD_DELETE', 'CUSTOM_FIELD_BATCH_DELETE',
  'SENSITIVE_WORD_CREATE', 'SENSITIVE_WORD_EDIT', 'SENSITIVE_WORD_DELETE', 'SENSITIVE_WORD_BATCH_DELETE', 'SENSITIVE_WORD_STATUS', 'SENSITIVE_WORD_BATCH_STATUS', 'SENSITIVE_WORD_IMPORT', 'SENSITIVE_WORD_EXPORT', 'SENSITIVE_WORD_BATCH_EXPORT',
  'TASK_ASSIGN', 'TASK_COMPLETE', 'TASK_BATCH_ASSIGN',
  'DATA_AUTH_AUTHORIZE', 'DATA_AUTH_CLEAR',
  'METADATA_SOURCE_CREATE', 'METADATA_SOURCE_EDIT', 'METADATA_SOURCE_DELETE', 'METADATA_SOURCE_BATCH_DELETE', 'METADATA_SOURCE_STATUS', 'METADATA_SOURCE_BATCH_ENABLE', 'METADATA_SOURCE_BATCH_DISABLE',
  'CRAWL_TASK_CREATE', 'CRAWL_TASK_RETRY', 'CRAWL_TASK_DELETE', 'CRAWL_TASK_BATCH_DELETE', 'CRAWL_TASK_CONFIRM',
  'WORKFLOW_CREATE', 'WORKFLOW_EDIT', 'WORKFLOW_DELETE', 'WORKFLOW_PUBLISH', 'WORKFLOW_UNPUBLISH', 'WORKFLOW_NEW_VERSION', 'WORKFLOW_BATCH_PUBLISH',
  'METADATA_QUALITY_TRIGGER', 'METADATA_QUALITY_DELETE', 'METADATA_QUALITY_BATCH_DELETE', 'METADATA_QUALITY_EXPORT',
  'VALIDATION_RULE_CREATE', 'VALIDATION_RULE_EDIT', 'VALIDATION_RULE_DELETE', 'VALIDATION_RULE_BATCH_DELETE', 'VALIDATION_RULE_IMPORT',
  'SCHEDULED_TASK_TRIGGER', 'SCHEDULED_TASK_BATCH_TRIGGER',
  'USAGE_LIMIT_UPDATE',
  'OPERATION_LOG_EXPORT', 'OPERATION_LOG_CLEAR',
  'USER_BATCH_DELETE', 'USER_BATCH_STATUS',
  'ROLE_BATCH_DELETE', 'ROLE_BATCH_STATUS',
  'CONTENT_BATCH_DELETE',
  'CHANNEL_UPDATE', 'PHYSICAL_CHANNEL_CREATE', 'PHYSICAL_CHANNEL_DELETE',
  'CHANNEL_METADATA_CREATE', 'CHANNEL_METADATA_UPDATE', 'CHANNEL_METADATA_DELETE',
  'SCHEDULE_METADATA_CREATE', 'SCHEDULE_METADATA_UPDATE', 'SCHEDULE_METADATA_DELETE',
  'CAST_ROLE_MAP_CREATE', 'CAST_ROLE_MAP_UPDATE', 'CAST_ROLE_MAP_DELETE',
  'CAST_ROLE_MAP_LINK', 'CAST_ROLE_MAP_UNLINK',
  'CONTENT_PACKAGE_LINK', 'CONTENT_PACKAGE_UNLINK',
  'CONTENT_CATEGORY_LINK', 'CONTENT_CATEGORY_UNLINK',
  'POSTER_UPLOAD', 'POSTER_DELETE',
  'CHANNEL_FIELD_UPDATE', 'CHANNEL_I18N_UPDATE',
  'SCHEDULE_FIELD_UPDATE', 'SCHEDULE_I18N_UPDATE',
  'PROGRAM_METADATA_CREATE', 'PROGRAM_METADATA_UPDATE', 'PROGRAM_METADATA_DELETE',
  'SERIES_METADATA_CREATE', 'SERIES_METADATA_UPDATE', 'SERIES_METADATA_DELETE',
  'MOVIE_CREATE', 'MOVIE_UPDATE', 'MOVIE_DELETE',
  'VOD_FIELD_UPDATE', 'VOD_I18N_UPDATE',
  'EPISODE_INJECT', 'EPISODE_REMOVE',
  'SEASON_SERIES_INJECT', 'SEASON_SERIES_REMOVE',
  'PICTURE_PUBLISH',
  'MOVIE_FIELD_UPDATE', 'MOVIE_I18N_UPDATE',
  'CAST_ROLE_MAP_FIELD_UPDATE', 'CAST_ROLE_MAP_I18N_UPDATE',
  'SCHEDULED_TASK_UPDATE',
  'CONTENT_BATCH_EXPORT', 'CONTENT_BATCH_IMPORT',
  'PACKAGE_EXPORT', 'PACKAGE_IMPORT',
  'CATEGORY_SYNC',
  'DASHBOARD_CONFIG_UPDATE', 'DASHBOARD_CONFIG_RESET',
]

const LEGACY_CN_TO_KEY: Record<string, string> = {
  '用户登录': 'USER_LOGIN', '用户登出': 'USER_LOGOUT', '修改密码': 'USER_CHANGE_PWD',
  '用户创建': 'USER_CREATE', '用户编辑': 'USER_EDIT', '用户删除': 'USER_DELETE', '密码重置': 'USER_RESET_PWD', '用户状态变更': 'USER_STATUS',
  '角色创建': 'ROLE_CREATE', '角色编辑': 'ROLE_EDIT', '角色删除': 'ROLE_DELETE', '角色权限配置': 'ROLE_PERM', '角色状态变更': 'ROLE_STATUS',
  '数据字典创建': 'DICT_CREATE', '数据字典编辑': 'DICT_EDIT', '数据字典删除': 'DICT_DELETE', '数据字典状态变更': 'DICT_STATUS',
  '系统参数创建': 'CONFIG_CREATE', '系统参数编辑': 'CONFIG_EDIT', '系统参数删除': 'CONFIG_DELETE',
  '内容创建': 'CONTENT_CREATE', '内容编辑': 'CONTENT_EDIT', '内容删除': 'CONTENT_DELETE', '内容发布': 'CONTENT_PUBLISH', '内容下架': 'CONTENT_UNPUBLISH',
  '供应商创建': 'PROVIDER_CREATE', '供应商编辑': 'PROVIDER_EDIT', '供应商删除': 'PROVIDER_DELETE', '供应商批量删除': 'PROVIDER_BATCH_DELETE',
  '合同创建': 'CONTRACT_CREATE', '合同编辑': 'CONTRACT_EDIT', '合同删除': 'CONTRACT_DELETE', '合同批量删除': 'CONTRACT_BATCH_DELETE', '合同附件删除': 'CONTRACT_ATTACHMENT_DELETE', '合同附件上传': 'CONTRACT_ATTACHMENT_UPLOAD',
  '许可证创建': 'LICENSE_CREATE', '许可证编辑': 'LICENSE_EDIT', '许可证删除': 'LICENSE_DELETE', '许可证批量删除': 'LICENSE_BATCH_DELETE', '许可证内容关联': 'LICENSE_CONTENT_ADD', '许可证内容移除': 'LICENSE_CONTENT_REMOVE',
  '服务包创建': 'PACKAGE_CREATE', '服务包编辑': 'PACKAGE_EDIT', '服务包删除': 'PACKAGE_DELETE', '服务包批量删除': 'PACKAGE_BATCH_DELETE', '服务包内容关联': 'PACKAGE_CONTENT_ADD', '服务包内容移除': 'PACKAGE_CONTENT_REMOVE',
  '立即发布': 'PUBLISH_NOW', '立即下架': 'UNPUBLISH_NOW', '批量发布': 'PUBLISH_BATCH', '批量下架': 'UNPUBLISH_BATCH', '设置发布计划': 'PUBLISH_PLAN_CREATE', '修改发布计划': 'PUBLISH_PLAN_UPDATE', '取消发布计划': 'PUBLISH_PLAN_CANCEL', '计划发布执行成功': 'PUBLISH_PLAN_EXECUTE', '计划下架执行成功': 'UNPUBLISH_PLAN_EXECUTE',
  '节目单创建': 'SCHEDULE_CREATE', '节目单更新': 'SCHEDULE_UPDATE', '节目单归档': 'SCHEDULE_ARCHIVE', '节目单删除': 'SCHEDULE_DELETE', '节目单导出': 'SCHEDULE_EXPORT', '节目单导入': 'SCHEDULE_IMPORT',
  '人物创建': 'CAST_CREATE', '人物编辑': 'CAST_EDIT', '人物删除': 'CAST_DELETE', '人物批量删除': 'CAST_BATCH_DELETE',
  '栏目创建': 'CATEGORY_CREATE', '栏目编辑': 'CATEGORY_EDIT', '栏目删除': 'CATEGORY_DELETE', '栏目批量删除': 'CATEGORY_BATCH_DELETE',
  '题材创建': 'GENRE_CREATE', '题材编辑': 'GENRE_EDIT', '题材删除': 'GENRE_DELETE', '题材批量删除': 'GENRE_BATCH_DELETE',
  '标签创建': 'TAG_CREATE', '标签编辑': 'TAG_EDIT', '标签删除': 'TAG_DELETE', '标签批量删除': 'TAG_BATCH_DELETE',
  '自定义标签创建': 'CUSTOM_TAG_CREATE', '自定义标签编辑': 'CUSTOM_TAG_EDIT', '自定义标签删除': 'CUSTOM_TAG_DELETE', '自定义标签批量删除': 'CUSTOM_TAG_BATCH_DELETE',
  '类型创建': 'CONTENT_TYPE_CREATE', '类型编辑': 'CONTENT_TYPE_EDIT', '类型删除': 'CONTENT_TYPE_DELETE', '类型批量删除': 'CONTENT_TYPE_BATCH_DELETE',
  '海报尺寸创建': 'POSTER_SIZE_CREATE', '海报尺寸编辑': 'POSTER_SIZE_EDIT', '海报尺寸删除': 'POSTER_SIZE_DELETE', '海报尺寸批量删除': 'POSTER_SIZE_BATCH_DELETE',
  '自定义字段创建': 'CUSTOM_FIELD_CREATE', '自定义字段编辑': 'CUSTOM_FIELD_EDIT', '自定义字段删除': 'CUSTOM_FIELD_DELETE', '自定义字段批量删除': 'CUSTOM_FIELD_BATCH_DELETE',
  '敏感词创建': 'SENSITIVE_WORD_CREATE', '敏感词编辑': 'SENSITIVE_WORD_EDIT', '敏感词删除': 'SENSITIVE_WORD_DELETE', '敏感词批量删除': 'SENSITIVE_WORD_BATCH_DELETE', '敏感词状态变更': 'SENSITIVE_WORD_STATUS', '敏感词批量状态变更': 'SENSITIVE_WORD_BATCH_STATUS', '敏感词导入': 'SENSITIVE_WORD_IMPORT', '敏感词导出': 'SENSITIVE_WORD_EXPORT', '敏感词批量导出': 'SENSITIVE_WORD_BATCH_EXPORT',
  '任务分配': 'TASK_ASSIGN', '任务完成': 'TASK_COMPLETE', '任务批量分配': 'TASK_BATCH_ASSIGN',
  '数据权限授权': 'DATA_AUTH_AUTHORIZE', '数据权限清除': 'DATA_AUTH_CLEAR',
  '数据源创建': 'METADATA_SOURCE_CREATE', '数据源编辑': 'METADATA_SOURCE_EDIT', '数据源删除': 'METADATA_SOURCE_DELETE', '数据源批量删除': 'METADATA_SOURCE_BATCH_DELETE', '数据源状态变更': 'METADATA_SOURCE_STATUS', '数据源批量启用': 'METADATA_SOURCE_BATCH_ENABLE', '数据源批量禁用': 'METADATA_SOURCE_BATCH_DISABLE',
  '爬取任务创建': 'CRAWL_TASK_CREATE', '爬取任务重试': 'CRAWL_TASK_RETRY', '爬取任务删除': 'CRAWL_TASK_DELETE', '爬取任务批量删除': 'CRAWL_TASK_BATCH_DELETE', '爬取结果确认': 'CRAWL_TASK_CONFIRM',
  '用户批量删除': 'USER_BATCH_DELETE', '用户批量状态变更': 'USER_BATCH_STATUS',
  '角色批量删除': 'ROLE_BATCH_DELETE', '角色批量状态变更': 'ROLE_BATCH_STATUS',
  '内容批量删除': 'CONTENT_BATCH_DELETE',
  '节目单批量导出': 'SCHEDULE_BATCH_EXPORT',
  '质量检查批量删除': 'METADATA_QUALITY_BATCH_DELETE',
  '定时任务批量触发': 'SCHEDULED_TASK_BATCH_TRIGGER',
  '菜单创建': 'MENU_CREATE', '菜单编辑': 'MENU_EDIT', '菜单删除': 'MENU_DELETE', '菜单分配': 'MENU_ASSIGN',
  '发起审核': 'CONTENT_REVIEW_INITIATE', '审核通过': 'CONTENT_REVIEW_APPROVE', '审核拒绝': 'CONTENT_REVIEW_REJECT',
  '频道更新': 'CHANNEL_UPDATE', '物理频道创建': 'PHYSICAL_CHANNEL_CREATE', '物理频道删除': 'PHYSICAL_CHANNEL_DELETE',
  '频道元数据创建': 'CHANNEL_METADATA_CREATE', '频道元数据更新': 'CHANNEL_METADATA_UPDATE', '频道元数据删除': 'CHANNEL_METADATA_DELETE',
  '节目单元数据创建': 'SCHEDULE_METADATA_CREATE', '节目单元数据更新': 'SCHEDULE_METADATA_UPDATE', '节目单元数据删除': 'SCHEDULE_METADATA_DELETE',
  '人物角色关联创建': 'CAST_ROLE_MAP_CREATE', '人物角色关联更新': 'CAST_ROLE_MAP_UPDATE', '人物角色关联删除': 'CAST_ROLE_MAP_DELETE',
  '关联演职人员': 'CAST_ROLE_MAP_LINK', '取消关联演职人员': 'CAST_ROLE_MAP_UNLINK',
  '关联服务包': 'CONTENT_PACKAGE_LINK', '取消关联服务包': 'CONTENT_PACKAGE_UNLINK',
  '关联栏目': 'CONTENT_CATEGORY_LINK', '取消关联栏目': 'CONTENT_CATEGORY_UNLINK',
  '上传海报': 'POSTER_UPLOAD', '删除海报': 'POSTER_DELETE',
  '频道字段更新': 'CHANNEL_FIELD_UPDATE', '频道多语言更新': 'CHANNEL_I18N_UPDATE',
  '节目单字段更新': 'SCHEDULE_FIELD_UPDATE', '节目单多语言更新': 'SCHEDULE_I18N_UPDATE',
  'Program元数据创建': 'PROGRAM_METADATA_CREATE', 'Program元数据更新': 'PROGRAM_METADATA_UPDATE', 'Program元数据删除': 'PROGRAM_METADATA_DELETE',
  'Series元数据创建': 'SERIES_METADATA_CREATE', 'Series元数据更新': 'SERIES_METADATA_UPDATE', 'Series元数据删除': 'SERIES_METADATA_DELETE',
  '媒资创建': 'MOVIE_CREATE', '媒资更新': 'MOVIE_UPDATE', '媒资删除': 'MOVIE_DELETE',
  'VOD字段更新': 'VOD_FIELD_UPDATE', 'VOD多语言更新': 'VOD_I18N_UPDATE',
  '单集注入': 'EPISODE_INJECT', '单集移除': 'EPISODE_REMOVE',
  '工作流创建': 'WORKFLOW_CREATE', '工作流编辑': 'WORKFLOW_EDIT', '工作流删除': 'WORKFLOW_DELETE',
  '工作流发布': 'WORKFLOW_PUBLISH', '工作流取消发布': 'WORKFLOW_UNPUBLISH', '工作流新版本': 'WORKFLOW_NEW_VERSION', '工作流批量发布': 'WORKFLOW_BATCH_PUBLISH',
  '质量检查触发': 'METADATA_QUALITY_TRIGGER', '质量检查删除': 'METADATA_QUALITY_DELETE', '质量检查导出': 'METADATA_QUALITY_EXPORT',
  '校验规则创建': 'VALIDATION_RULE_CREATE', '校验规则编辑': 'VALIDATION_RULE_EDIT', '校验规则删除': 'VALIDATION_RULE_DELETE',
  '校验规则批量删除': 'VALIDATION_RULE_BATCH_DELETE', '校验规则导入': 'VALIDATION_RULE_IMPORT',
  '定时任务触发': 'SCHEDULED_TASK_TRIGGER',
  '使用限制更新': 'USAGE_LIMIT_UPDATE',
  '操作日志导出': 'OPERATION_LOG_EXPORT', '操作日志清空': 'OPERATION_LOG_CLEAR',
}

function translateOperationType(raw: string | null, t: (key: string) => string): string {
  if (!raw) return '-'
  const key = LEGACY_CN_TO_KEY[raw] ?? raw
  return t(key as Parameters<typeof t>[0]) !== key ? t(key as Parameters<typeof t>[0]) : raw
}

// log.* 操作内容编码翻译（与详情页 ProcessedHistoryTab 的展示规则保持一致）：
// - 大写编码（LOG_PROVIDER_CREATED 等）直接查 i18n
// - 带参数形式 "log.xxx:param"：翻译基础编码后拼接参数
//   · log.movie.*:类型编码 → "媒资新增-正片"（类型编码二次翻译）
//   · log.field.edit / log.i18n.edit:语言 → "自定义字段编辑(en)"（语言标识用括号）
//   · log.episode.inject:标题 等 → "单集注入:标题"（业务名称用冒号）
// - 无翻译时原样返回
function translateLogContent(raw: string, t: (key: string) => string): string {
  if (/^[A-Z_]+$/.test(raw)) {
    const translated = t(raw)
    return translated !== raw ? translated : raw
  }
  if (!raw.startsWith('log.')) return raw
  const colonIdx = raw.indexOf(':')
  if (colonIdx === -1) {
    const translated = t(raw)
    return translated !== raw ? translated : raw
  }
  const base = raw.substring(0, colonIdx)
  const param = raw.substring(colonIdx + 1)
  if (base === 'log.movie.create' || base === 'log.movie.edit' || base === 'log.movie.delete') {
    return `${t(base)}-${t(`log.movie.type.${param}`)}`
  }
  if (base === 'log.custom_field.batch_delete') {
    return `${t(base)}${param}`
  }
  const baseTranslated = t(base)
  if (baseTranslated === base) return raw
  if (base === 'log.field.edit' || base === 'log.i18n.edit') {
    return `${baseTranslated}(${param})`
  }
  return `${baseTranslated}:${param}`
}

// ── 旧日志 JSON 快照降级展示 ──────────────────────────────────
// 早期版本部分操作未写入 operation_content，前端降级显示 updated_value_json 原文。
// 此处将 JSON 解析为摘要（提取标识字段），悬停时展示格式化 JSON 便于排查。
const SNAPSHOT_NAME_KEYS = ['name', 'title', 'keyword', 'field_name', 'username', 'config_key', 'code']
const SNAPSHOT_AUDIT_KEYS = new Set(['id', 'is_deleted', 'created_at', 'updated_at', 'created_by', 'updated_by'])

function formatSnapshot(raw: string): { summary: string; pretty: string } {
  try {
    const obj = JSON.parse(raw)
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const nameKey = SNAPSHOT_NAME_KEYS.find((k) => obj[k] != null && typeof obj[k] !== 'object')
      const fields = Object.entries(obj)
        .filter(([k, v]) => v != null && !SNAPSHOT_AUDIT_KEYS.has(k) && typeof v !== 'object')
        .map(([k, v]) => `${k}=${String(v)}`)
      const summary = nameKey != null ? String(obj[nameKey]) : fields.slice(0, 3).join(', ')
      return { summary: summary || raw, pretty: JSON.stringify(obj, null, 2) }
    }
  } catch {
    // 非 JSON 原样展示
  }
  return { summary: raw, pretty: raw }
}

interface SearchValues {
  user_name?: string
  operation_type?: string[]
  time_range?: [dayjs.Dayjs, dayjs.Dayjs]
  result?: string
}

interface ClearFormValues {
  clear_range: [dayjs.Dayjs, dayjs.Dayjs]
}

export default function OperationLogManagement() {
  const { t, language } = useI18n()
  const tStr = (key: string) => t(key as MessageKey)
  const [clearForm] = Form.useForm<ClearFormValues>()
  const [list, setList] = useState<OperationLogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [clearOpen, setClearOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const { hasPermission } = usePermission()
  const canOperate = hasPermission('menu.system.logs.operate')
  const { pagination, updatePagination, sortField, sortOrder, resetSort, tablePaginationProps, handleTableChange } = useTablePagination({
    onChange: ({ page, pageSize, sortField, sortOrder }) => {
      void loadLogs(page, pageSize, filtersRef.current, sortField, sortOrder)
    },
  })
  const filtersRef = useRef<OperationLogQueryParams>({})

  const operationTypeOptions = useMemo(() =>
    OPERATION_TYPE_KEYS.map((key) => ({
      label: t(key as Parameters<typeof t>[0]),
      value: key,
    })),
  [language])

  const resultOptions = useMemo(() => [
    { label: t('system.log.resultSuccess'), value: 'success' },
    { label: t('system.log.resultFailed'), value: 'failed' },
  ], [language])

  const searchFields: SearchFieldConfig[] = useMemo(() => [
    {
      name: 'user_name',
      labelKey: 'system.log.colUser',
      type: 'input',
      placeholderKey: 'system.log.placeholderUser',
    },
    {
      name: 'operation_type',
      labelKey: 'system.log.colType',
      type: 'multiSelect',
      options: operationTypeOptions,
      placeholderKey: 'system.log.placeholderType',
    },
    {
      name: 'result',
      labelKey: 'system.log.colResult',
      type: 'select',
      options: resultOptions,
      placeholderKey: 'system.log.placeholderResult',
    },
    {
      name: 'time_range',
      labelKey: 'system.log.colTime',
      type: 'dateRange',
    },
  ], [operationTypeOptions, resultOptions, t])

  const {
    form: searchForm,
    expanded,
    setExpanded,
    showExpand,
    handleSearch,
    handleReset,
  } = useSearchForm<SearchValues>({
    fieldsCount: searchFields.length,
    onSearch: async (values) => {
      const filters = buildParams(values)
      filtersRef.current = filters
      resetSort()
      setSelectedRowKeys([])
      loadLogs(1, pagination.pageSize, filters, null, null)
    },
    onReset: () => {
      filtersRef.current = {}
      resetSort()
      setSelectedRowKeys([])
      loadLogs(1, pagination.pageSize, {}, null, null)
    },
  })

  const buildParams = (values: SearchValues): OperationLogQueryParams => {
    const params: OperationLogQueryParams = {}
    if (values.user_name) params.user_name = values.user_name
    if (values.operation_type?.length) params.operation_type = values.operation_type.join(',')
    if (values.result) params.result = values.result
    if (values.time_range?.length === 2) {
      params.time_start = values.time_range[0].startOf('day').toISOString()
      params.time_end = values.time_range[1].endOf('day').toISOString()
    }
    return params
  }

  const loadLogs = async (
    page = pagination.current,
    pageSize = pagination.pageSize,
    filters = filtersRef.current,
    nextSortField?: string | null,
    nextSortOrder?: 'ascend' | 'descend' | null,
  ) => {
    setLoading(true)
    try {
      const res = await getOperationLogs({
        page,
        page_size: pageSize,
        ...filters,
        sort_by: nextSortField ?? undefined,
        sort_order: nextSortOrder === 'ascend' ? 'asc' : nextSortOrder === 'descend' ? 'desc' : undefined,
      })
      setList(res.items)
      updatePagination(res)
    } catch (err) {
      // error handled by axios interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  const handleExport = async () => {
    setExporting(true)
    try {
      const params: Record<string, unknown> = { ...filtersRef.current }
      if (selectedRowKeys.length > 0) {
        params.ids = selectedRowKeys.join(",")
      }
      await exportOperationLogs(params)
      message.success(t('system.log.msgExportSuccess'), 3)
    } catch (err) {
      // error handled by axios interceptor
    } finally {
      setExporting(false)
    }
  }

  const handleClear = async () => {
    const values = clearForm.getFieldsValue()
    if (!values.clear_range?.length) {
      message.error(t('system.log.msgClearRangeRequired'), 5)
      return
    }
    setClearing(true)
    try {
      const res = await clearOperationLogs({
        start: values.clear_range[0].startOf('day').toISOString(),
        end: values.clear_range[1].endOf('day').toISOString(),
      })
      message.success(t('system.log.msgClearSuccess').replace('{n}', String(res.deleted)), 3)
      setClearOpen(false)
      clearForm.resetFields()
      setSelectedRowKeys([])
      loadLogs(1, pagination.pageSize, filtersRef.current, sortField, sortOrder)
    } catch (err) {
      // error handled by axios interceptor
    } finally {
      setClearing(false)
    }
  }

  const columns: ColumnsType<OperationLogItem> = [
    {
      title: t('system.log.colTime'),
      dataIndex: 'operation_time',
      key: 'operation_time',
      width: 180,
      sorter: true,
      sortOrder: sortField === 'operation_time' ? sortOrder : null,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t('system.log.colUser'),
      dataIndex: 'user_name',
      key: 'user_name',
      width: 220,
      sorter: true,
      sortOrder: sortField === 'user_name' ? sortOrder : null,
      render: (_: unknown, record: OperationLogItem) => {
        const display = record.user_display_name
        const username = record.user_name
        if (display && username) return `${display}(${username})`
        return display || username || '-'
      },
    },
    {
      title: t('system.log.colType'),
      dataIndex: 'operation_type',
      key: 'operation_type',
      width: 180,
      sorter: true,
      sortOrder: sortField === 'operation_type' ? sortOrder : null,
      render: (v: string) => translateOperationType(v, tStr),
    },
    {
      title: t('system.log.colContent'),
      dataIndex: 'operation_content',
      key: 'operation_content',
      width: 300,
      ellipsis: { showTitle: false },
      render: (value: string | null, record: OperationLogItem) => {
        // 人类可读的操作内容优先展示；无业务文案时降级为 JSON 快照摘要（悬停查看格式化详情）
        let display: string | null = value
        let detail: string | null = value
        if (display == null) {
          const snapshot = record.updated_value_json ?? record.updated_value
          if (typeof snapshot === 'string' && snapshot.trim().startsWith('{')) {
            const { summary, pretty } = formatSnapshot(snapshot)
            display = summary
            detail = pretty
          } else {
            display = snapshot
            detail = snapshot
          }
        }
        if (display && typeof display === 'string') {
          display = translateLogContent(display, tStr)
        }
        return display != null ? (
          <Tooltip title={detail ?? display} placement="topLeft" overlayStyle={{ maxWidth: 480, padding: '0 8px', position: 'fixed' }}>
            <span style={{ padding: '2px 6px' }}>{display}</span>
          </Tooltip>
        ) : (
          <span style={{ color: '#bbb' }}>—</span>
        )
      },
    },
    {
      title: t('system.log.colIP'),
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
      sorter: true,
      sortOrder: sortField === 'ip_address' ? sortOrder : null,
    },
    {
      title: t('system.log.colResult'),
      dataIndex: 'result',
      key: 'result',
      width: 100,
      sorter: true,
      sortOrder: sortField === 'result' ? sortOrder : null,
      render: (v: string) =>
        v === 'success' ? (
          <Tag color="success">{t('system.log.resultSuccess')}</Tag>
        ) : (
          <Tag color="error">{t('system.log.resultFailed')}</Tag>
        ),
    },
    {
      title: t('system.log.labelError'),
      dataIndex: 'error_message',
      key: 'error_message',
      width: 180,
      ellipsis: true,
      render: (value: string | null) =>
          value != null ? (

              <Tooltip title={value} placement="topLeft" overlayStyle={{ maxWidth: 480, padding: '0 8px', position: 'fixed' }}>
              <span
                  style={{
                    padding: '2px 6px',
                  }}
              >
                {value}
              </span>
              </Tooltip>
          ) : (
              <span style={{ color: '#bbb' }}>—</span>
          ),
    },
  ]

  return (
    <div className="main-container">
      <SearchForm
        fields={searchFields}
        form={searchForm}
        expanded={expanded}
        onExpandChange={setExpanded}
        showExpand={showExpand}
        onSearch={handleSearch}
        onReset={handleReset}
        loading={loading}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Space>
          <Button
            icon={<ExportOutlined />}
            loading={exporting}
            onClick={handleExport}
          >
            {t('system.log.btnExport')}
          </Button>
          {canOperate && (
            <Button danger onClick={() => setClearOpen(true)}>
              {t('system.log.btnClear')}
            </Button>
          )}
        </Space>
      </div>

      <ResizableTable<OperationLogItem>
        rowKey="id"
        columns={columns}
        dataSource={list}
        loading={loading}
        scroll={{ x: 1290 }}
        onChange={handleTableChange}
        pagination={tablePaginationProps}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        size="small"
      />

      <Modal
        title={t('system.log.clearTitle')}
        open={clearOpen}
        onCancel={() => {
          setClearOpen(false)
          clearForm.resetFields()
        }}
        onOk={handleClear}
        okText={t('system.log.btnConfirmClear')}
        okButtonProps={{ danger: true, loading: clearing }}
        cancelText={t('common.cancel')}
      >
        <Form form={clearForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="clear_range"
            label={t('system.log.clearRangeLabel')}
            rules={[{ required: true, message: t('system.log.timeRangeRequired') }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Text type="warning">{t('system.log.clearWarning')}</Text>
        </Form>
      </Modal>
    </div>
  )
}
