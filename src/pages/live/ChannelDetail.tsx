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
  Dropdown,
  Empty,
  Image,
  Modal,
  Row,
  Space,
  Spin,
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
import { getContent, getContentLicenses, getNodeStatus } from '../../api/contents'
import type { NodeStatus } from '../../api/contents'
import {
  getProcesses,
  getPhysicalChannels,
} from '../../api/live'
import api, { isHandledError } from '../../api'
import { getPictures } from '../../api/pictures'
import { useI18n } from '../../i18n/useI18n'
import { useTablePagination } from '../../hooks/useTablePagination'
import { useWorkflowNodes } from '../../hooks/useWorkflowNodes'
import { useReviewAndPublish } from '../../hooks/useReviewAndPublish'
import { normalizeNodeCode, type OpStatus, analyzeNodeBatches, findPrevPendingNodeName } from '../../utils/workflow'
import { useTaskAssigneePermission } from '../../hooks/useTaskAssigneePermission'
import { useNodeEditPermission } from '../../hooks/useNodeEditPermission'
import { useAuthStore } from '../../stores/authStore'
import ProcessesTab from '../../components/ProcessesTab'
import ResizableTable from '../../components/ResizableTable'
import LicenseTab from '../../components/LicenseTab'
import StatusLogsTab from '../../components/StatusLogsTab'
import ProcessedHistoryTab from '../../components/ProcessedHistoryTab'
import PostersModal from '../../components/PostersModal'
import ChannelScheduleTab from './ChannelScheduleTab'
import PhysicalChannelModal from '../../components/PhysicalChannelModal'
import PhysicalChannelTable from '../../components/PhysicalChannelTable'
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
import type { PictureItem } from '../../api/pictures'
import { checkPicturesPublishStatus } from '../../api/pictures'
import type { MessageKey } from '../../i18n/messages'
import { getIngestHistories } from '../../api/ingestHistory'
import type { IngestHistoryItem } from '../../types/ingestHistory'
import dayjs from 'dayjs'

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
  const [ingestHistoryList, setIngestHistoryList] = useState<IngestHistoryItem[]>([])
  const [ingestHistoryLoading, setIngestHistoryLoading] = useState(false)
  const [ingestHistoryPagination, setIngestHistoryPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  const loadIngestHistory = useCallback(async (page: number, pageSize: number) => {
    if (!channel) return
    setIngestHistoryLoading(true)
    try {
      const res = await getIngestHistories({
        entity_type: 'Content',
        entity_id: channel.id,
        page,
        page_size: pageSize,
      })
      setIngestHistoryList(res.items)
      setIngestHistoryPagination({ current: page, pageSize, total: res.total })
    } catch (err) {
      if (!isHandledError(err)) message.error(t('ingestHistory.msg.loadFailed'), 5)
    } finally {
      setIngestHistoryLoading(false)
    }
  }, [channel, t])

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

  // 操作按钮弹框状态
  const [postersOpen, setPostersOpen]           = useState(false)
  const [physicalChannelOpen, setPhysicalChannelOpen] = useState(false)
  const [packageLinkOpen, setPackageLinkOpen]   = useState(false)
  const [categoryLinkOpen, setCategoryLinkOpen] = useState(false)
  const [metadataOpen, setMetadataOpen]         = useState(false)

  // 操作按钮状态检测所需数据
  const [hasInitiatedReview, setHasInitiatedReview] = useState(false)

  const [processes, setProcesses] = useState<ProcessListItem[]>([])
  const [nodeStatus, setNodeStatus] = useState<Record<string, NodeStatus>>({})
  const [statusDataVersion, setStatusDataVersion] = useState(0)

  // 发布计划回显状态
  const [localPublishPlanOpen, setLocalPublishPlanOpen] = useState(false)
  const [existingPlanTime, setExistingPlanTime] = useState<string | undefined>(undefined)
  const [publishInfo, setPublishInfo] = useState<import('../../components/PublishPlanModal').PublishInfo | undefined>(undefined)

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

  const readOnly = useMemo(() => {
    const modeIsEdit = mode === 'edit'
    if (!modeIsEdit) return true
    if (isAdmin) return false
    return false
  }, [mode, isAdmin])

  // 节点级编辑权限判断
  const nodeEditPermission = useNodeEditPermission({
    taskAssignees,
    isAdmin,
    currentUserId: user?.id ?? null,
    forceReadOnly: mode === 'view', // 已废弃频道强制只读，包括Admin
  })

  // 判断指定节点是否只读（用于弹框）
  const isNodeReadOnlyMemo = useCallback(
    (nodeCode: string) => {
      return nodeEditPermission.isNodeReadOnly(nodeCode)
    },
    [nodeEditPermission]
  )

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
    contentType: channel?.content_type,
    licenses,
    hasInitiatedReview,
    processes,
    isTaskAssignee,
    pageReadOnly: readOnly,
    isNodeReadOnly: isNodeReadOnlyMemo,
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
  const { checkPermissionAsync } = useTaskAssigneePermission({
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
        // 刷新内容详情（包含 content.status）
        const detailResp = await getContent(channelId)
        const detail = detailResp.content as unknown as ChannelDetailItem
        setChannel(detail)
        setTaskAssignees(detailResp.task_assignees)
      } catch (err) {
        // 忽略错误
      }

      try {
        const ns = await getNodeStatus(channelId)
        setNodeStatus(ns)
      } catch (err) {
        setNodeStatus({})
      }

      try {
        const processesResp = await getProcesses(channelId)
        setProcesses(processesResp)
        const applicationReview = processesResp.find((p) => p.node_code === 'ApplicationReview')
        setHasInitiatedReview(!!applicationReview)
      } catch (err) {
        setHasInitiatedReview(false)
      }

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
      const res = await getPhysicalChannels(channelId, { page, page_size: ps })
      setPhysicalChannels(res.items)
      updatePhysicalChannelsPagination(res)
      setPhysicalChannelsLoaded(true)
    } catch (err) {
    } finally {
      setPhysicalChannelsLoading(false)
    }
  }, [channelId, physicalChannelsPagination.pageSize, updatePhysicalChannelsPagination])

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
      const detailResp = await getContent(channelId)
      const detail = detailResp.content as unknown as ChannelDetailItem
      setChannel(detail)
      setTaskAssignees(detailResp.task_assignees)
    } catch (err) { /* ignore */ }
    setStatusDataVersion((v) => v + 1)
    void getPictures('channel', channelId).then(setPictures)
    void loadPhysicalChannels(physicalChannelsPagination.current)
  }, [channelId, loadPhysicalChannels, physicalChannelsPagination.current])

  // ── 操作按钮点击处理 ─────────────────────────────────────────────────────

  // 发布计划弹框的只读状态：使用节点级权限判断（与其他节点一致）
  const publishPlanReadOnly = useMemo(() => {
    return isNodeReadOnlyMemo('PublishPlan')
  }, [isNodeReadOnlyMemo])

  const handleOpButtonClick = useCallback(
    async (key: string, label: string) => {
      const normalizedKey = normalizeNodeCode(key)
      console.log('[handleOpButtonClick] key=', key, 'normalizedKey=', normalizedKey, 'hasInitiatedReview=', hasInitiatedReview)

      // 审核与发布相关节点：仅有查看权限的账号（非任务分配人且非Admin）禁止操作，提示无权限
      // 分配人即使节点临时只读（如审核进行中）仍可打开只读弹框查看进度
      if (
        !isTaskAssignee &&
        ['ApplicationReview', 'ContentReview', 'Review', 'PublishPlan'].includes(normalizedKey)
      ) {
        message.warning(t('common.msg.noPermission'), 3)
        return
      }

      // 节点级权限判断：不可编辑时直接打开弹框（只读模式）
      // 不再拦截，有数据权限的用户都可以查看节点内容
      // 弹框的只读状态由 isNodeReadOnlyMemo(nodeCode) 控制
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
        console.log('[handleOpButtonClick] PublishPlan, channelId=', channelId, 'channel?.content_type=', channel?.content_type)
        // 校验海报是否已发布（只对 SCHEDULE 和 CHANNEL 类型）
        if (channelId && channel?.content_type && ['SCHEDULE', 'CHANNEL'].includes(channel.content_type)) {
          try {
            console.log('[handleOpButtonClick] PublishPlan checking pictures...')
            const checkResult = await checkPicturesPublishStatus('Content', channelId, channel.content_type)
            console.log('[handleOpButtonClick] PublishPlan checkResult=', checkResult)
            if (!checkResult.can_publish) {
              message.error(
                t('content.publishPlan.picturesNotPublished', {
                  unpublished: checkResult.unpublished_count,
                  total: checkResult.total_count,
                }),
                5
              )
              return
            }
          } catch (err) {
            console.log('[handleOpButtonClick] PublishPlan checkPicturesPublishStatus error:', err)
          }
        } else {
          console.log('[handleOpButtonClick] PublishPlan skipping picture check')
        }

        if (channelId) {
          try {
            const plan = await getCurrentPublishPlan('Content', channelId)
            setExistingPlanTime(plan?.scheduled_time)
            if (plan) {
              setPublishInfo({
                publish_status: plan.publish_status,
                publish_time: plan.publish_time,
                unpublish_time: plan.unpublish_time,
                task_type: plan.task_type as 'publish' | 'unpublish',
                execution_mode: plan.execution_mode,
                scheduled_time: plan.scheduled_time,
              })
            } else {
              setPublishInfo(undefined)
            }
          } catch {
            setExistingPlanTime(undefined)
            setPublishInfo(undefined)
          }
        }
        setLocalPublishPlanOpen(true)
        return
      }
      // ApplicationReview、ContentReview 统一走 handleReviewAction
      console.log('[handleOpButtonClick] calling handleReviewAction with key=', key)
      const result = await handleReviewAction(key, label)
      console.log('[handleOpButtonClick] handleReviewAction returned=', result)
    },
    [handleReviewAction, checkPermissionAsync, readOnly, t, message, isNodeReadOnlyMemo, channelId, hasInitiatedReview, isTaskAssignee],
  )

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
        <PhysicalChannelTable
          channelId={channelId}
          dataSource={physicalChannels}
          loading={physicalChannelsLoading}
          paginationProps={physicalChannelsPaginationProps}
          onTableChange={handlePhysicalChannelsTableChange}
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

  const getOperationStatus = (key: string, mandatory?: boolean): OpStatus => {
    const normalizedKey = normalizeNodeCode(key)
    if (normalizedKey === 'Start' || normalizedKey === 'End') return 'completed'
    const node = nodeStatus[normalizedKey]
    if (!node) return 'pending'
    if (node.completed) return 'completed'
    // 必填节点 warning 视为未完成（pending，红叉）；非必填节点保持 warning（可选未完成）
    if (node.warning && mandatory === false) return 'warning'
    return 'pending'
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
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <Text type="secondary" style={{ fontSize: 12, width:100, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {t('content.detail.contentName')}:{' '}
                </Text>
                <Text strong style={{ fontSize: 15, wordBreak: 'break-all' }}>{channel.title}</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <Text type="secondary" style={{ fontSize: 12, width: 100, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {t('content.detail.contentType')}:{' '}
                </Text>
                <Tag color="blue">{channel.content_type}</Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <Text type="secondary" style={{ fontSize: 12, width: 100, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {t('content.detail.provider')}:{' '}
                </Text>
                <Text style={{ wordBreak: 'break-all' }}>{providerNames}</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <Text type="secondary" style={{ fontSize: 12, width: 100, flexShrink: 0, whiteSpace: 'nowrap' }}>
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
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <Text type="secondary" style={{ fontSize: 12, width: 100, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {t('content.detail.genre')}:{' '}
                </Text>
                <Text style={{ wordBreak: 'break-all' }}>{channel.genre_name || '—'}</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <Text type="secondary" style={{ fontSize: 12, width: 100, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {t('content.detail.ingestStatus')}:{' '}
                </Text>
                <Tag
                  color={STATUS_COLOR[channel.status] ?? 'default'}
                  style={{ fontSize: 12, cursor: 'pointer' }}
                  onClick={() => {
                    setIngestHistoryModal({ open: true })
                    void loadIngestHistory(1, 10)
                  }}
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
                const status = getOperationStatus(key, btn.mandatory)
                // 按钮始终可点击，点击时判断前置节点是否完成
                const available = checkNodeAvailable(btn.id, getOperationStatus)
                const statusIcon = (() => {
                  if (status === 'completed') return <CheckCircleFilled style={{ color: '#52c41a', fontSize: 14 }} />
                  if (status === 'warning') return <WarningFilled style={{ color: '#faad14', fontSize: 14 }} />
                  return <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 14 }} />
                })()
                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => {
                      // 有数据权限就可以点击查看（只读模式），不检查前置节点
                      // 编辑模式需要检查前置节点是否全部完成
                      if (!isNodeReadOnlyMemo(key) && !available) {
                        const nodeBatchMap = analyzeNodeBatches(workflowNodes, workflowEdges)
                        const pendingName = findPrevPendingNodeName(btn.id, workflowNodes, workflowEdges, nodeBatchMap, getOperationStatus)
                        message.warning(t('content.detail.prevNodeIncomplete', { name: pendingName ?? '' }), 3)
                        return
                      }
                      handleOpButtonClick(key, label)
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
                )
              })}
            </div>
          </Col>

          {/* 最右：记录导航 */}
          <Col flex="0 0 auto" style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 4 }}>
            <Space.Compact>
              <Tooltip title={t('content.detail.prevRecord')}>
                <Button icon={<LeftOutlined />} disabled={prevId === null} onClick={() => prevId !== null && goToRecord(prevId)} />
              </Tooltip>
              <Tooltip title={t('content.detail.nextRecord')}>
                <Button icon={<RightOutlined />} disabled={nextId === null} onClick={() => nextId !== null && goToRecord(nextId)} />
              </Tooltip>
            </Space.Compact>
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
            readOnly={isNodeReadOnlyMemo('Posters')}
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
            readOnly={isNodeReadOnlyMemo('PhysicalChannel')}
            onClose={() => setPhysicalChannelOpen(false)}
            // onSuccess 仅刷新父页数据；新增成功后弹框内部自动关闭，删除后停留弹框内
            onSuccess={() => void refreshAfterOp()}
          />

          <PackageLinkModal
            open={packageLinkOpen}
            contentId={channel.id}
            contentName={channel.title}
            readOnly={isNodeReadOnlyMemo('Package')}
            onClose={() => setPackageLinkOpen(false)}
            onSuccess={() => { setPackageLinkOpen(false); void refreshAfterOp() }}
          />

          <CategoryLinkModal
            open={categoryLinkOpen}
            contentId={channel.id}
            contentName={channel.title}
            readOnly={isNodeReadOnlyMemo('Category')}
            onClose={() => setCategoryLinkOpen(false)}
            onSuccess={() => { setCategoryLinkOpen(false); void refreshAfterOp() }}
          />

          <MetadataModal
            open={metadataOpen}
            contentId={channel.id}
            contentType={channel.content_type}
            contentName={channel.title}
            readOnly={isNodeReadOnlyMemo('Metadata')}
            onClose={() => setMetadataOpen(false)}
            onSuccess={() => { setMetadataOpen(false); void refreshAfterOp() }}
          />

          <ReviewModal
            open={reviewOpen}
            contentId={channel.id}
            contentName={channel.title}
            mode={reviewMode}
            readOnly={reviewReadOnly}
            hasInitiatedReview={hasInitiatedReview}
            onClose={closeReview}
            onSuccess={() => { closeReview(); void refreshAfterOp() }}
          />

          <PublishPlanModal
            open={localPublishPlanOpen}
            contentId={channel?.id}
            contentName={channel?.title}
            contentType={channel?.content_type ?? 'CHANNEL'}
            initialScheduledTime={existingPlanTime}
            publishInfo={publishInfo}
            hasPublishHistory={!!publishInfo}
            readOnly={publishPlanReadOnly}
            onClose={() => { setLocalPublishPlanOpen(false); setExistingPlanTime(undefined); setPublishInfo(undefined) }}
            onSuccess={() => { setLocalPublishPlanOpen(false); setExistingPlanTime(undefined); setPublishInfo(undefined); void refreshAfterOp() }}
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
      <Modal
        title={`${channel?.title || ''} - ${t('ingestHistory.title')}`}
        open={ingestHistoryModal.open}
        onCancel={() => setIngestHistoryModal({ open: false })}
        width={1000}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button type="primary" onClick={() => setIngestHistoryModal({ open: false })}>
              {t('ingestHistory.btn.close')}
            </Button>
          </div>
        }
      >
        <ResizableTable
          rowKey="id"
          dataSource={ingestHistoryList}
          loading={ingestHistoryLoading}
          size="small"
          scroll={{ x: 900 }}
          pagination={{
            current: ingestHistoryPagination.current,
            pageSize: ingestHistoryPagination.pageSize,
            total: ingestHistoryPagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (n: number) => t('pagination.total', { n }),
            onChange: (page, pageSize) => void loadIngestHistory(page, pageSize),
          }}
          columns={[
            { title: t('publish.ingestHistory.col.type'), dataIndex: 'entity_name', key: 'entity_name', width: 140, ellipsis: true },
            {
              title: t('publish.ingestHistory.col.createDate'),
              dataIndex: 'create_date',
              key: 'create_date',
              width: 180,
              render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
            },
            {
              title: t('publish.ingestHistory.col.sendDate'),
              dataIndex: 'send_date',
              key: 'send_date',
              width: 180,
              render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
            },
            {
              title: t('publish.ingestHistory.col.endDate'),
              dataIndex: 'end_date',
              key: 'end_date',
              width: 180,
              render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
            },
            {
              title: t('publish.ingestHistory.col.status'),
              dataIndex: 'status',
              key: 'status',
              width: 110,
              render: (v) => (
                <Tag color={v === 'success' ? 'success' : v === 'failure' ? 'error' : 'default'}>
                  {v === 'success' ? t('publish.ingestHistory.status.success') : v === 'failure' ? t('publish.ingestHistory.status.failure') : v}
                </Tag>
              ),
            },
            {
              title: t('publish.ingestHistory.col.getXml'),
              key: 'getXml',
              align: 'center',
              width: 120,
              render: (_, record: IngestHistoryItem) => {
                const handleDownload = async (url: string, filename: string) => {
                  try {
                    // 如果 URL 以 /api/v1 开头，去掉前缀，因为 axios baseURL 已经包含 /api/v1
                    const requestUrl = url.startsWith('/api/v1') ? url.slice(7) : url
                    const response = await api.get(requestUrl, {
                      responseType: 'blob',
                    })
                    const blob = new Blob([response.data])
                    const link = document.createElement('a')
                    link.href = URL.createObjectURL(blob)
                    link.download = filename
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    URL.revokeObjectURL(link.href)
                  } catch (err) {
                    if (!isHandledError(err)) message.error(t('publish.msg.downloadFailed'))
                  }
                }
                const menuItems = []
                if (record.ingest_xml_url) {
                  menuItems.push({
                    key: 'ingest',
                    label: t('publish.ingestHistory.xml.ingest'),
                    onClick: () => {
                      const ingestUrl = record.ingest_xml_url!
                      const urlParams = new URLSearchParams(ingestUrl.split('?')[1])
                      const path = urlParams.get('path') || ''
                      const filename = path.split('/').pop() || 'ingest.xml'
                      void handleDownload(ingestUrl, filename)
                    },
                  })
                }
                if (record.result_xml_url) {
                  menuItems.push({
                    key: 'result',
                    label: t('publish.ingestHistory.xml.result'),
                    onClick: () => {
                      const resultUrl = record.result_xml_url!
                      const urlParams = new URLSearchParams(resultUrl.split('?')[1])
                      const path = urlParams.get('path') || ''
                      const filename = path.split('/').pop() || 'result.xml'
                      void handleDownload(resultUrl, filename)
                    },
                  })
                }
                if (menuItems.length === 0) {
                  return '—'
                }
                return (
                  <Dropdown menu={{ items: menuItems }} placement="bottom">
                    <Button type="link" size="small">
                      {t('publish.ingestHistory.col.getXml')}
                    </Button>
                  </Dropdown>
                )
              },
            },
          ]}
        />
      </Modal>
    </div>
  )
}