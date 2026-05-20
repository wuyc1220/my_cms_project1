/**
 * ChannelDetail — 直播频道详情页（CHANNEL 类型专用）
 *
 * URL: /live/channels/:id
 *
 * 页面结构：
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  [海报区]  │  [频道基本信息]  │  [操作入口按钮]  │  [< >]  │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  [生命周期状态条：9 个阶段]                                      │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  [底部 Tab 页：Schedules / License / Packages / Status Logs / Activity Log] │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * i18n：所有界面文字通过 useI18n() 获取
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Button,
  Col,
  Empty,
  Image,
  Modal,
  Row,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  App,
} from 'antd'
import {
  CheckCircleFilled,
  CloseCircleFilled,
  LeftOutlined,
  MinusCircleOutlined,
  PictureOutlined,
  RightOutlined,
  WarningFilled,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getContent, getContentLicenses } from '../../api/contents'
import {
  getProcesses,
  getPhysicalChannels,
} from '../../api/live'
import { getCustomFields } from '../../api/customFields'
import { getPictures } from '../../api/pictures'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useWorkflowNodes } from '../../hooks/useWorkflowNodes'
import { useReviewAndPublish } from '../../hooks/useReviewAndPublish'
import { normalizeNodeCode, type OpStatus, analyzeNodeBatches, calculateOrderFromEdges, isStartOrEndNode } from '../../utils/workflow'
import { useTaskAssigneePermission } from '../../hooks/useTaskAssigneePermission'
import { useAuthStore } from '../../stores/authStore'
import ProcessesTab from '../../components/ProcessesTab'
import LicenseTab from '../../components/LicenseTab'
import StatusLogsTab from '../../components/StatusLogsTab'
import ProcessedHistoryTab from '../../components/ProcessedHistoryTab'
import ObjectIngestHistoryModal from '../../components/ObjectIngestHistoryModal'
import PostersModal from '../../components/PostersModal'
import ChannelScheduleTab from './ChannelScheduleTab'
import PhysicalChannelModal from '../../components/PhysicalChannelModal'
import PackageLinkModal from '../../components/PackageLinkModal'
import CategoryLinkModal from '../../components/CategoryLinkModal'
import MetadataModal from '../../components/MetadataModal'
import ReviewModal from '../../components/ReviewModal'
import PublishPlanModal from '../../components/PublishPlanModal'
import { getDictTree } from '../../api/dicts'
import { getCurrentPublishPlan } from '../../api/publishes'
import type { ContentLicenseRef, ContentTaskAssignees } from '../../types/content'
import type { DictNodeListItem } from '../../types/dict'
import type {
  ChannelDetailItem,
  PhysicalChannelListItem,
  ProcessListItem,
} from '../../types/live'
import type { CustomFieldListItem } from '../../types/basic'
import type { PictureItem } from '../../api/pictures'
import type { MessageKey } from '../../i18n/messages'

const { Text } = Typography

// ─── 常量 ─────────────────────────────────────────────────────────────────────

/**
 * Ingest Status 9 阶段定义
 */
const INGEST_STAGES: { statusKey: string; labelKey: MessageKey }[] = [
  { statusKey: 'None',                labelKey: 'content.status.none' },
  { statusKey: 'WaitingForMaterials', labelKey: 'content.status.waitingForMaterials' },
  { statusKey: 'InProgress',          labelKey: 'content.status.inProgress' },
  { statusKey: 'ReadyForPublish',     labelKey: 'content.status.readyForPublish' },
  { statusKey: 'Publishing',          labelKey: 'content.status.publishing' },
  { statusKey: 'PublishFailed',       labelKey: 'content.status.publishFailed' },
  { statusKey: 'Published',           labelKey: 'content.status.published' },
  { statusKey: 'NoActiveLicense',     labelKey: 'content.status.noActiveLicense' },
  { statusKey: 'Closed',             labelKey: 'content.status.closed' },
]

const STATUS_COLOR: Record<string, string> = {
  Published: 'success',
  InProgress: 'processing',
  WaitingForMaterials: 'warning',
  PublishFailed: 'error',
  Closed: 'error',
  None: 'default',
}

// ─── 子组件：海报区 ─────────────────────────────────────────────────────────

interface PosterSectionProps {
  pictures: PictureItem[]
  blobUrls: string[]
  currentIndex: number
  noPosterLabel: string
  onPrev: () => void
  onNext: () => void
  onSelect: (index: number) => void
}

function PosterSection({
  pictures,
  blobUrls,
  currentIndex,
  noPosterLabel,
  onPrev,
  onNext,
  onSelect,
}: PosterSectionProps) {
  const current = pictures[currentIndex]
  const currentBlobUrl = blobUrls[currentIndex]
  const total = pictures.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {/* 海报图片 */}
      <div
        style={{
          width: 200,
          height: 200,
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          backgroundColor: '#f5f5f5',
        }}
      >
        {current && currentBlobUrl ? (
          <Image
            src={currentBlobUrl}
            alt={current.file_name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            preview={{ src: currentBlobUrl }}
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#bfbfbf' }}>
            <PictureOutlined style={{ fontSize: 48, display: 'block', marginBottom: 8 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>{noPosterLabel}</Text>
          </div>
        )}
      </div>

      {/* 导航：< 1 2 3 ... n > */}
      {total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Button
            size="small"
            icon={<LeftOutlined />}
            onClick={onPrev}
            disabled={currentIndex === 0}
          />
          {Array.from({ length: Math.min(total, 5) }, (_, i) => (
            <Button
              key={i}
              size="small"
              type={i === currentIndex ? 'primary' : 'text'}
              onClick={() => onSelect(i)}
              style={{ minWidth: 24, padding: '0 4px' }}
            >
              {i + 1}
            </Button>
          ))}
          {total > 5 && <Text type="secondary" style={{ fontSize: 12 }}>...</Text>}
          {total > 5 && (
            <Button
              size="small"
              type={currentIndex === total - 1 ? 'primary' : 'text'}
              onClick={() => onSelect(total - 1)}
              style={{ minWidth: 24, padding: '0 4px' }}
            >
              {total}
            </Button>
          )}
          <Button
            size="small"
            icon={<RightOutlined />}
            onClick={onNext}
            disabled={currentIndex === total - 1}
          />
        </div>
      )}
    </div>
  )
}

// ─── 子组件：生命周期状态条 ─────────────────────────────────────────────────

interface StatusBarProps {
  status: string
  stageLabels: string[]
  stageKeys?: string[]
}

function StatusBar({ status, stageLabels, stageKeys }: StatusBarProps) {
  const keys = stageKeys || INGEST_STAGES.map((s) => s.statusKey)
  const currentIndex = keys.findIndex((s) => s === status)

  return (
    <div
      style={{
        display: 'flex',
        border: '1px solid #e8e8e8',
        borderRadius: 6,
        overflow: 'hidden',
        margin: '8px 0',
        backgroundColor: '#fff',
      }}
    >
      {keys.map((stageKey, index) => {
        const isCompleted = index < currentIndex
        const isCurrent   = index === currentIndex
        const isFuture    = index > currentIndex

        return (
          <div
            key={stageKey}
            style={{
              flex: 1,
              padding: '10px 6px',
              textAlign: 'center',
              borderRight: index < keys.length - 1 ? '1px solid #e8e8e8' : 'none',
              backgroundColor: isCurrent ? '#fff7e6' : '#fff',
            }}
          >
            {/* 序号 / 完成图标 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              {isCompleted ? (
                <CheckCircleFilled style={{ color: '#52c41a', fontSize: 14 }} />
              ) : (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isCurrent ? 700 : 400,
                    color: isFuture ? '#bfbfbf' : isCurrent ? '#fa8c16' : '#52c41a',
                  }}
                >
                  {index + 1}
                </span>
              )}
            </div>
            {/* 状态标签 */}
            <div
              style={{
                fontSize: 11,
                marginTop: 2,
                color: isFuture ? '#bfbfbf' : isCurrent ? '#fa8c16' : '#595959',
                fontWeight: isCurrent ? 600 : 400,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={stageLabels[index]}
            >
              {stageLabels[index]}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export default function ChannelDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const [searchParams] = useSearchParams()
  const { t }     = useI18n()
  const { message } = App.useApp()
  const channelId = Number(id)
  const { user } = useAuthStore()
  const mode = searchParams.get('mode') === 'edit' ? 'edit' : 'view'

  // 上下条记录导航（从 sessionStorage 读取列表上下文）
  const idList = useMemo(() => {
    try {
      const raw = sessionStorage.getItem('channel_list_context')
      if (!raw) return []
      const ctx = JSON.parse(raw) as { ids?: number[] }
      return ctx.ids?.filter((n) => typeof n === 'number' && !isNaN(n) && n > 0) ?? []
    } catch (err) {
      return []
    }
  }, [])
  const currentIdx = useMemo(() => idList.findIndex((idx) => idx === channelId), [idList, channelId])
  const prevId = currentIdx > 0 ? idList[currentIdx - 1] : null
  const nextId = currentIdx >= 0 && currentIdx < idList.length - 1 ? idList[currentIdx + 1] : null

  const goToRecord = useCallback((targetId: number) => {
    const params = new URLSearchParams(searchParams)
    navigate(`/live/channels/${targetId}?${params.toString()}`, { replace: true })
  }, [navigate, searchParams])

  // ── 状态 ──────────────────────────────────────────────────────────────────
  const [loading, setLoading]               = useState(true)
  const [channel, setChannel]               = useState<ChannelDetailItem | null>(null)
  const [pictures, setPictures]             = useState<PictureItem[]>([])
  const [picBlobUrls, setPicBlobUrls]       = useState<string[]>([])
  const [currentPicIndex, setCurrentPicIndex] = useState(0)

  // 平台编码→名称映射
  const [platformNameMap, setPlatformNameMap] = useState<Record<string, string>>({})

  // 注入历史弹框
  const [ingestHistoryModal, setIngestHistoryModal] = useState<{ open: boolean }>({ open: false })

  // License Tab 数据
  const [licenses, setLicenses]           = useState<ContentLicenseRef[]>([])

  // Physical Channel Tab 数据
  const [physicalChannels, setPhysicalChannels] = useState<PhysicalChannelListItem[]>([])
  const [physicalChannelsLoading, setPhysicalChannelsLoading] = useState(false)
  const [physicalChannelsLoaded, setPhysicalChannelsLoaded] = useState(false)
  const {
    pagination: physicalChannelsPagination,
    updatePagination: updatePhysicalChannelsPagination,
    tablePaginationProps: physicalChannelsPaginationProps,
    handleTableChange: handlePhysicalChannelsTableChange,
  } = useTablePagination({
    onChange: ({ page, pageSize }) => {
      void loadPhysicalChannels(page, pageSize)
    },
  })

  // Physical Channel 自定义字段
  const [customFields, setCustomFields] = useState<CustomFieldListItem[]>([])

  // 操作按钮弹框状态
  const [postersOpen, setPostersOpen]           = useState(false)
  const [physicalChannelOpen, setPhysicalChannelOpen] = useState(false)
  const [packageLinkOpen, setPackageLinkOpen]   = useState(false)
  const [categoryLinkOpen, setCategoryLinkOpen] = useState(false)
  const [metadataOpen, setMetadataOpen]         = useState(false)

  // 操作按钮状态检测所需数据
  const [hasInitiatedReview, setHasInitiatedReview] = useState(false)

  // 操作按钮状态检测所需数据
  const [_hasPackage, setHasPackage] = useState(false)
  const [_hasCategory, setHasCategory] = useState(false)
  const [hasReview, setHasReview] = useState(false)
  const [_hasPublishPlan, setHasPublishPlan] = useState(false)
  const [processes, setProcesses] = useState<ProcessListItem[]>([])
  const [statusDataVersion, setStatusDataVersion] = useState(0)

  // 发布计划回显状态
  const [localPublishPlanOpen, setLocalPublishPlanOpen] = useState(false)
  const [existingPlanTime, setExistingPlanTime] = useState<string | undefined>(undefined)

  // 任务指派人信息（权限校验用）
  const [taskAssignees, setTaskAssignees] = useState<ContentTaskAssignees | null>(null)

  // 判断是否只读：mode 不是 edit，或者当前用户不是任务分配人
  const isAdmin = user?.role_codes?.includes('ADMIN') ?? false
  const isTaskAssignee = useMemo(() => {
    if (isAdmin) return true
    if (!taskAssignees || !user?.id) return false
    // 判断当前用户是否是 arrangement 任务的分配人
    // 或者是 review L1/L2/L3 任务的分配人（用于内容审批节点）
    const isArrangementAssignee = taskAssignees.arrangement_assignee_id === user.id
    const isReviewL1Assignee = taskAssignees.review_l1_assignee_id === user.id && taskAssignees.review_l1_task_status === 'Pending'
    const isReviewL2Assignee = taskAssignees.review_l2_assignee_id === user.id && taskAssignees.review_l2_task_status === 'Pending'
    const isReviewL3Assignee = taskAssignees.review_l3_assignee_id === user.id && taskAssignees.review_l3_task_status === 'Pending'
    return isArrangementAssignee || isReviewL1Assignee || isReviewL2Assignee || isReviewL3Assignee
  }, [taskAssignees, user?.id, isAdmin])

  // 审核与发布计划 Hook（依赖 processes）
  const {
    reviewOpen,
    reviewMode,
    reviewReadOnly,
    placeholderModal,
    handleReviewAction,
    closeReview,
    closePlaceholder,
  } = useReviewAndPublish({
    contentId: channel?.id,
    contentStatus: channel?.status,
    licenses,
    hasInitiatedReview,
    processes,  // ✅ 传递流程列表
    isTaskAssignee,  // 传递任务分配人权限
    onSuccess: () => void refreshAfterOp(),
  })

  // 流程配置（动态获取节点）
  const {
    operationButtons: workflowOperationButtons,
    workflowNodes,
    workflowEdges,
    checkNodeAvailable,
  } = useWorkflowNodes(channel?.content_type ?? 'CHANNEL')

  // 任务指派人权限校验
  const { checkPermissionAsync, getNoPermissionMessage } = useTaskAssigneePermission({
    taskAssignees,
    contentId: channelId,
    enforceAssignment: true,
  })

  // ── 初始化：加载频道详情 + 许可证 ──────
  useEffect(() => {
    if (!id || isNaN(channelId)) {
      message.error(t('trade.content.detail.msgInvalidId'), 5)
      navigate('/live/channels', { replace: true })
      return
    }
    void (async () => {
      setLoading(true)
      try {
        const [detailResp, lics, dicts] = await Promise.all([
          getContent(channelId),
          getContentLicenses(channelId),
          getDictTree(),
        ])
        // detailResp 是 ContentDetailResponse，包含 content 和 task_assignees
        const detail = detailResp.content as unknown as ChannelDetailItem
        setChannel(detail)
        setTaskAssignees(detailResp.task_assignees)
        setLicenses(lics)

        // 构建平台编码→名称映射
        const platformRoot = dicts.find((d: DictNodeListItem) => d.code === 'Platform')
        const nameMap: Record<string, string> = {}
        if (platformRoot?.children) {
          platformRoot.children.forEach((c) => {
            nameMap[c.code] = c.name
          })
        }
        setPlatformNameMap(nameMap)
      } catch (err) {
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, channelId])

  // ── 加载操作按钮状态检测数据 ──────
  useEffect(() => {
    if (!channelId || isNaN(channelId)) return

    void (async () => {
      try {
        const { getContentPackages } = await import('../../api/live')
        const packagesResp = await getContentPackages(channelId)
        setHasPackage(packagesResp.length > 0)
      } catch (err) {
        setHasPackage(false)
      }

      try {
        const { getContentCategories } = await import('../../api/live')
        const categoriesResp = await getContentCategories(channelId)
        setHasCategory(categoriesResp.length > 0)
      } catch (err) {
        setHasCategory(false)
      }

      try {
        const processesResp = await getProcesses(channelId)
        setProcesses(processesResp)
        const anyReview = processesResp.find((p) => p.node_code === 'ContentReview')
        setHasInitiatedReview(!!anyReview)
        const passedReview = processesResp.find((p) => p.node_code === 'ContentReview' && p.status === 'Passed')
        setHasReview(!!passedReview)
      } catch (err) {
        setHasInitiatedReview(false)
        setHasReview(false)
      }

      try {
        const { getPublishes } = await import('../../api/publishes')
        const publishesResp = await getPublishes({ page: 1, page_size: 100 })
        const completedStatuses = ['plan', 'publishing', 'success']
        const contentPublishes = publishesResp.items.filter(
          (item) => item.entity_id === channelId && completedStatuses.includes(item.publish_status)
        )
        setHasPublishPlan(contentPublishes.length > 0)
      } catch (err) {
        setHasPublishPlan(false)
      }

      // 加载物理频道数据（用于判断 PhysicalChannel 节点状态）
      try {
        const res = await getPhysicalChannels(channelId, { page: 1, page_size: 1 })
        updatePhysicalChannelsPagination({ ...res, page: physicalChannelsPagination.current, page_size: physicalChannelsPagination.pageSize })
      } catch (err) {
        updatePhysicalChannelsPagination({ total: 0, page: physicalChannelsPagination.current, page_size: physicalChannelsPagination.pageSize })
      }
    })()
  }, [channelId, statusDataVersion])

  // ── 独立加载海报（不阻塞页面渲染）──────
  useEffect(() => {
    if (!id || isNaN(channelId)) return

    let cancelled = false

    void (async () => {
      try {
        const pics = await getPictures('channel', channelId)
        if (cancelled) return
        setPictures(pics)

        const token = localStorage.getItem('token')
        const blobs = await Promise.all(
          pics.map(async (pic) => {
            try {
              const resp = await fetch(pic.url, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              })
              if (!resp.ok) return ''
              return URL.createObjectURL(await resp.blob())
            } catch (err) {
              return ''
            }
          })
        )
        if (!cancelled) {
          setPicBlobUrls(blobs)
        }
      } catch (err) {
        // 海报加载失败不影响主页面
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, channelId])

  // 组件卸载时释放 blob URLs
  useEffect(() => {
    return () => { picBlobUrls.forEach((u) => { if (u) URL.revokeObjectURL(u) }) }
  }, [picBlobUrls])

  // ── Tab 懒加载 ─────────────────────────────────────────────────────────────
  const loadPhysicalChannels = useCallback(async (page: number, pageSize?: number) => {
    setPhysicalChannelsLoading(true)
    try {
      const ps = pageSize ?? physicalChannelsPagination.pageSize
      const [res, cfRes] = await Promise.all([
        getPhysicalChannels(channelId, { page, page_size: ps }),
        getCustomFields({ page_size: 1000 }),
      ])
      setPhysicalChannels(res.items)
      updatePhysicalChannelsPagination(res)
      setPhysicalChannelsLoaded(true)

      const fields = cfRes.items.filter(
        (f) => f.belongings.includes('ALL') || f.belongings.includes('PhysicalChannel')
      )
      setCustomFields(fields)
    } catch (err) {
    } finally {
      setPhysicalChannelsLoading(false)
    }
  }, [channelId, t, physicalChannelsPagination.pageSize, updatePhysicalChannelsPagination])

  const handleTabChange = useCallback(
    (key: string) => {
      if (key === 'physicalChannel' && !physicalChannelsLoaded && !physicalChannelsLoading) {
        void loadPhysicalChannels(1)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channelId, physicalChannelsLoaded, physicalChannelsLoading, loadPhysicalChannels],
  )

  // ── 操作成功后刷新数据 ─────────────────────────────────────────────────
  const refreshAfterOp = useCallback(async () => {
    try {
      // 使用与初始化相同的 API，确保数据结构一致
      const detailResp = await getContent(channelId)
      const detail = detailResp.content as unknown as ChannelDetailItem
      setChannel(detail)
      setTaskAssignees(detailResp.task_assignees)
    } catch (err) { /* ignore */ }
    setStatusDataVersion((v) => v + 1)
    void getPictures('channel', channelId).then(setPictures)
  }, [channelId])

  // ── 操作按钮点击处理 ─────────────────────────────────────────────────────
  // 判断是否只读：基于 arrangement 任务状态
  const readOnly = useMemo(() => {
    const modeIsEdit = mode === 'edit'
    
    // 如果 URL 不是 edit 模式,只读
    if (!modeIsEdit) return true
    
    // ADMIN 用户永远不受限制
    if (isAdmin) return false
    
    // 基于 arrangement 任务状态判断是否锁定
    // 任务已完成(Completed) → 锁定(不允许编辑)
    // 任务待处理/处理中(Pending/InProgress) → 允许编辑
    const arrangementStatus = taskAssignees?.arrangement_task_status
    if (arrangementStatus === 'Completed') {
      return true
    }
    
    return false
  }, [mode, isAdmin, taskAssignees?.arrangement_task_status])

  const handleOpButtonClick = useCallback(
    async (key: string, label: string) => {
      const normalizedKey = normalizeNodeCode(key)

      // ContentReview 节点特殊处理：不在这里拦截权限，让 handleReviewAction 处理
      // 非审批人可以以只读模式查看审批流程
      if (normalizedKey !== 'ContentReview' && !readOnly) {
        const { allowed, message: permissionMsg } = await checkPermissionAsync(key)
        if (!allowed) {
          void message.error(permissionMsg || getNoPermissionMessage(key), 5)
          return
        }
      }
      if (normalizedKey === 'Posters') {
        setPostersOpen(true)
        return
      }
      // CHANNEL 类型的 InjectSubContent 节点对应 PhysicalChannel
      if (normalizedKey === 'InjectSubContent' || normalizedKey === 'PhysicalChannel') {
        setPhysicalChannelOpen(true)
        return
      }
      if (normalizedKey === 'Package') {
        setPackageLinkOpen(true)
        return
      }
      if (normalizedKey === 'Category') {
        setCategoryLinkOpen(true)
        return
      }
      if (normalizedKey === 'Metadata') {
        setMetadataOpen(true)
        return
      }
      if (normalizedKey === 'PublishPlan') {
        // 获取当前发布计划时间用于回显
        if (channelId) {
          try {
            const plan = await getCurrentPublishPlan('Content', channelId)
            setExistingPlanTime(plan?.scheduled_time)
          } catch {
            setExistingPlanTime(undefined)
          }
        }
        setLocalPublishPlanOpen(true)
        return
      }
      await handleReviewAction(key, label)
    },
    [handleReviewAction, checkPermissionAsync, readOnly, t, message],
  )

  // ── 列定义 ─────────────────────────────────────────────────────────────────

  const physicalChannelColumns: ColumnsType<PhysicalChannelListItem> = [
    {
      title: t('physicalChannel.col.mediaservice'),
      dataIndex: 'mediaservice',
      key: 'mediaservice',
      width: 120,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('physicalChannel.col.definition'),
      dataIndex: 'definition',
      key: 'definition',
      width: 100,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('physicalChannel.col.videoencode'),
      dataIndex: 'videoencode',
      key: 'videoencode',
      width: 120,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('physicalChannel.col.bitrate'),
      dataIndex: 'bitrate',
      key: 'bitrate',
      width: 100,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('physicalChannel.col.deeplinkChUrl'),
      dataIndex: 'deeplink_ch_url',
      key: 'deeplink_ch_url',
      width: 160,
      ellipsis: { showTitle: false },
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('physicalChannel.col.shifttime'),
      dataIndex: 'shifttime',
      key: 'shifttime',
      width: 100,
      render: (v?: number) => v ?? '—',
    },
    {
      title: t('physicalChannel.col.tvodSaveTime'),
      dataIndex: 'tvod_save_time',
      key: 'tvod_save_time',
      width: 120,
      render: (v?: number) => v ?? '—',
    },
    {
      title: t('physicalChannel.col.tvodEnable'),
      dataIndex: 'tvod_enable',
      key: 'tvod_enable',
      width: 100,
      align: 'center',
      render: (v?: boolean) => <Switch disabled checked={v ?? false} size="small" />,
    },
    {
      title: t('physicalChannel.col.tstvEnable'),
      dataIndex: 'tstv_enable',
      key: 'tstv_enable',
      width: 100,
      align: 'center',
      render: (v?: boolean) => <Switch disabled checked={v ?? false} size="small" />,
    },
    {
      title: t('physicalChannel.col.cutvEnable'),
      dataIndex: 'cutv_enable',
      key: 'cutv_enable',
      width: 100,
      align: 'center',
      render: (v?: boolean) => <Switch disabled checked={v ?? false} size="small" />,
    },
    {
      title: t('physicalChannel.col.encryption'),
      dataIndex: 'encryption',
      key: 'encryption',
      width: 100,
      align: 'center',
      render: (v?: boolean) => <Switch disabled checked={v ?? false} size="small" />,
    },
    ...customFields.map((field) => ({
      title: field.field_name,
      key: `cf_${field.field_code}`,
      width: 120,
      render: (_: unknown, record: PhysicalChannelListItem) => {
        const val = record.field_values?.[field.field_code]
        return val ?? '—'
      },
    })),
  ]

  // ── Tab 项目构建 ──────────────────────────────────────────────────────────

  const tabItems = [
    {
      key: 'processes',
      label: t('content.tab.processes'),
      children: <ProcessesTab contentId={channelId} refreshVersion={statusDataVersion} />,
    },
    {
      key: 'license',
      label: t('content.tab.license'),
      children: <LicenseTab contentId={channelId} refreshVersion={statusDataVersion} />,
    },
    {
      key: 'statusLogs',
      label: t('content.tab.statusLogs'),
      children: <StatusLogsTab contentId={channelId} refreshVersion={statusDataVersion} />,
    },
    {
      key: 'activityLog',
      label: t('content.tab.activityLog'),
      children: <ProcessedHistoryTab contentId={channelId} refreshVersion={statusDataVersion} mode="detail" />,
    },
    {
      key: 'physicalChannel',
      label: t('content.tab.physicalChannel'),
      children: (
        <Table<PhysicalChannelListItem>
          rowKey="id"
          size="small"
          loading={physicalChannelsLoading}
          columns={physicalChannelColumns}
          dataSource={physicalChannels}
          scroll={{ x: 1200 }}
          pagination={physicalChannelsPaginationProps}
          onChange={handlePhysicalChannelsTableChange}
          locale={{ emptyText: t('live.channel.emptyPhysicalChannels') }}
        />
      ),
    },
    {
      key: 'schedule',
      label: t('content.tab.schedule'),
      children: (
        <ChannelScheduleTab
          channelId={channelId}
          channelName={channel?.title ?? ''}
          mode={mode}
        />
      ),
    },
  ]

  // ── 渲染 ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!channel) {
    return <Empty description={t('trade.content.detail.emptyContent')} style={{ marginTop: 80 }} />
  }

  // 从许可证推导供应商名称（去重）
  const providerNames =
    licenses.length > 0
      ? [...new Set(licenses.map((l) => l.provider_name))].filter(Boolean).join(', ')
      : '—'

  // 从许可证推导平台列表（去重）
  const platformTags =
    licenses.length > 0
      ? [...new Set(licenses.flatMap((l) => l.platforms?.map((p) => p.platform) ?? []))]
      : []

  const getOperationStatus = (key: string): OpStatus => {
    const normalizedKey = normalizeNodeCode(key)
    switch (normalizedKey) {
      case 'Metadata':
        return processes.some((p) => p.node_code === 'Metadata' && p.status === 'Passed') ? 'completed' : 'pending'
      case 'Posters':
        return pictures.length > 0 ? 'completed' : 'pending'
      // CHANNEL 类型的 InjectSubContent 节点对应 PhysicalChannel
      case 'InjectSubContent':
      case 'PhysicalChannel': {
        const hasInjectSubContent = processes.some((p) => p.node_code === 'InjectSubContent' && p.status === 'Passed')
        const hasPhysicalChannel = processes.some((p) => p.node_code === 'PhysicalChannel' && p.status === 'Passed')
        return (hasInjectSubContent || hasPhysicalChannel) ? 'completed' : 'pending'
      }
      case 'Package':
        return processes.some((p) => p.node_code === 'Package' && p.status === 'Passed') ? 'completed' : 'pending'
      case 'Category':
        return processes.some((p) => p.node_code === 'Category' && p.status === 'Passed') ? 'completed' : 'pending'
      case 'ApplicationReview':
        return processes.some((p) => p.node_code === 'ApplicationReview') ? 'completed' : 'pending'
      case 'ContentReview':
        return hasReview ? 'completed' : 'pending'
      case 'PublishPlan':
        return processes.some((p) => p.node_code === 'PublishPlan' && p.status === 'Passed') ? 'completed' : 'pending'
      default:
        return 'pending'
    }
  }

  const defaultButtons = [
    { id: 1, key: 'PhysicalChannel', label: t('content.op.physicalChannel' as MessageKey), mandatory: true },
    { id: 2, key: 'Metadata',        label: t('content.op.metadata' as MessageKey),        mandatory: true },
    { id: 3, key: 'Posters',         label: t('content.op.posters' as MessageKey),         mandatory: true },
    { id: 4, key: 'Package',         label: t('content.op.package' as MessageKey),         mandatory: true },
    { id: 5, key: 'Category',        label: t('content.op.category' as MessageKey),        mandatory: true },
    { id: 6, key: 'ContentReview',   label: t('content.op.contentReview' as MessageKey),   mandatory: true },
    { id: 7, key: 'PublishPlan',     label: t('content.op.publishPlan' as MessageKey),     mandatory: true },
  ]

  const allOperationButtons = workflowOperationButtons.length > 0
    ? workflowOperationButtons
    : defaultButtons

  // view 模式下也显示所有按钮（通过 available 控制是否可点击）
  const operationButtons = allOperationButtons

  // 生命周期状态条的已翻译标签数组
  const stageLabels = INGEST_STAGES.map((s) => t(s.labelKey))

  return (
    <div className="main-container">
      {/* ── 顶部信息区域 ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 20px' }}>
        <Row gutter={24} align="top" wrap={false}>
          {/* 左：海报区 */}
          <Col flex="220px">
            <PosterSection
              pictures={pictures}
              blobUrls={picBlobUrls}
              currentIndex={currentPicIndex}
              noPosterLabel={t('content.detail.noPoster')}
              onPrev={() => setCurrentPicIndex((i) => Math.max(0, i - 1))}
              onNext={() => setCurrentPicIndex((i) => Math.min(pictures.length - 1, i + 1))}
              onSelect={setCurrentPicIndex}
            />
          </Col>

          {/* 中：频道基本信息 */}
          <Col flex="1" style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12,width:80,display:"inline-block" }}>
                  {t('content.detail.contentName')}:{' '}
                </Text>
                <Text strong style={{ fontSize: 15 }}>{channel.title}</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12,width:80,display:"inline-block" }}>
                  {t('content.detail.contentType')}:{' '}
                </Text>
                <Tag color="blue">{channel.content_type}</Tag>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12,width:80,display:"inline-block" }}>
                  {t('content.detail.provider')}:{' '}
                </Text>
                <Text>{providerNames}</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12,width:80,display:"inline-block" }}>
                  {t('content.detail.platform')}:{' '}
                </Text>
                {platformTags.length > 0 ? (
                  <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                    {platformTags.map((p) => (
                      <Tag key={p} style={{ fontSize: 11 }}>
                        {platformNameMap[p] || p}
                      </Tag>
                    ))}
                  </span>
                ) : (
                  <Text type="secondary">—</Text>
                )}
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12,width:80,display:"inline-block" }}>
                  {t('content.detail.ingestStatus')}:{' '}
                </Text>
                <Tag
                  color={STATUS_COLOR[channel.status] ?? 'default'}
                  style={{ fontSize: 12, cursor: 'pointer' }}
                  onClick={() => setIngestHistoryModal({ open: true })}
                >
                  {channel.status}
                </Tag>
              </div>
            </div>
          </Col>

          {/* 右：操作入口按钮区（动态从流程配置获取，含状态图标和可用性判断） */}
          <Col flex="0 0  600px">
            <div
              style={{
                display: 'grid',
                gridTemplateRows: 'repeat(3, auto)',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gridAutoFlow: 'column',
                gap: '10px 8px',
                paddingTop: 4,
                marginRight: '50px',
              }}
            >
              {operationButtons.map((btn) => {
                const key = btn.key
                const label = btn.label
                const status = getOperationStatus(key)
                // 按钮始终可点击，点击时判断前置节点是否完成
                const available = checkNodeAvailable(btn.id, getOperationStatus)
                const statusIcon = (() => {
                  if (status === 'completed') return <CheckCircleFilled style={{ color: '#52c41a', fontSize: 14 }} />
                  if (status === 'warning') return <WarningFilled style={{ color: '#faad14', fontSize: 14 }} />
                  return <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 14 }} />
                })()
                return (
                  <Tooltip
                    key={key}
                    title={!available ? t('content.detail.nodeNotAvailable') : undefined}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                      onClick={() => {
                        if (readOnly || available) {
                          handleOpButtonClick(key, label)
                        } else {
                          const orderMap = calculateOrderFromEdges(workflowNodes, workflowEdges)
                          const sortedNodes = [...workflowNodes]
                            .filter((n) => n.node_type !== 'parallel_box' && !isStartOrEndNode(n.node_code))
                            .sort((a, b) => {
                              const orderA = orderMap.get(a.id)
                              const orderB = orderMap.get(b.id)
                              if (orderA !== undefined && orderB !== undefined) {
                                return orderA - orderB
                              }
                              return a.sequence - b.sequence
                            })
                          const nodeBatchMap = analyzeNodeBatches(workflowNodes, workflowEdges)
                          const currentBatch = nodeBatchMap.get(btn.id)
                          const prevBatchNodes = sortedNodes.filter(
                            (node) => {
                              const batch = nodeBatchMap.get(node.id)
                              return batch !== undefined && currentBatch !== undefined && batch < currentBatch
                            }
                          )
                          const firstPendingNode = prevBatchNodes.find(
                            (node) => getOperationStatus(node.node_code) === 'pending'
                          )
                          if (firstPendingNode) {
                            const pendingNodeName = firstPendingNode.node_name
                            message.warning(t('content.detail.prevNodeIncomplete', { name: pendingNodeName }), 3)
                          } else {
                            message.warning(t('content.detail.nodeNotAvailable'), 3)
                          }
                        }
                      }}
                    >
                      {statusIcon}
                      <Text
                        style={{
                          color: '#1677ff',
                          fontSize: 13,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {label}
                      </Text>
                    </div>
                  </Tooltip>
                )
              })}
            </div>
          </Col>

          {/* 最右：记录导航 */}
          <Col flex="0 0 auto" style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 4 }}>
            <Button.Group>
              <Tooltip title={t('content.detail.prevRecord')}>
                <Button icon={<LeftOutlined />} disabled={prevId === null} onClick={() => prevId !== null && goToRecord(prevId)} />
              </Tooltip>
              <Tooltip title={t('content.detail.nextRecord')}>
                <Button icon={<RightOutlined />} disabled={nextId === null} onClick={() => nextId !== null && goToRecord(nextId)} />
              </Tooltip>
            </Button.Group>
          </Col>
        </Row>
      </div>

      {/* ── 生命周期状态条 ─────────────────────────────────────────────────── */}
      <div style={{ margin: '8px 0' }}>
        <StatusBar status={channel.status} stageLabels={stageLabels} />
      </div>

      {/* ── 底部 Tab 页 ──────────────────────────────────────────────────────── */}
      <div style={{ padding: '0 16px 16px' }}>
        <Tabs
          defaultActiveKey="processes"
          onChange={handleTabChange}
          items={tabItems}
        />
      </div>

      {/* ── 操作弹框（view/edit 模式都可用，view 模式 readOnly 仅做预览） ─────────────────────────────── */}
      <PostersModal
            open={postersOpen}
            entityType="channel"
            entityId={channel.id}
            entityName={channel.title}
            readOnly={readOnly}
            onClose={() => {
              setPostersOpen(false)
              setStatusDataVersion((v) => v + 1)
              void (async () => {
                const pics = await getPictures('channel', channel.id)
                setPictures(pics)
                const token = localStorage.getItem('token')
                const blobs = await Promise.all(
                  pics.map(async (pic) => {
                    try {
                      const resp = await fetch(pic.url, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                      })
                      if (!resp.ok) return ''
                      return URL.createObjectURL(await resp.blob())
                    } catch (err) {
                      return ''
                    }
                  })
                )
                setPicBlobUrls(blobs)
              })()
            }}
          />

          <PhysicalChannelModal
            open={physicalChannelOpen}
            channelId={channel.id}
            readOnly={readOnly}
            onClose={() => setPhysicalChannelOpen(false)}
            onSuccess={() => { setPhysicalChannelOpen(false); void refreshAfterOp() }}
          />

          <PackageLinkModal
            open={packageLinkOpen}
            contentId={channel.id}
            contentName={channel.title}
            readOnly={readOnly}
            onClose={() => setPackageLinkOpen(false)}
            onSuccess={() => { setPackageLinkOpen(false); void refreshAfterOp() }}
          />

          <CategoryLinkModal
            open={categoryLinkOpen}
            contentId={channel.id}
            contentName={channel.title}
            readOnly={readOnly}
            onClose={() => setCategoryLinkOpen(false)}
            onSuccess={() => { setCategoryLinkOpen(false); void refreshAfterOp() }}
          />

          <MetadataModal
            open={metadataOpen}
            contentId={channel.id}
            contentType={channel.content_type}
            contentName={channel.title}
            readOnly={readOnly}
            onClose={() => setMetadataOpen(false)}
            onSuccess={() => { setMetadataOpen(false); void refreshAfterOp() }}
          />

          <ReviewModal
            open={reviewOpen}
            contentId={channel.id}
            contentName={channel.title}
            mode={reviewMode}
            readOnly={reviewReadOnly}
            onClose={closeReview}
            onSuccess={() => { closeReview(); void refreshAfterOp() }}
          />

          <PublishPlanModal
            open={localPublishPlanOpen}
            contentId={channel?.id}
            contentName={channel?.title}
            initialScheduledTime={existingPlanTime}
            readOnly={readOnly}
            onClose={() => { setLocalPublishPlanOpen(false); setExistingPlanTime(undefined) }}
            onSuccess={() => { setLocalPublishPlanOpen(false); setExistingPlanTime(undefined); void refreshAfterOp() }}
          />

          <Modal
        open={placeholderModal !== null}
        title={placeholderModal ?? ''}
        onCancel={closePlaceholder}
        footer={
          <Button onClick={closePlaceholder}>
            {t('content.detail.back')}
          </Button>
        }
        destroyOnHidden
      >
        <div
          style={{
            minHeight: 120,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8c8c8c',
            gap: 8,
          }}
        >
          <MinusCircleOutlined style={{ fontSize: 36, color: '#d9d9d9' }} />
          <Text type="secondary">{t('content.detail.comingSoon')}</Text>
        </div>
      </Modal>

      {/* 注入历史弹框 */}
      {channel && (
        <ObjectIngestHistoryModal
          open={ingestHistoryModal.open}
          entityType="Content"
          entityId={channel.id}
          entityName={channel.title || `Channel #${channel.id}`}
          onClose={() => setIngestHistoryModal({ open: false })}
        />
      )}
    </div>
  )
}