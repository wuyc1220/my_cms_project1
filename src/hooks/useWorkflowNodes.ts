import { useCallback, useEffect, useState } from 'react'
import { getPublishedWorkflow } from '../api/workflow'
import type { WorkflowNodeConfigItem } from '../types/workflow'
import {
  buildOperationButtonsFromWorkflow,
  getWorkflowBelonging,
  isNodeAvailable,
  parseWorkflowConfig,
  analyzeNodeBatches,
  type OpStatus,
  type OperationButton,
} from '../utils/workflow'

export interface UseWorkflowNodesResult {
  workflowNodes: WorkflowNodeConfigItem[]
  workflowEdges: Array<{ source: string | number; target: string | number }>
  operationButtons: OperationButton[]
  loading: boolean
  checkNodeAvailable: (
    nodeId: number,
    getNodeStatus: (nodeCode: string) => OpStatus
  ) => boolean
  reload: () => void
}

export function useWorkflowNodes(
  contentType: string | undefined,
  fallbackButtons?: OperationButton[]
): UseWorkflowNodesResult {
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNodeConfigItem[]>([])
  const [workflowEdges, setWorkflowEdges] = useState<
    Array<{ source: string | number; target: string | number }>
  >([])
  const [operationButtons, setOperationButtons] = useState<OperationButton[]>(
    fallbackButtons ?? []
  )
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!contentType) return
      const belonging = getWorkflowBelonging(contentType)
      setLoading(true)
      try {
        const workflowResp = await getPublishedWorkflow(belonging)
        if (cancelled) return
        if (workflowResp) {
          const { filteredNodes, edges } = parseWorkflowConfig(
            workflowResp.config_json
          )
          setWorkflowNodes(filteredNodes)
          setWorkflowEdges(edges)

          if (filteredNodes.length > 0) {
            const buttons = buildOperationButtonsFromWorkflow(filteredNodes)
            setOperationButtons(buttons)
          } else if (fallbackButtons) {
            setOperationButtons(fallbackButtons)
          }
        } else {
          setWorkflowNodes([])
          setWorkflowEdges([])
          if (fallbackButtons) {
            setOperationButtons(fallbackButtons)
          }
        }
      } catch {
        if (!cancelled) {
          setWorkflowNodes([])
          setWorkflowEdges([])
          if (fallbackButtons) {
            setOperationButtons(fallbackButtons)
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [contentType, fallbackButtons, refreshKey])

  const checkNodeAvailable = useCallback(
    (nodeId: number, getNodeStatus: (nodeCode: string) => OpStatus) => {
      // 缓存 nodeBatchMap，避免重复计算
      const nodeBatchMap = analyzeNodeBatches(workflowNodes, workflowEdges)
      return isNodeAvailable(nodeId, workflowNodes, workflowEdges, nodeBatchMap, getNodeStatus)
    },
    [workflowNodes, workflowEdges]
  )

  const reload = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return {
    workflowNodes,
    workflowEdges,
    operationButtons,
    loading,
    checkNodeAvailable,
    reload,
  }
}
