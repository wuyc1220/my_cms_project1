import type { WorkflowNodeConfigItem } from '../types/workflow'

export type OpStatus = 'completed' | 'warning' | 'pending'

const START_NODE_CODES = new Set(['start', '开始'])
const END_NODE_CODES = new Set(['end', '结束'])

export function isStartOrEndNode(nodeCode: string): boolean {
  const lower = nodeCode.toLowerCase()
  return START_NODE_CODES.has(lower) || END_NODE_CODES.has(lower) || START_NODE_CODES.has(nodeCode) || END_NODE_CODES.has(nodeCode)
}

export interface OperationButton {
  id: number
  key: string
  label: string
  mandatory: boolean
  bindStatusBefore?: string
  bindStatusAfter?: string
}

export function getWorkflowBelonging(contentType: string, isArchived?: boolean): string {
  // 归档内容使用 ARCHIVED 流程配置
  if (isArchived) return 'ARCHIVED'
  if (contentType === 'MOVIE' || contentType === 'EPISODE') return 'PROGRAM'
  if (contentType === 'SERIES') return 'SERIES'
  if (contentType === 'SEASON') return 'SEASON'
  if (contentType === 'CHANNEL') return 'CHANNEL'
  if (contentType === 'SCHEDULE') return 'SCHEDULE'
  if (contentType === 'ARCHIVE') return 'ARCHIVED'
  return 'PROGRAM'
}

export function getEntityType(contentType: string): string {
  if (contentType === 'MOVIE' || contentType === 'EPISODE') return 'program'
  if (contentType === 'SERIES' || contentType === 'SEASON') return 'series'
  if (contentType === 'CHANNEL') return 'channel'
  if (contentType === 'SCHEDULE') return 'schedule'
  return 'program'
}

/**
 * 判断是否绑定了物理频道
 * @param physicalChannelsTotal 物理频道总数
 * @returns 是否已绑定
 */
export function isPhysicalChannelBound(physicalChannelsTotal: number): boolean {
  return physicalChannelsTotal > 0
}

export function calculateOrderFromEdges(
  nodes: WorkflowNodeConfigItem[],
  edges: Array<{ source: string | number; target: string | number }>
): Map<string | number, number> {
  if (!edges || edges.length === 0) {
    return new Map()
  }

  const processNodes = nodes.filter(
    (n) =>
      !isStartOrEndNode(n.node_code)
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

export function analyzeNodeBatches(
  nodes: WorkflowNodeConfigItem[],
  edges: Array<{ source: string | number; target: string | number }>
): Map<number, number> {
  const nodeBatchMap = new Map<number, number>()

  const orderMap = calculateOrderFromEdges(nodes, edges)

  const processNodes = [...nodes]
    .filter(
      (n) =>
        n.node_type !== 'parallel_box' &&
        !isStartOrEndNode(n.node_code)
    )
    .sort((a, b) => {
      const orderA = orderMap.get(a.id)
      const orderB = orderMap.get(b.id)
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB
      }
      return a.sequence - b.sequence
    })

  let currentBatch = 0
  let prevNodeIsParallel = false

  for (const node of processNodes) {
    // 并行盒子子节点：同一批次内的节点应属同一 batch
    if (node.parent_node_id) {
      // 前一个节点非并行 → 开启新批次
      if (!prevNodeIsParallel) {
        currentBatch++
      }
      nodeBatchMap.set(node.id, currentBatch)
      prevNodeIsParallel = true
      // 不递增 batch，兄弟节点保持同一批
      continue
    }

    const isParallel = node.node_type === 'parallel_box' || !!node.parallel_rule

    if (isParallel) {
      nodeBatchMap.set(node.id, currentBatch)
      prevNodeIsParallel = true
    } else {
      if (prevNodeIsParallel) {
        currentBatch++
      }
      nodeBatchMap.set(node.id, currentBatch)
      currentBatch++
      prevNodeIsParallel = false
    }
  }

  return nodeBatchMap
}

export function isNodeAvailable(
  nodeId: number,
  nodes: WorkflowNodeConfigItem[],
  edges: Array<{ source: string | number; target: string | number }>,
  nodeBatchMap: Map<number, number>,  // 接收缓存的批次映射
  getNodeStatus: (nodeCode: string) => OpStatus
): boolean {
  if (nodes.length === 0) return true

  const currentBatch = nodeBatchMap.get(nodeId)

  if (currentBatch === undefined) return true
  if (currentBatch === 0) return true

  const orderMap = calculateOrderFromEdges(nodes, edges)

  const sortedNodes = [...nodes]
    .filter(
      (n) =>
        n.node_type !== 'parallel_box' &&
        !isStartOrEndNode(n.node_code)
    )
    .sort((a, b) => {
      const orderA = orderMap.get(a.id)
      const orderB = orderMap.get(b.id)
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB
      }
      return a.sequence - b.sequence
    })

  const prevBatchNodes = sortedNodes.filter((node) => {
    const batch = nodeBatchMap.get(node.id)
    return batch !== undefined && batch < currentBatch
  })

  for (const node of prevBatchNodes) {
    const status = getNodeStatus(node.node_code)
    // completed 为完成，warning 为可选未完成，只有 pending 才阻塞
    if (status === 'pending') {
      return false
    }
  }

  return true
}

/**
 * 标准化节点编码
 * 
 * 设计原则：
 * - node_code 是节点的唯一标识（英文），如 'InjectSubContent'、'Metadata'
 * - node_name 是显示名称（可中英文），如 'Episodes'、'单集管理'
 * - 前端应始终使用 node_code 进行逻辑判断
 * - 后端数据库中所有 node_code 均为英文，无需映射
 */
export function normalizeNodeCode(key: string): string {
  // 直接返回 node_code，不做任何映射
  // 后端保证 node_code 始终为英文（如 'Materials'、'InjectSubContent'）
  return key
}

export function buildOperationButtonsFromWorkflow(
  workflowNodes: WorkflowNodeConfigItem[]
): OperationButton[] {
  if (workflowNodes.length === 0) return []

  return workflowNodes
    .filter(
      (node) =>
        node.node_type === 'process' &&
        !isStartOrEndNode(node.node_code)
    )
    .map((node) => ({
      id: node.id,
      key: node.node_code,
      label: node.node_name,
      mandatory: node.mandatory,
      bindStatusBefore: node.bind_status_before,
      bindStatusAfter: node.bind_status_after,
    }))
}

export function parseWorkflowConfig(
  configJson: string | null | undefined
): {
  filteredNodes: WorkflowNodeConfigItem[]
  edges: Array<{ source: string | number; target: string | number }>
} {
  const parsed = configJson ? JSON.parse(configJson) : null

  if (!parsed?.nodes || !Array.isArray(parsed.nodes)) {
    return { filteredNodes: [], edges: [] }
  }

  const edges: Array<{ source: string | number; target: string | number }> =
    parsed.edges || []
  const orderMap =
    edges.length > 0
      ? calculateOrderFromEdges(parsed.nodes, edges)
      : new Map()

  const filteredNodes = (parsed.nodes as WorkflowNodeConfigItem[])
    .filter(
      (n) =>
        !isStartOrEndNode(n.node_code)
    )
    .map((n) => ({
      ...n,
      sequence: orderMap.get(n.id) ?? n.sequence,
    }))
    .sort((a, b) => a.sequence - b.sequence)

  return { filteredNodes, edges }
}
