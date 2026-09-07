/**
 * ContentDetailPage — 内容详情 / 编辑入口页（通用）
 *
 * URL: /contents/:id
 *
 * 适用于所有内容类型：MOVIE / EPISODE / SERIES / SEASON / CHANNEL / SCHEDULE
 *
 * 页面结构：
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  [海报区]  │  [内容基本信息]  │  [操作入口按钮（可点击）]  │  [< >]  │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  [生命周期状态条：9 个阶段]                                      │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  [底部 Tab 页：Processes / License / Status Logs / Activity Log  │
 * │    + 类型专属 Tab（Media File / Episodes / Season Series）]       │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * i18n：所有界面文字通过 useI18n() 获取，随 SYSTEM_UI_LANGUAGE 参数切换
 *        cn → 中文（内容名称、无状态、缺失材料 …）
 *        en → 英文（Content Name、None、WaitingForMaterials …）
 *
 * 操作按钮状态：
 * - Posters → 已对接 PostersModal（真实功能）
 * - 其他按钮 → 可点击，弹出"功能待实现"提示（后续迭代实现各弹框）
 * - License Tab → 展示真实数据（来自 /contents/{id}/licenses）
 * - 其余 Tab → 列定义完整，数据待后端接口就绪后对接
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
  DownloadOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  MinusCircleOutlined,
  PictureOutlined,
  RightOutlined,
  WarningFilled,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getContent, getContentChildren, getContentLicenses, getAdjacentContent, getNodeStatus } from '../../api/contents'
import { getPictures } from '../../api/pictures'
import { getMoviesByContentId } from '../../api/movies'
import { getProcesses } from '../../api/live'
import { getDictChildren, getDictTree } from '../../api/dicts'
import { getMetadataDetail } from '../../api/metadata'
import { getCurrentPublishPlan } from '../../api/publishes'
import { getPublishedWorkflow } from '../../api/workflow'
import { useI18n } from '../../i18n/useI18n'
import PostersModal from '../../components/PostersModal'
import { useReviewAndPublish } from '../../hooks/useReviewAndPublish'
import { useTaskAssigneePermission } from '../../hooks/useTaskAssigneePermission'
import { useNodeEditPermission } from '../../hooks/useNodeEditPermission'
import { useAuthStore } from '../../stores/authStore'
import MetadataModal from '../../components/MetadataModal'
import MaterialsModal from '../../components/MaterialsModal'
import CastRoleMapModal from '../../components/CastRoleMapModal'
import CategoryLinkModal from '../../components/CategoryLinkModal'
import PhysicalChannelModal from '../../components/PhysicalChannelModal'
import ReviewModal from '../../components/ReviewModal'
import PublishPlanModal from '../../components/PublishPlanModal'
import PackageLinkModal from '../../components/PackageLinkModal'
import EpisodeInjectModal from '../../components/EpisodeInjectModal'
import SeasonSeriesInjectModal from '../../components/SeasonSeriesInjectModal'
import type { ContentListItem, ContentLicenseRef, ContentTaskAssignees } from '../../types/content'
import type { NodeStatus } from '../../api/contents'
import type { DictNodeListItem } from '../../types/dict'
import type { PictureItem } from '../../api/pictures'
import type { MovieItem } from '../../types/metadata'
import type { LanguageOption } from '../../types/i18n'
import type { ProcessListItem } from '../../types/live'
import type { MessageKey } from '../../i18n/messages'
import type { WorkflowConfigDetail, WorkflowNodeConfigItem } from '../../types/workflow'
import { isStartOrEndNode, normalizeNodeCode, findPrevPendingNodeName } from '../../utils/workflow'
import ProcessesTab from '../../components/ProcessesTab'
import LicenseTab from '../../components/LicenseTab'
import StatusLogsTab from '../../components/StatusLogsTab'
import ProcessedHistoryTab from '../../components/ProcessedHistoryTab'
import { getIngestHistories } from '../../api/ingestHistory'
import type { IngestHistoryItem } from '../../types/ingestHistory'
import api, { isHandledError } from '../../api'
import { getClientPaginationProps } from '../../constants/pagination'


const { Text } = Typography

// ─── 常量 ─────────────────────────────────────────────────────────────────────

/**
 * Ingest Status 9 阶段定义。
 * labelKey 对应 messages.ts 中的 i18n key，cn/en 自动切换。
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

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/**
 * 根据 content_type 返回对应的 entityType（用于 getPictures API）
 * MOVIE/EPISODE → "program" | SERIES/SEASON_SERIES/SEASON → "series" | CHANNEL → "channel"
 */
function getEntityType(contentType: string): string {
  if (contentType === 'MOVIE' || contentType === 'EPISODE') return 'program'
  if (contentType === 'SERIES' || contentType === 'SEASON_SERIES' || contentType === 'SEASON') return 'series'
  if (contentType === 'CHANNEL') return 'channel'
  return 'program'
}

/**
 * 根据 content_type 返回对应的流程配置所属模块
 * MOVIE → "MOVIE" | EPISODE → "EPISODE" | SERIES/SEASON → "SEASON" | CHANNEL → "CHANNEL" | SCHEDULE → "SCHEDULE"
 */
function getWorkflowBelonging(contentType: string, isArchived?: boolean): string {
  // 归档内容根据 content_type 使用不同的流程配置
  if (isArchived) {
    if (contentType === 'MOVIE') return 'ARCHIVED_MOVIE'
    if (contentType === 'EPISODE') return 'ARCHIVED_EPISODE'
    // 其他归档内容类型(如 SERIES/SEASON)暂时使用 ARCHIVED_MOVIE
    return 'ARCHIVED_MOVIE'
  }
  if (contentType === 'MOVIE') return 'MOVIE'
  if (contentType === 'EPISODE') return 'EPISODE'
  if (contentType === 'SERIES') return 'SERIES'
  if (contentType === 'SEASON_SERIES') return 'SEASON_SERIES'
  if (contentType === 'SEASON') return 'SEASON'
  if (contentType === 'CHANNEL') return 'CHANNEL'
  if (contentType === 'SCHEDULE') return 'SCHEDULE'
  return 'MOVIE'
}

/**
 * 根据边的连线计算节点顺序（拓扑排序）
 * 返回每个节点的顺序号（从0开始）
 */
function calculateOrderFromEdges(
  nodes: WorkflowNodeConfigItem[],
  edges: Array<{ source: string | number; target: string | number }>
): Map<string | number, number> {
  if (!edges || edges.length === 0) {
    return new Map()
  }

  const processNodes = nodes.filter(
    (n) => !isStartOrEndNode(n.node_code)
  )

  const adj = new Map<string | number, Set<string | number>>()
  const inDegree = new Map<string | number, number>()

  processNodes.forEach((n) => {
    inDegree.set(n.id, 0)
    adj.set(n.id, new Set())
  })

  edges.forEach((edge) => {
    const source = edge.source
    const target = edge.target
    if (adj.has(source) && adj.has(target)) {
      adj.get(source)!.add(target)
      inDegree.set(target, (inDegree.get(target) || 0) + 1)
    }
  })

  const queue: (string | number)[] = []
  const order = new Map<string | number, number>()
  let seq = 0

  processNodes.forEach((n) => {
    if (inDegree.get(n.id) === 0 && !n.parent_node_id) {
      queue.push(n.id)
    }
  })

  while (queue.length > 0) {
    const current = queue.shift()!
    order.set(current, seq++)

    adj.get(current)!.forEach((next) => {
      const newDegree = (inDegree.get(next) || 0) - 1
      inDegree.set(next, newDegree)
      if (newDegree === 0) {
        queue.push(next)
      }
    })
  }

  const coveredNodes = new Set(order.keys())
  const uncoveredNodes = processNodes.filter((n) => !coveredNodes.has(n.id))

  if (uncoveredNodes.length > 0) {
    const parallelBoxChildren = new Map<string | number, WorkflowNodeConfigItem[]>()
    uncoveredNodes.forEach((n) => {
      if (n.parent_node_id) {
        const parentId = n.parent_node_id
        if (!parallelBoxChildren.has(parentId)) {
          parallelBoxChildren.set(parentId, [])
        }
        parallelBoxChildren.get(parentId)!.push(n)
      }
    })

    parallelBoxChildren.forEach((children, parentId) => {
      const parentOrder = order.get(parentId)
      if (parentOrder !== undefined) {
        const sortedChildren = children.sort((a, b) => a.sequence - b.sequence)
        sortedChildren.forEach((child) => {
          order.set(child.id, parentOrder + 0.5 + child.sequence * 0.01)
        })
      }
    })

    processNodes.forEach((n) => {
      if (!order.has(n.id)) {
        order.set(n.id, seq + n.sequence)
      }
    })
  }

  return order
}

/**
 * 根据 content_type 返回操作入口按钮列表（i18n key）
 * 按照图2进行编排：3列布局，非必须项（Trailer、MusicEffects）放在最后
 * 排列顺序（按列优先，gridAutoFlow: column）：
 *   第1列：Episodes/Materials/SeasonSeries → Metadata → Posters → CastRoleMap
 *   第2列：Package → Category → Review → PublishPlan
 *   第3列：Trailer → MusicEffects（非必须，放最后）
 */
function getOperationButtonKeys(contentType: string): { key: string; labelKey: MessageKey }[] {
  // 获取类型专属按钮
  const getTypeSpecificButton = (): { key: string; labelKey: MessageKey } | null => {
    switch (contentType) {
      case 'MOVIE':
      case 'EPISODE':
        return { key: 'Materials', labelKey: 'content.op.materials' }
      case 'SERIES':
      case 'SEASON_SERIES':
        return { key: 'Episodes', labelKey: 'content.op.episodes' }
      case 'SEASON':
        return { key: 'SeasonSeries', labelKey: 'content.op.seasonSeries' }
      case 'CHANNEL':
        return { key: 'PhysicalChannel', labelKey: 'content.op.physicalChannel' }
      default:
        return null
    }
  }

  const typeSpecific = getTypeSpecificButton()
  const isVod = ['MOVIE', 'EPISODE', 'SERIES', 'SEASON_SERIES', 'SEASON'].includes(contentType)

  // 按列组织按钮（每列最多4个，保持对齐）
  // 第1列按钮
  const col1: { key: string; labelKey: MessageKey }[] = []
  if (typeSpecific) col1.push(typeSpecific)
  col1.push({ key: 'Metadata', labelKey: 'content.op.metadata' })
  col1.push({ key: 'Posters', labelKey: 'content.op.posters' })
  if (isVod) col1.push({ key: 'CastRoleMap', labelKey: 'content.op.castRoleMap' })

  // 第2列按钮
  const col2: { key: string; labelKey: MessageKey }[] = [
    { key: 'Package', labelKey: 'content.op.package' },
    { key: 'Category', labelKey: 'content.op.category' },
    { key: 'Review', labelKey: 'content.op.review' },
    { key: 'PublishPlan', labelKey: 'content.op.publishPlan' },
  ]

  // 第3列按钮（非必须项）
  const col3: { key: string; labelKey: MessageKey }[] = []
  if (isVod) {
    col3.push({ key: 'Trailer', labelKey: 'content.op.trailer' })
    col3.push({ key: 'MusicEffects', labelKey: 'content.op.musicEffects' })
  }

  // 计算最大行数
  const maxRows = Math.max(col1.length, col2.length, col3.length)

  // 按列优先方式组装数组（先取每列第1个，再取每列第2个...）
  const result: { key: string; labelKey: MessageKey }[] = []
  for (let row = 0; row < maxRows; row++) {
    if (row < col1.length) result.push(col1[row])
    if (row < col2.length) result.push(col2[row])
    if (row < col3.length) result.push(col3[row])
  }

  return result
}

// ─── 操作按钮状态检测 ────────────────────────────────────────────────────────

type OpStatus = 'completed' | 'warning' | 'pending'

function getOperationStatus(
  key: string,
  nodeStatus: Record<string, NodeStatus>,
  mandatory?: boolean
): OpStatus {
  const normalizedKey = normalizeNodeCode(key)
  if (normalizedKey === 'Start' || normalizedKey === 'End') return 'completed'
  const node = nodeStatus[normalizedKey]
  if (!node) return 'pending'
  if (node.completed) return 'completed'
  // 非必填节点：未完成以 warning（可选未完成）展示
  // 必填节点：warning 视为未完成（pending），前端按必填显示红叉，且阻塞后续节点
  if (node.warning && mandatory === false) return 'warning'
  return 'pending'
}

// ─── 节点可用性判断逻辑 ──────────────────────────────────────────────────────

/**
 * 分析流程节点，识别串行和并行批次
 * 返回每个节点所属的批次号（从0开始）
 * 注意：Start/End 节点不参与校验
 */
function analyzeNodeBatches(
  nodes: WorkflowNodeConfigItem[],
  edges: Array<{ source: string | number; target: string | number }>
): Map<number, number> {
  const nodeBatchMap = new Map<number, number>()

  // 使用拓扑排序确定节点顺序
  const orderMap = calculateOrderFromEdges(nodes, edges)

  // 过滤掉 Start/End 节点（包括中文）和 parallel_box 节点，它们不参与校验
  const processNodes = [...nodes]
    .filter((n) => n.node_type !== 'parallel_box' && !isStartOrEndNode(n.node_code))
    .sort((a, b) => {
      const orderA = orderMap.get(a.id)
      const orderB = orderMap.get(b.id)
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB
      }
      // 如果没有拓扑顺序，回退到 sequence
      return a.sequence - b.sequence
    })

  let currentBatch = 0
  let prevNodeIsParallel = false

  for (const node of processNodes) {
    // 并行盒子子节点：同一批次内的节点应属同一 batch
    if (node.parent_node_id) {
      if (!prevNodeIsParallel) {
        currentBatch++
      }
      nodeBatchMap.set(node.id, currentBatch)
      prevNodeIsParallel = true
      continue
    }

    const isParallel = node.node_type === 'parallel_box' || node.parallel_rule

    if (isParallel) {
      // 并行节点属于当前批次
      nodeBatchMap.set(node.id, currentBatch)
      prevNodeIsParallel = true
    } else {
      // 串行节点
      if (prevNodeIsParallel) {
        // 上一个节点是并行的，开启新批次
        currentBatch++
      }
      nodeBatchMap.set(node.id, currentBatch)
      currentBatch++
      prevNodeIsParallel = false
    }
  }

  return nodeBatchMap
}

/**
 * 判断节点是否可用（能否操作）
 *
 * @param nodeId 当前节点ID
 * @param nodes 所有流程节点
 * @param edges 所有边的连线
 * @param getNodeStatus 获取节点完成状态的函数
 * @returns 节点是否可用
 *
 * 规则：
 * 1. 串行节点：前面的批次全部完成后，才能操作
 * 2. 并行节点：同一批次内的节点不分先后，只要前置批次完成即可
 * 3. 并行后的串行节点：必须等上一批次的所有并行节点全部完成
 */
function isNodeAvailable(
  nodeId: number,
  nodes: WorkflowNodeConfigItem[],
  edges: Array<{ source: string | number; target: string | number }>,
  nodeBatchMap: Map<number, number>,  // 接收缓存的批次映射
  getNodeStatus: (nodeCode: string, mandatory?: boolean) => 'completed' | 'warning' | 'pending'
): boolean {
  if (nodes.length === 0) return true

  const currentBatch = nodeBatchMap.get(nodeId)

  if (currentBatch === undefined) {
    return true
  }
  if (currentBatch === 0) {
    return true // 第一批次总是可用
  }

  // 使用拓扑排序确定节点顺序
  const orderMap = calculateOrderFromEdges(nodes, edges)

  // 检查所有前置批次是否全部完成
  // 过滤掉 Start/End 节点（包括中文）和 parallel_box 节点，它们不参与校验
  const sortedNodes = [...nodes]
    .filter((n) => n.node_type !== 'parallel_box' && !isStartOrEndNode(n.node_code))
    .sort((a, b) => {
      const orderA = orderMap.get(a.id)
      const orderB = orderMap.get(b.id)
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB
      }
      return a.sequence - b.sequence
    })

  // 收集所有前置批次的节点
  const prevBatchNodes = sortedNodes.filter(
    (node) => {
      const batch = nodeBatchMap.get(node.id)
      return batch !== undefined && batch < currentBatch
    }
  )

  // 检查前置批次的所有必填节点是否都已完成（warning 表示可选未完成，不阻塞）
  for (const node of prevBatchNodes) {
    const status = getNodeStatus(node.node_code, node.mandatory)
    // completed 为完成，warning 为可选未完成，只有必填节点的 pending 才阻塞
    // mandatory: false 的节点（非必须环节），即使 pending 也不阻塞后续操作
    if (status === 'pending' && node.mandatory !== false) {
      return false
    }
  }

  return true
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
// 使用外部传入的已翻译 labels，避免在子组件内部重复调用 useI18n

interface StatusBarProps {
  status: string
  stageLabels: string[]  // 状态名称列表
  stageKeys?: string[]   // 状态key列表（用于从流程配置动态获取）
}

function StatusBar({ status, stageLabels, stageKeys }: StatusBarProps) {
  // 使用 stageKeys 如果提供，否则使用默认的 INGEST_STAGES
  const stages = stageKeys || INGEST_STAGES.map((s) => s.statusKey)
  const currentIndex = stages.findIndex((s) => s === status)

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
      {stages.map((stageKey, index) => {
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
              borderRight: index < stages.length - 1 ? '1px solid #e8e8e8' : 'none',
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
            {/* 状态标签（随语言切换） */}
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

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const { t }     = useI18n()
  const { message } = App.useApp()
  const contentId = Number(id)
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()

  // ── 状态 ──────────────────────────────────────────────────────────────────
  const [loading, setLoading]               = useState(true)
  const [content, setContent]               = useState<ContentListItem | null>(null)
  const [adjacentPrevId, setAdjacentPrevId]   = useState<number | null>(null)
  const [adjacentNextId, setAdjacentNextId]   = useState<number | null>(null)
  const [pictures, setPictures]             = useState<PictureItem[]>([])
  const [picBlobUrls, setPicBlobUrls]       = useState<string[]>([])
  const [currentPicIndex, setCurrentPicIndex] = useState(0)

  // License Tab 数据
  const [licenses, setLicenses]           = useState<ContentLicenseRef[]>([])
  const [licensesLoading, setLicensesLoading] = useState(false)
  const [licensesLoaded, setLicensesLoaded]   = useState(false)

  // 平台编码→名称映射
  const [platformNameMap, setPlatformNameMap] = useState<Record<string, string>>({})

  // Media File Tab 数据
  const [movies, setMovies] = useState<MovieItem[]>([])
  const [moviesLoading, setMoviesLoading] = useState(false)
  const [moviesLoaded, setMoviesLoaded] = useState(false)

  // 字典选项（媒资文件表格使用）
  const [dictOptions, setDictOptions] = useState<Record<string, LanguageOption[]>>({})
  const [dictOptionsLoaded, setDictOptionsLoaded] = useState(false)

  // 操作按钮状态检测所需数据
  const [hasInitiatedReview, setHasInitiatedReview] = useState(false)
  const [processes, setProcesses] = useState<ProcessListItem[]>([])
  const [nodeStatus, setNodeStatus] = useState<Record<string, NodeStatus>>({})
  const [statusDataVersion, setStatusDataVersion] = useState(0)
  const [opStatusLoading, setOpStatusLoading] = useState(true)

  // 任务指派人信息（权限校验用）
  const [taskAssignees, setTaskAssignees] = useState<ContentTaskAssignees | null>(null)

  // 判断是否只读：URL mode 不是 edit，或者当前用户不是任务分配人
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
  
  // 节点级编辑权限判断
  const nodeEditPermission = useNodeEditPermission({
    taskAssignees,
    isAdmin,
    currentUserId: user?.id ?? null,
    forceReadOnly: searchParams.get('mode') !== 'edit', // 非edit模式强制只读，包括Admin
  })

  // 判断指定节点是否只读（用于弹框）
  const isNodeReadOnlyMemo = useCallback(
    (nodeCode: string) => {
      return nodeEditPermission.isNodeReadOnly(nodeCode)
    },
    [nodeEditPermission]
  )
  
  // 全局readOnly：保留用于兼容，基于URL mode判断
  // 具体节点的可编辑状态由 canEditNode 动态判断
  const readOnly = useMemo(() => {
    const modeIsEdit = searchParams.get('mode') === 'edit'
    if (!modeIsEdit) return true
    if (isAdmin) return false
    return false
  }, [searchParams, isAdmin])

  // 发布计划弹框的只读状态：使用节点级权限判断（与其他节点一致）
  const publishPlanReadOnly = useMemo(() => {
    return isNodeReadOnlyMemo('PublishPlan')
  }, [isNodeReadOnlyMemo])

  // 操作按钮弹框状态
  const [postersOpen, setPostersOpen]           = useState(false)
  const [metadataOpen, setMetadataOpen]         = useState(false)
  const [materialsOpen, setMaterialsOpen]       = useState(false)
  const [materialsFixedType, setMaterialsFixedType] = useState<number | undefined>(undefined)
  const [castRoleMapOpen, setCastRoleMapOpen] = useState(false)
  const [categoryLinkOpen, setCategoryLinkOpen] = useState(false)
  const [physicalChannelOpen, setPhysicalChannelOpen] = useState(false)
  const [packageLinkOpen, setPackageLinkOpen] = useState(false)

  // 发布计划回显状态（独立于 useReviewAndPublish）
  const [localPublishPlanOpen, setLocalPublishPlanOpen] = useState(false)
  const [existingPlanTime, setExistingPlanTime] = useState<string | undefined>(undefined)
  const [publishInfo, setPublishInfo] = useState<import('../../components/PublishPlanModal').PublishInfo | undefined>(undefined)

  const {
    reviewOpen,
    reviewMode,
    reviewReadOnly,
    placeholderModal,
    handleReviewAction,
    closeReview,
    closePlaceholder,
  } = useReviewAndPublish({
    contentId: contentId,
    contentStatus: content?.status,
    contentType: content?.content_type,
    licenses,
    hasInitiatedReview,
    processes,
    isTaskAssignee,
    pageReadOnly: readOnly,
    isNodeReadOnly: isNodeReadOnlyMemo,
    onSuccess: () => void refreshAfterOp(),
  })

  // 任务指派人权限校验
  const { checkPermissionAsync } = useTaskAssigneePermission({
    taskAssignees,
    contentId,
    enforceAssignment: true,
  })

  // Episode / Season Series 注入弹框
  const [episodeInjectOpen, setEpisodeInjectOpen] = useState(false)
  const [seasonSeriesInjectOpen, setSeasonSeriesInjectOpen] = useState(false)

  // 流程配置
  const [, setWorkflowConfig] = useState<WorkflowConfigDetail | null>(null)
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNodeConfigItem[]>([])
  const [workflowEdges, setWorkflowEdges] = useState<Array<{ source: string | number; target: string | number }>>([])

  // 底部 Tab 子内容数据
  const [episodes, setEpisodes] = useState<ContentListItem[]>([])
  const [episodesLoading, setEpisodesLoading] = useState(false)
  const [episodesLoaded, setEpisodesLoaded] = useState(false)
  const [seasonSeries, setSeasonSeries] = useState<ContentListItem[]>([])
  const [seasonSeriesLoading, setSeasonSeriesLoading] = useState(false)
  const [seasonSeriesLoaded, setSeasonSeriesLoaded] = useState(false)

  // 注入历史弹框
  const [ingestHistoryModal, setIngestHistoryModal] = useState<{ open: boolean }>({ open: false })
  const [ingestHistoryList, setIngestHistoryList] = useState<IngestHistoryItem[]>([])
  const [ingestHistoryLoading, setIngestHistoryLoading] = useState(false)
  const [ingestHistoryPagination, setIngestHistoryPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  const loadIngestHistory = async (page: number, pageSize: number) => {
    if (!content) return
    setIngestHistoryLoading(true)
    try {
      const res = await getIngestHistories({
        entity_type: 'Content',
        entity_id: content.id,
        page,
        page_size: pageSize,
      })
      setIngestHistoryList(res.items)
      setIngestHistoryPagination({ current: page, pageSize, total: res.total })
    } catch (err) {
      if (!isHandledError(err)) void message.error(t('ingestHistory.msg.loadFailed'), 5)
    } finally {
      setIngestHistoryLoading(false)
    }
  }

  const handleOpenIngestHistory = () => {
    setIngestHistoryModal({ open: true })
    void loadIngestHistory(1, 10)
  }

  // ── 初始化：加载内容详情 + 许可证（用于顶部 Provider 展示）+ 海报 ──────
  useEffect(() => {
    if (!id || isNaN(contentId)) {
      message.error(t('content.msg.invalidContentId'), 5)
      navigate('/vod/contents', { replace: true })
      return
    }
    void (async () => {
        setLoading(true)
        try {
        // 元数据接口不依赖第一批返回数据，提前启动与第一批并行请求
        const metadataPromise = getMetadataDetail(contentId)
        const [detailResp, lics, dicts] = await Promise.all([
          getContent(contentId),
          getContentLicenses(contentId),
          getDictTree(),
        ])
        // detailResp 是 ContentDetailResponse，包含 content 和 task_assignees
        const detail = detailResp.content
        setContent(detail)
        setTaskAssignees(detailResp.task_assignees)
        setLicenses(lics)
        setLicensesLoaded(true)

        // 构建平台编码→名称映射
        const platformRoot = dicts.find((d: DictNodeListItem) => d.code === 'Platform')
        const nameMap: Record<string, string> = {}
        if (platformRoot?.children) {
          platformRoot.children.forEach((c) => {
            nameMap[c.code] = c.name
          })
        }
        setPlatformNameMap(nameMap)

        // 并行加载第二批数据：海报 + 元数据（元数据已提前启动，此处仅等结果）
        const entityType = getEntityType(detail.content_type)
        const [picsResult, _metadataResult] = await Promise.allSettled([
          getPictures(entityType, contentId),
          metadataPromise,
        ])

        // 处理海报结果
        if (picsResult.status === 'fulfilled') {
          const pics = picsResult.value
          setPictures(pics)
          // 异步加载 blob URL，不阻塞页面
          const token = localStorage.getItem('token')
          Promise.all(
            pics.map(async (pic: PictureItem) => {
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
          ).then(blobs => setPicBlobUrls(blobs)).catch(() => {})
        }

        // 并行加载第二批数据：操作按钮状态检测数据（不阻塞主页面展示）
        const belonging = getWorkflowBelonging(detail.content_type, detail.is_archived)
        const isVodType = detail.content_type === 'MOVIE' || detail.content_type === 'EPISODE'
        const isSeriesType = detail.content_type === 'SERIES' || detail.content_type === 'SEASON_SERIES'
        const isSeasonType = detail.content_type === 'SEASON'

        Promise.allSettled([
          getProcesses(contentId),
          getNodeStatus(contentId),
          isVodType ? getMoviesByContentId(contentId) : Promise.resolve({ items: [] }),
          getPublishedWorkflow(belonging),
          (() => {
            const source = searchParams.get('source')
            const strategies: Record<string, { contentTypes?: string[]; isArchived?: boolean }> = {
              content_management: {},
              channel_management: { contentTypes: ['CHANNEL'] },
              schedule_management: { contentTypes: ['SCHEDULE'] },
              archive_management: { contentTypes: ['MOVIE', 'EPISODE', 'SERIES', 'SEASON', 'SEASON_SERIES'], isArchived: true },
              vod_management: { contentTypes: ['MOVIE', 'EPISODE', 'SERIES', 'SEASON', 'SEASON_SERIES'] },
            }
            const strategy = source ? strategies[source] : undefined
            if (strategy) {
              return getAdjacentContent(contentId, strategy.contentTypes, strategy.isArchived)
            } else {
              return getAdjacentContent(contentId, [detail.content_type], detail.is_archived)
            }
          })(),
          isSeriesType ? getContentChildren(contentId, 'EPISODE') : Promise.resolve({ items: [] }),
          isSeasonType ? getContentChildren(contentId, 'SEASON_SERIES') : Promise.resolve({ items: [] }),
        ]).then(([procResult, nodeStatusResult, movieResult, wfResult, adjResult, episodesResult, seasonSeriesResult]) => {
          if (procResult.status === 'fulfilled') {
            const processesResp = procResult.value
            setProcesses(processesResp)
            const applicationReview = processesResp.find((p) => p.node_code === 'ApplicationReview')
            setHasInitiatedReview(!!applicationReview)
          }
          if (nodeStatusResult.status === 'fulfilled') {
            setNodeStatus(nodeStatusResult.value)
          }
          // 处理媒资文件
          if (movieResult.status === 'fulfilled') {
            setMovies(movieResult.value.items)
          }
          // 处理流程配置
          if (wfResult.status === 'fulfilled') {
            const workflowResp = wfResult.value
            if (workflowResp) {
              setWorkflowConfig(workflowResp)
              const configJson = workflowResp.config_json ? JSON.parse(workflowResp.config_json) : null
              if (configJson?.nodes && Array.isArray(configJson.nodes)) {
                const edges = configJson.edges || []
                setWorkflowEdges(edges)
                const orderMap = edges.length > 0 ? calculateOrderFromEdges(configJson.nodes, edges) : new Map()
                
                const filteredNodes = configJson.nodes
                  .filter((n: WorkflowNodeConfigItem) => !isStartOrEndNode(n.node_code))
                  .map((n: WorkflowNodeConfigItem) => ({ ...n, sequence: orderMap.get(n.id) ?? n.sequence }))
                  .sort((a: WorkflowNodeConfigItem, b: WorkflowNodeConfigItem) => {
                    // 优先按视觉位置排序（从上到下，从左到右）
                    const yDiff = (a.position_y || 0) - (b.position_y || 0)
                    if (Math.abs(yDiff) > 30) return yDiff // y 差距较大时按行排序
                    const xDiff = (a.position_x || 0) - (b.position_x || 0)
                    if (xDiff !== 0) return xDiff // 同一行按 x 排序
                    // 如果位置相同，使用 sequence 排序
                    return a.sequence - b.sequence
                  })
                
                setWorkflowNodes(filteredNodes)
              }
            }
          }
          // 处理相邻内容导航
          if (adjResult.status === 'fulfilled') {
            setAdjacentPrevId(adjResult.value.prev_id)
            setAdjacentNextId(adjResult.value.next_id)
          }
          // 处理子内容（SERIES 的 episodes / SEASON 的 seasonSeries）
          if (episodesResult.status === 'fulfilled') {
            setEpisodes(episodesResult.value.items)
            setEpisodesLoaded(true)
          }
          if (seasonSeriesResult.status === 'fulfilled') {
            setSeasonSeries(seasonSeriesResult.value.items)
            setSeasonSeriesLoaded(true)
          }
          // 所有操作按钮状态数据加载完成
          setOpStatusLoading(false)
        }).catch(err => {
          console.error('Failed to load secondary data:', err)
          setOpStatusLoading(false)
        })
      } catch (err) {
        // 错误已由 API 拦截器统一处理
      } finally {
        setLoading(false)
      }
    })()
  }, [id, contentId, navigate])

  // ── 操作成功后刷新节点状态检测数据 ──────────────────────────────────────
  useEffect(() => {
    if (!contentId || isNaN(contentId) || statusDataVersion === 0) return
    void (async () => {
      try {
        const ns = await getNodeStatus(contentId)
        setNodeStatus(ns)
      } catch (err) {
        setNodeStatus({})
      }

      try {
        const processesResp = await getProcesses(contentId)
        setProcesses(processesResp)
        const applicationReview = processesResp.find((p) => p.node_code === 'ApplicationReview')
        setHasInitiatedReview(!!applicationReview)
      } catch (err) {
        setHasInitiatedReview(false)
      }

      try {
        const entityType = getEntityType(content?.content_type ?? '')
        const pics = await getPictures(entityType, contentId)
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
      } catch (err) { /* ignore */ }

      if (content?.content_type === 'MOVIE' || content?.content_type === 'EPISODE') {
        try {
          const moviesResp = await getMoviesByContentId(contentId)
          setMovies(moviesResp.items)
        } catch (err) {
          setMovies([])
        }
      }

      if (content?.content_type === 'SERIES' || content?.content_type === 'SEASON_SERIES') {
        try {
          const episodesResp = await getContentChildren(contentId, 'EPISODE')
          setEpisodes(episodesResp.items)
          setEpisodesLoaded(true)
        } catch (err) {
          setEpisodes([])
        }
      }

      if (content?.content_type === 'SEASON') {
        try {
          const seasonSeriesResp = await getContentChildren(contentId, 'SEASON_SERIES')
          setSeasonSeries(seasonSeriesResp.items)
          setSeasonSeriesLoaded(true)
        } catch (err) {
          setSeasonSeries([])
        }
      }
    })()
  }, [contentId, statusDataVersion])

  const refreshAfterOp = useCallback(async () => {
    try {
      const detailResp = await getContent(contentId)
      setContent(detailResp.content)
      // 同步刷新任务指派人：审核提交会创建/改派 L1/L2/L3 审核任务，
      // 不更新会导致 isTaskAssignee/页面只读态停留在操作前（此前只取 content 丢弃了 task_assignees）
      setTaskAssignees(detailResp.task_assignees)
    } catch (err) { /* ignore */ }
    try {
      // 许可证同样只在进页面时加载一次，包关联/审核等操作后需同步刷新（发布校验依赖）
      const lics = await getContentLicenses(contentId)
      setLicenses(lics)
      setLicensesLoaded(true)
    } catch (err) { /* ignore */ }
    setStatusDataVersion((v) => v + 1)
  }, [contentId])

  // 组件卸载时释放 blob URLs
  useEffect(() => {
    return () => { picBlobUrls.forEach((u) => { if (u) URL.revokeObjectURL(u) }) }
  }, [picBlobUrls])

  // ── Tab 切换：懒加载类型专属 Tab 数据 ───────────────────────────────
  const handleTabChange = useCallback(
    (key: string) => {
      if (key === 'license' && !licensesLoaded && !licensesLoading) {
        setLicensesLoading(true)
        void (async () => {
          try {
            const lics = await getContentLicenses(contentId)
            setLicenses(lics)
            setLicensesLoaded(true)
          } catch (err) {
            if (isHandledError(err)) return
            message.error(t('content.msg.loadLicenseFailed'), 5)
          } finally {
            setLicensesLoading(false)
          }
        })()
      }
      if (key === 'mediaFile' && !moviesLoaded && !moviesLoading) {
        setMoviesLoading(true)
        void (async () => {
          try {
            const resp = await getMoviesByContentId(contentId)
            setMovies(resp.items)
            setMoviesLoaded(true)
          } catch (err) {
            if (isHandledError(err)) return
            message.error(t('content.msg.loadMoviesFailed'), 5)
          } finally {
            setMoviesLoading(false)
          }
        })()
        // 同时加载字典选项（用于显示名称）
        if (!dictOptionsLoaded) {
          void (async () => {
            try {
              const [defOpts, audioOpts, screenOpts] = await Promise.all([
                getDictChildren('Definition'),
                getDictChildren('AudioType'),
                getDictChildren('ScreenFormat'),
              ])
              setDictOptions({ Definition: defOpts, AudioType: audioOpts, ScreenFormat: screenOpts })
              setDictOptionsLoaded(true)
            } catch { /* ignore */ }
          })()
        }
      }
      if (key === 'episodes' && !episodesLoaded && !episodesLoading) {
        setEpisodesLoading(true)
        void (async () => {
          try {
            const res = await getContentChildren(contentId, 'EPISODE')
            setEpisodes(res.items)
            setEpisodesLoaded(true)
          } catch (err) {
            // 错误已由 API 拦截器统一处理
          } finally {
            setEpisodesLoading(false)
          }
        })()
      }
      if (key === 'seasonSeries' && !seasonSeriesLoaded && !seasonSeriesLoading) {
        setSeasonSeriesLoading(true)
        void (async () => {
          try {
            const res = await getContentChildren(contentId, 'SEASON_SERIES')
            setSeasonSeries(res.items)
            setSeasonSeriesLoaded(true)
          } catch (err) {
            // 错误已由 API 拦截器统一处理
          } finally {
            setSeasonSeriesLoading(false)
          }
        })()
      }
    },
    [contentId, licensesLoaded, licensesLoading, moviesLoaded, moviesLoading, episodesLoaded, episodesLoading, seasonSeriesLoaded, seasonSeriesLoading],
  )

  // ── 操作按钮点击处理 ─────────────────────────────────────────────────────
  /**
   * 各操作入口按钮的点击分发：
   *  - Posters → 打开已实现的 PostersModal
   *  - 其他按钮 → 打开占位弹框（后续迭代逐一实现对应弹框）
   */
  const handleOpButtonClick = useCallback(
    async (key: string, label: string) => {
      const normalizedKey = normalizeNodeCode(key)

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
      if (normalizedKey === 'Metadata') {
        setMetadataOpen(true)
        return
      }
      if (normalizedKey === 'Materials') {
        setMaterialsFixedType(1)
        setMaterialsOpen(true)
        return
      }
      if (normalizedKey === 'Trailer') {
        setMaterialsFixedType(2)
        setMaterialsOpen(true)
        return
      }
      if (normalizedKey === 'MusicEffects') {
        setMaterialsFixedType(3)
        setMaterialsOpen(true)
        return
      }
      if (normalizedKey === 'CastRoleMap') {
        setCastRoleMapOpen(true)
        return
      }
      if (normalizedKey === 'Category') {
        setCategoryLinkOpen(true)
        return
      }
      if (normalizedKey === 'Package') {
        setPackageLinkOpen(true)
        return
      }
      if (normalizedKey === 'PhysicalChannel') {
        setPhysicalChannelOpen(true)
        return
      }
      if (normalizedKey === 'InjectSubContent') {
        if (content?.content_type === 'SERIES' || content?.content_type === 'SEASON_SERIES') {
          setEpisodeInjectOpen(true)
        } else if (content?.content_type === 'SEASON') {
          setSeasonSeriesInjectOpen(true)
        } else if (content?.content_type === 'CHANNEL') {
          setPhysicalChannelOpen(true)
        }
        return
      }
      if (normalizedKey === 'PublishPlan') {
        // 无论是只读还是可编辑模式，打开弹框前都获取当前计划信息用于回显
        if (contentId) {
          try {
            const plan = await getCurrentPublishPlan('Content', contentId)
            setExistingPlanTime(plan?.scheduled_time)
            if (plan) {
              setPublishInfo({
                publish_status: plan.publish_status,
                publish_time: plan.publish_time,
                unpublish_time: plan.unpublish_time,
                task_type: plan.task_type,
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

        if (isNodeReadOnlyMemo('PublishPlan')) {
          // 只读模式：直接打开弹框
          setLocalPublishPlanOpen(true)
          return
        }
        // 可编辑模式：走 handleReviewAction 进行状态校验
        const result = await handleReviewAction(key, label)
        if (result) {
          setLocalPublishPlanOpen(true)
        }
        return
      }
      // ApplicationReview、ContentReview 统一走 handleReviewAction
      await handleReviewAction(key, label)
    },
    [handleReviewAction, content?.content_type, checkPermissionAsync, readOnly, t, message, isNodeReadOnlyMemo, contentId, isTaskAssignee],
  )

  // ── 列定义（使用 t() 翻译列名）────────────────────────────────────────────

  const getMovieTypeLabel = (type: number) => {
    if (type === 1) return t('content.materials.typeMovie')
    if (type === 2) return t('content.materials.typeTrailer')
    if (type === 3) return t('content.materials.typeSubtitle')
    return String(type)
  }

  const getDictName = (options: LanguageOption[], code: string): string => {
    const found = options.find((o) => o.code === code)
    return found?.name ?? code
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleMovieDownload = async (movie: MovieItem) => {
    try {
      const downloadUrl = movie.relative_path
        ? `/api/v1/attachments/download?path=${encodeURIComponent(movie.relative_path)}&inline=1`
        : movie.file_path
      if (!downloadUrl) {
        message.error(t('common.downloadFailed'))
        return
      }
      const token = localStorage.getItem('token')
      const resp = await fetch(downloadUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!resp.ok) throw new Error(`${resp.status}`)
      const blob = await resp.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = (movie.file_name || '').split('/').pop() || 'download'
      link.click()
      window.URL.revokeObjectURL(url)
    } catch {
      message.error(t('common.downloadFailed'))
    }
  }

  const mediaFileColumns: ColumnsType<MovieItem> = [
    { title: t('content.col.fileName'),        dataIndex: 'file_name',        key: 'file_name',        ellipsis: true, render: (v: string) => v?.split('/').pop() ?? v },
    { title: t('content.col.type'),            dataIndex: 'movie_type',       key: 'movie_type',       width: 100, render: (v: number) => getMovieTypeLabel(v), ellipsis: true },
    { title: t('content.col.fileSize'),        dataIndex: 'file_size',        key: 'file_size',        width: 100, render: (v: number) => formatFileSize(v) },
    { title: t('content.col.audioType'),       dataIndex: 'audio_type',       key: 'audio_type',       width: 110, render: (v?: string) => (v ? getDictName(dictOptions.AudioType ?? [], v) : '—'), ellipsis: true },
    { title: t('content.col.screenFormat'),    dataIndex: 'screen_format',    key: 'screen_format',    width: 120, render: (v?: string) => (v ? getDictName(dictOptions.ScreenFormat ?? [], v) : '—'), ellipsis: true },
    { title: t('content.col.closedCaptioning'),dataIndex: 'closed_captioning',key: 'closed_captioning',width: 130, render: (v: boolean) => <Switch checked={v} disabled size="small" />, ellipsis: true },
    { title: t('content.col.duration'),        dataIndex: 'duration',         key: 'duration',         width: 90 },
    { title: t('content.col.definition'),      dataIndex: 'definition',       key: 'definition',       width: 100, render: (v?: string) => (v ? getDictName(dictOptions.Definition ?? [], v) : '—'), ellipsis: true },
    { title: t('content.col.encryption'),      dataIndex: 'encryption',       key: 'encryption',       width: 100, render: (v: boolean) => <Switch checked={v} disabled size="small" />, ellipsis: true },
    { title: t('content.col.publishFlag'),     dataIndex: 'publish_flag',     key: 'publish_flag',     width: 110, render: (v: boolean) => <Switch checked={v} disabled size="small" />, ellipsis: true },
    { title: t('content.col.deeplink'),        dataIndex: 'deeplink',         key: 'deeplink',         ellipsis: true },
    { title: t('content.col.action'),          key: 'action',                                          width: 100, fixed: 'right' as const, render: (_: unknown, record: MovieItem) => (
      <Tooltip title={record.publish_flag ? t('common.download') : t('common.tooltip.downloadDisabledUnpublished')}>
        <Button
          type="link"
          size="small"
          icon={<DownloadOutlined />}
          disabled={!record.publish_flag}
          aria-label={record.publish_flag ? t('common.download') : t('common.tooltip.downloadDisabledUnpublished')}
          onClick={() => void handleMovieDownload(record)}
        />
      </Tooltip>
    ) },
  ]

  const episodeColumns: ColumnsType<ContentListItem> = [
    { title: t('content.col.sequence'),    dataIndex: 'sequence',     key: 'sequence',     width: 120, align: 'center' as const, render: (v?: number) => v ?? '—' },
    { title: t('content.col.contentName'), dataIndex: 'title',        key: 'title',        ellipsis: true },
    { title: t('content.col.contentType'), dataIndex: 'content_type', key: 'content_type', width: 120, render: () => 'EPISODE' },
    { title: t('content.col.startDateTime'),dataIndex: 'task_start_time', key: 'task_start_time', width: 160, render: (v?: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—' },
    { title: t('content.col.endDateTime'), dataIndex: 'task_end_time',  key: 'task_end_time',   width: 160, render: (v?: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—' },
    { title: t('content.col.assigned'),    dataIndex: 'assignee_name', key: 'assignee_name', width: 120, render: (v?: string) => v ?? '—' },
    { title: t('content.col.status'),      dataIndex: 'status',       key: 'status',       width: 120 },
    {
      title: t('content.col.action'),
      key: 'action',
      width: 80,
      fixed: 'right' as const,
      render: (_: unknown, record: ContentListItem) => (
        <Tooltip title={t('content.col.details')}>
          <Button
            type="link"
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={() => navigate(`/contents/${record.id}?mode=edit`)}
          />
        </Tooltip>
      ),
    },
  ]

  const seasonSeriesColumns: ColumnsType<ContentListItem> = [
    { title: t('content.col.seriesOrdinal'),dataIndex: 'series_ordinal', key: 'series_ordinal', width: 120 },
    { title: t('content.col.contentName'), dataIndex: 'title',           key: 'title',          ellipsis: true },
    // Content Type 显示行数据真实类型（SEASON 的子内容为单季 SEASON_SERIES），
    // 不能写死 'SERIES'，否则单季被误显示为 SERIES
    { title: t('content.col.contentType'), dataIndex: 'content_type',    key: 'content_type',   width: 140, render: (v: string) => v },
    { title: t('content.col.startDateTime'),dataIndex: 'task_start_time', key: 'task_start_time', width: 160, render: (v?: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—' },
    { title: t('content.col.endDateTime'), dataIndex: 'task_end_time',    key: 'task_end_time',   width: 160, render: (v?: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—' },
    { title: t('content.col.assigned'),    dataIndex: 'assignee_name',  key: 'assignee_name',  width: 120, render: (v?: string) => v ?? '—' },
    { title: t('content.col.status'),      dataIndex: 'status',            key: 'status',          width: 120 },
    {
      title: t('content.col.action'),
      key: 'action',
      width: 80,
      fixed: 'right' as const,
      render: (_: unknown, record: ContentListItem) => (
        <Tooltip title={t('content.col.details')}>
          <Button
            type="link"
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={() => navigate(`/contents/${record.id}?mode=edit`)}
          />
        </Tooltip>
      ),
    },
  ]

  // ── Tab 项目构建 ──────────────────────────────────────────────────────────

  function buildTabItems(contentType: string) {
    const commonTabs = [
      {
        key: 'processes',
        label: t('content.tab.processes'),
        children: <ProcessesTab contentId={content!.id} refreshVersion={statusDataVersion} />,
      },
      {
        key: 'license',
        label: t('content.tab.license'),
        children: <LicenseTab contentId={content!.id} refreshVersion={statusDataVersion} />,
      },
      {
        key: 'statusLogs',
        label: t('content.tab.statusLogs'),
        children: <StatusLogsTab contentId={content!.id} refreshVersion={statusDataVersion} />,
      },
      {
        key: 'activityLog',
        label: t('content.tab.activityLog'),
        children: <ProcessedHistoryTab contentId={content!.id} mode="detail" refreshVersion={statusDataVersion} />,
      },
    ]

    const extraTabs = []
    const clientPagination = getClientPaginationProps((n: number) => t('pagination.total', { n }))
    if ((contentType === 'MOVIE' || contentType === 'EPISODE') && !content?.is_archived) {
      extraTabs.push({
        key: 'mediaFile',
        label: t('content.tab.mediaFile'),
        children: (
          <Table<MovieItem>
            rowKey="id"
            loading={moviesLoading}
            columns={mediaFileColumns}
            dataSource={movies}
            scroll={{ x: 1200 }}
            pagination={clientPagination}
            locale={{ emptyText: 'No media files' }}
          />
        ),
      })
    } else if (contentType === 'SERIES' || contentType === 'SEASON_SERIES') {
      extraTabs.push({
        key: 'episodes',
        label: t('content.tab.episodes'),
        children: (
          <Table<ContentListItem>
            rowKey="id"
            loading={episodesLoading}
            columns={episodeColumns}
            dataSource={episodes}
            scroll={{ x: 900 }}
            pagination={clientPagination}
            locale={{ emptyText: t('content.episode.noData') }}
          />
        ),
      })
    } else if (contentType === 'SEASON') {
      extraTabs.push({
        key: 'seasonSeries',
        label: t('content.tab.seasonSeries'),
        children: (
          <Table<ContentListItem>
            rowKey="id"
            loading={seasonSeriesLoading}
            columns={seasonSeriesColumns}
            dataSource={seasonSeries}
            scroll={{ x: 900 }}
            pagination={clientPagination}
            locale={{ emptyText: t('content.seasonSeries.noData') }}
          />
        ),
      })
    }

    return [...commonTabs, ...extraTabs]
  }

  // ── 渲染 ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!content) {
    return <Empty description={t('content.detail.notFound')} style={{ marginTop: 80 }} />
  }

  // 从许可证推导供应商名称（去重）
  const providerNames =
    licenses.length > 0
      ? [...new Set(licenses.map((l) => l.provider_name))].filter(Boolean).join(', ')
      : '—'



  // 操作按钮列表（优先从流程配置获取，否则使用默认配置）
  // 按照图2编排：非必须项（Trailer、MusicEffects）放在最后
  // 过滤掉 Start/End 节点，它们不显示为操作按钮
  const operationButtons = workflowNodes.length > 0
    ? (() => {
        const buttons = workflowNodes
          .filter((node) => node.node_type === 'process' && !isStartOrEndNode(node.node_code))
          .map((node) => ({
            id: node.id,
            key: node.node_code,
            // 直接使用工作流配置中的 node_name，不做 i18n 映射
            label: node.node_name,
            mandatory: node.mandatory,
            bindStatusBefore: node.bind_status_before,
            bindStatusAfter: node.bind_status_after,
          }))
        // 定义按钮排序权重（权重小的排在前面）
        // 按照流程图顺序编排
        const getWeight = (key: string): number => {
          const weights: Record<string, number> = {
            // 第1列（类型专属按钮权重0-3）
            Materials: 0, Episodes: 0, SeasonSeries: 0, PhysicalChannel: 0,
            InjectSubContent: 0, // SERIES 类型的注入子内容
            Metadata: 1, Posters: 2, CastRoleMap: 3,
            // 第2列（权重4-7）
            Package: 4, Category: 5, Review: 6, ContentReview: 6, ApplicationReview: 6,
            PublishPlan: 7, Publish: 7,
            // 第3列（非必须，权重100+，放最后）
            Trailer: 100, MusicEffects: 101,
          }
          // 兼容中文 node_code（如果后端返回的是中文）
          const chineseWeights: Record<string, number> = {
            // 第1列
            '季系列': 0, '单集管理': 0, '正片': 0, '材料': 0,
            '注入子内容': 0, 'Episodes': 0,
            '元数据': 1, 'Metadata': 1,
            '海报': 2, 'Posters': 2,
            '演员角色映射': 3, 'CastRoleMap': 3,
            // 第2列
            '服务包': 4, 'Package': 4,
            '栏目': 5, 'Category': 5,
            '审核': 6, 'Review': 6, '内容审核': 6, '应用审核': 6,
            '发布计划': 7, 'PublishPlan': 7,
            // 第3列（非必须）
            '预告片': 100, 'Trailer': 100,
            '音乐与音效文件': 101, '音乐音效': 101, 'MusicEffects': 101, 'Music & Effects File': 101,
          }
          return weights[key] ?? chineseWeights[key] ?? 50
        }
        return buttons.sort((a, b) => getWeight(a.key) - getWeight(b.key))
      })()
    : getOperationButtonKeys(content.content_type).map((item) => ({
        id: 0,
        key: item.key,
        label: t(item.labelKey),
        mandatory: true,
        bindStatusBefore: undefined,
        bindStatusAfter: undefined,
      }))

  // 生命周期状态条 - 使用内容状态(不是流程节点状态)
  // Schedule 和 Archived 工作流不存在待上传素材状态,需要过滤掉
  const filteredStages = INGEST_STAGES.filter((s) => {
    if (s.statusKey === 'WaitingForMaterials') {
      const belonging = getWorkflowBelonging(content.content_type, content.is_archived)
      return belonging !== 'SCHEDULE' && belonging !== 'ARCHIVED_MOVIE' && belonging !== 'ARCHIVED_EPISODE'
    }
    return true
  })
  const stageLabels = filteredStages.map((s) => t(s.labelKey))
  const stageKeys = filteredStages.map((s) => s.statusKey)

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

          {/* 中：内容基本信息 */}
          <Col flex="1" style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <Text type="secondary" style={{ fontSize: 12, width: 100, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {t('content.detail.contentName')}:{' '}
                </Text>
                <Text strong style={{ fontSize: 15, wordBreak: 'break-all' }}>{content.title}</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <Text type="secondary" style={{ fontSize: 12, width: 100, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {t('content.detail.contentType')}:{' '}
                </Text>
                <Tag color="blue">{content.content_type}</Tag>
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
                {licenses.length > 0 && licenses[0].platforms && licenses[0].platforms.length > 0 ? (
                  <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                    {licenses[0].platforms.map((p) => (
                      <Tag key={p.platform} style={{ fontSize: 11 }}>
                        {platformNameMap[p.platform] || p.platform}
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
                <Text style={{ wordBreak: 'break-all' }}>{content.genre_name || '—'}</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <Text type="secondary" style={{ fontSize: 12, width: 100, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {t('content.detail.ingestStatus')}:{' '}
                </Text>
                <Tag
                  color={
                    content.status === 'Published'
                      ? 'success'
                      : content.status === 'PublishFailed'
                        ? 'error'
                        : content.status === 'InProgress'
                          ? 'processing'
                          : content.status === 'WaitingForMaterials'
                            ? 'warning'
                            : content.status === 'None'
                              ? 'default'
                              : 'blue'
                  }
                  style={{ fontSize: 12, cursor: 'pointer' }}
                  onClick={handleOpenIngestHistory}
                >
                  {content.status}
                </Tag>
              </div>

            </div>
          </Col>

          {/* 右：操作入口按钮区（可点击；Posters 已对接，其余弹占位框） */}
          <Col flex="0 0 600px">
            <div
              style={{
                display: 'grid',
                gridTemplateRows: 'repeat(4, auto)',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gridAutoFlow: 'column',
                gap: '10px 8px',
                paddingTop: 4,
                minHeight: 120,
                marginRight: '50px',
              }}
            >
              {opStatusLoading ? (
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Spin size="small" />
                </div>
              ) : (
                (() => {
                  // 提前计算节点批次，避免在循环中重复计算
                  const nodeBatchMap = workflowNodes.length > 0 ? analyzeNodeBatches(workflowNodes, workflowEdges) : new Map()
                  
                  return operationButtons.map((btn) => {
                const key = btn.key
                const label = btn.label
                const isMandatory = btn.mandatory !== false // 默认为必填
                const status = getOperationStatus(key, nodeStatus, btn.mandatory)
                // 判断节点是否可用（前置节点是否全部完成）
                const available = isNodeAvailable(
                  btn.id,
                  workflowNodes,
                  workflowEdges,
                  nodeBatchMap,  // 传入缓存的批次映射
                  (nodeCode, mandatory) => getOperationStatus(nodeCode, nodeStatus, mandatory)
                )
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
                        const pendingName = findPrevPendingNodeName(btn.id, workflowNodes, workflowEdges, nodeBatchMap, (nodeCode, mandatory) => getOperationStatus(nodeCode, nodeStatus, mandatory))
                        message.warning(t('content.detail.prevNodeIncomplete', { name: pendingName ?? '' }), 3)
                        return
                      }
                      handleOpButtonClick(key, label)
                    }}
                  >
                    {status === 'completed' && (
                      <CheckCircleFilled style={{ color: '#52c41a', fontSize: 14 }} />
                    )}
                    {status === 'warning' && (
                      <WarningFilled style={{ color: '#faad14', fontSize: 14 }} />
                    )}
                    {status === 'pending' && (
                      isMandatory ? (
                        <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 14 }} />
                      ) : (
                        <WarningFilled style={{ color: '#faad14', fontSize: 14 }} />
                      )
                    )}
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
              })
            })()
          )}
            </div>
          </Col>

          {/* 最右：记录导航 */}
          <Col flex="0 0 auto" style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 4 }}>
            <Space.Compact>
              <Tooltip title={t('content.detail.prevRecord')}>
                <Button
                  icon={<LeftOutlined />}
                  disabled={!adjacentPrevId}
                  onClick={() => {
                    if (adjacentPrevId) {
                      const params = new URLSearchParams()
                      const source = searchParams.get('source')
                      const mode = searchParams.get('mode')
                      if (source) params.set('source', source)
                      if (mode) params.set('mode', mode)
                      const qs = params.toString()
                      navigate(`/contents/${adjacentPrevId}${qs ? `?${qs}` : ''}`)
                    }
                  }}
                />
              </Tooltip>
              <Tooltip title={t('content.detail.nextRecord')}>
                <Button
                  icon={<RightOutlined />}
                  disabled={!adjacentNextId}
                  onClick={() => {
                    if (adjacentNextId) {
                      const params = new URLSearchParams()
                      const source = searchParams.get('source')
                      const mode = searchParams.get('mode')
                      if (source) params.set('source', source)
                      if (mode) params.set('mode', mode)
                      const qs = params.toString()
                      navigate(`/contents/${adjacentNextId}${qs ? `?${qs}` : ''}`)
                    }
                  }}
                />
              </Tooltip>
            </Space.Compact>
          </Col>
        </Row>
      </div>

      {/* ── 生命周期状态条 ─────────────────────────────────────────────────── */}
      <div style={{ margin: '8px 0' }}>
        <StatusBar status={content.status} stageLabels={stageLabels} stageKeys={stageKeys} />
      </div>

      {/* ── 底部 Tab 页 ──────────────────────────────────────────────────────── */}
      <div style={{ padding: '0 16px 16px' }}>
        <Tabs
          defaultActiveKey="processes"
          onChange={handleTabChange}
          items={buildTabItems(content.content_type)}
        />
      </div>

      {/* ── 操作弹框 ─────────────────────────────────────────────────────────── */}

      {/* Posters：已实现的海报管理弹框 */}
      <PostersModal
        open={postersOpen}
        entityType={getEntityType(content.content_type)}
        entityId={content.id}
        entityName={content.title}
        onClose={() => {
          setPostersOpen(false)
          void refreshAfterOp()  // 刷新内容详情和状态
          void (async () => {
            const entityType = getEntityType(content.content_type)
            const pics = await getPictures(entityType, content.id)
            setPictures(pics)
            setCurrentPicIndex(0)
            picBlobUrls.forEach((u) => { if (u) URL.revokeObjectURL(u) })
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
        readOnly={isNodeReadOnlyMemo('Posters')}
      />

      {/* Metadata：元数据编辑弹框 */}
      <MetadataModal
        open={metadataOpen}
        contentId={content.id}
        contentType={content.content_type}
        contentName={content.title}
        onClose={() => { setMetadataOpen(false) }}
        onSuccess={() => { setMetadataOpen(false); void refreshAfterOp() }}
        readOnly={isNodeReadOnlyMemo('Metadata')}
        sourceScheduleId={content.source_schedule_id}
      />

      {/* Materials：材料注入弹框 */}
      <MaterialsModal
        open={materialsOpen}
        contentId={content.id}
        contentName={content.title}
        onClose={() => {
          setMaterialsOpen(false)
          void getContent(contentId).then((res) => setContent(res.content))
          setMoviesLoaded(false)
          setStatusDataVersion((v) => v + 1)
        }}
        fixedType={materialsFixedType}
        readOnly={isNodeReadOnlyMemo('Materials')}
        disableMovieType={content.is_archived === true}
      />

      {/* CastRoleMap 弹框 */}
      <CastRoleMapModal
        open={castRoleMapOpen}
        contentId={contentId}
        contentName={content?.title}
        contentType={content?.content_type}
        readOnly={isNodeReadOnlyMemo('CastRoleMap')}
        onClose={() => { setCastRoleMapOpen(false); setStatusDataVersion((v) => v + 1) }}
        onSuccess={() => { void refreshAfterOp() }}
      />

      {/* Category：栏目关联弹框 */}
      <CategoryLinkModal
        open={categoryLinkOpen}
        contentId={contentId}
        contentName={content?.title ?? ''}
        readOnly={isNodeReadOnlyMemo('Category')}
        onClose={() => setCategoryLinkOpen(false)}
        onSuccess={() => { setCategoryLinkOpen(false); void refreshAfterOp() }}
      />

      {/* PhysicalChannel：物理频道弹框 */}
      <PhysicalChannelModal
        open={physicalChannelOpen}
        channelId={contentId}
        readOnly={isNodeReadOnlyMemo('PhysicalChannel')}
        onClose={() => setPhysicalChannelOpen(false)}
        // onSuccess 仅刷新父页数据；新增成功后弹框内部自动关闭，删除后停留弹框内
        onSuccess={() => void refreshAfterOp()}
      />

      {/* Review：审核弹框 */}
      <ReviewModal
        open={reviewOpen}
        contentId={contentId}
        contentName={content?.title}
        mode={reviewMode}
        readOnly={reviewReadOnly}
        hasInitiatedReview={hasInitiatedReview}
        onClose={closeReview}
        onSuccess={() => { closeReview(); void refreshAfterOp() }}
      />

      {/* PublishPlan：发布计划弹框 */}
      <PublishPlanModal
        open={localPublishPlanOpen}
        contentId={contentId}
        contentName={content?.title}
        contentType={content?.content_type}
        initialScheduledTime={existingPlanTime}
        publishInfo={publishInfo}
        hasPublishHistory={!!publishInfo}
        readOnly={publishPlanReadOnly}
        onClose={() => { setLocalPublishPlanOpen(false); setExistingPlanTime(undefined); setPublishInfo(undefined) }}
        onSuccess={() => { setLocalPublishPlanOpen(false); setExistingPlanTime(undefined); setPublishInfo(undefined); void refreshAfterOp() }}
      />

      {/* Package：服务包关联弹框 */}
      <PackageLinkModal
        open={packageLinkOpen}
        contentId={contentId}
        contentName={content?.title ?? ''}
        readOnly={isNodeReadOnlyMemo('Package')}
        onClose={() => setPackageLinkOpen(false)}
        onSuccess={() => { setPackageLinkOpen(false); void refreshAfterOp() }}
      />

      {/* Episode 注入弹框 */}
      {(content?.content_type === 'SERIES' || content?.content_type === 'SEASON_SERIES') && (
        <EpisodeInjectModal
          open={episodeInjectOpen}
          parentId={contentId}
          parentName={content.title}
          onClose={() => setEpisodeInjectOpen(false)}
          onSuccess={() => {
            setEpisodeInjectOpen(false)  // ✅ 关闭弹框
            setEpisodesLoaded(false)
            void refreshAfterOp()
          }}
          readOnly={isNodeReadOnlyMemo('InjectSubContent')}
        />
      )}

      {/* Season Series 注入弹框 */}
      {content?.content_type === 'SEASON' && (
        <SeasonSeriesInjectModal
          open={seasonSeriesInjectOpen}
          parentId={contentId}
          parentName={content.title}
          onClose={() => setSeasonSeriesInjectOpen(false)}
          onSuccess={() => {
            setSeasonSeriesInjectOpen(false)  // ✅ 关闭弹框
            // 刷新底部 Tab 数据
            setSeasonSeriesLoaded(false)
            void refreshAfterOp()
          }}
          readOnly={isNodeReadOnlyMemo('InjectSubContent')}
        />
      )}

      {/* 其他操作按钮：统一占位弹框 */}
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
        title={`${content?.title || ''} - ${t('ingestHistory.title')}`}
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
        <Table
          rowKey="id"
          dataSource={ingestHistoryList}
          loading={ingestHistoryLoading}
          size="small"
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
            { title: t('publish.ingestHistory.col.type'), dataIndex: 'entity_name', key: 'entity_name' },
            {
              title: t('publish.ingestHistory.col.createDate'),
              dataIndex: 'create_date',
              key: 'create_date',
              render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
            },
            {
              title: t('publish.ingestHistory.col.sendDate'),
              dataIndex: 'send_date',
              key: 'send_date',
              render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
            },
            {
              title: t('publish.ingestHistory.col.endDate'),
              dataIndex: 'end_date',
              key: 'end_date',
              render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
            },
            {
              title: t('publish.ingestHistory.col.status'),
              dataIndex: 'status',
              key: 'status',
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
              render: (_, record: IngestHistoryItem) => {
                const handleDownload = async (url: string, filename: string) => {
                  try {
                    const requestUrl = url.startsWith('/api/v1') ? url.slice(7) : url
                    const response = await api.get(requestUrl, { responseType: 'blob' })
                    const blob = new Blob([response.data])
                    const link = document.createElement('a')
                    link.href = URL.createObjectURL(blob)
                    link.download = filename
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    URL.revokeObjectURL(link.href)
                  } catch (err) {
                    if (!isHandledError(err)) message.error(t('ingestHistory.msg.loadFailed'))
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
