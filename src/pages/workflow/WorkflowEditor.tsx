/**
 * WorkflowEditor — 流程编排页面（React Flow 可视化拖拽）
 *
 * URL: /workflow/editor/:configId
 *
 * 功能：
 * - 从后端加载流程配置和节点
 * - 左侧面板展示可用流程环节（可拖拽到画布）
 * - 中间画布使用 React Flow 展示节点和连线
 * - 支持并行聚合框容器
 * - 右侧面板编辑选中节点的属性
 * - 保存配置到后端
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Card,
  Drawer,
  Form,
  message,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  Radio,
} from 'antd'
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  GroupOutlined,
} from '@ant-design/icons'
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  MarkerType,
  Handle,
  Position,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  getWorkflowConfigDetail,
  updateWorkflowConfig,
  publishWorkflowConfig,
  getAvailableNodes,
} from '../../api/workflow'
import type { WorkflowConfigDetail, WorkflowNodeConfigItem, AvailableNode } from '../../types/workflow'
import { useI18n } from '../../i18n/useI18n'
import type { MessageKey } from '../../i18n/messages'
import { isHandledError } from '../../api'
import TrimInput from '../../components/TrimInput'


const { Title, Text } = Typography

const useStatusOptions = (_t: (key: string) => string) => [
  { label: 'None', value: 'None' },
  { label: 'WaitingForMaterials', value: 'WaitingForMaterials' },
  { label: 'InProgress', value: 'InProgress' },
  { label: 'ReadyForPublish', value: 'ReadyForPublish' },
  { label: 'Publishing', value: 'Publishing' },
  { label: 'Published', value: 'Published' },
  { label: 'PublishFailed', value: 'PublishFailed' },
  { label: 'NoActiveLicense', value: 'NoActiveLicense' },
  { label: 'Closed', value: 'Closed' },
]

const useNodeTypeOptions = (t: (key: string) => string) => [
  { label: t('workflow.editor.nodeType.process'), value: 'process' },
  { label: t('workflow.editor.nodeType.parallelBox'), value: 'parallel_box' },
]

let nodeIdCounter = 1000

// 自定义并行框节点组件（支持调整大小）
function ParallelBoxNode({ data, selected }: { data: any; selected?: boolean; id?: string }) {
  const [, setIsResizing] = useState(false)
  const [size, setSize] = useState({ 
    width: data.width || 400, 
    height: data.height || 200 
  })

  useEffect(() => {
    setSize({ 
      width: data.width || 400, 
      height: data.height || 200 
    })
  }, [data.width, data.height])

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setIsResizing(true)
    
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = size.width
    const startHeight = size.height
    
    let newSize = { width: startWidth, height: startHeight }

    const handleResizeMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault()
      moveEvent.stopPropagation()
      newSize = {
        width: startWidth + moveEvent.clientX - startX,
        height: startHeight + moveEvent.clientY - startY
      }
      setSize(newSize)
    }

    const handleResizeEnd = (endEvent: PointerEvent) => {
      endEvent.preventDefault()
      endEvent.stopPropagation()
      ;(e.target as Element).releasePointerCapture(e.pointerId)
      setIsResizing(false)
      data.width = newSize.width
      data.height = newSize.height
      document.removeEventListener('pointermove', handleResizeMove)
      document.removeEventListener('pointerup', handleResizeEnd)
    }

    document.addEventListener('pointermove', handleResizeMove)
    document.addEventListener('pointerup', handleResizeEnd)
  }

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        background: '#f6ffed',
        border: `2px ${selected ? 'solid' : 'dashed'} #52c41a`,
        borderRadius: 8,
        padding: '8px 12px',
        position: 'relative',
        resize: 'none',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#52c41a' }} />
      <div style={{ 
        fontWeight: 'bold', 
        marginBottom: 8, 
        display: 'flex', 
        alignItems: 'center',
        gap: 8,
        color: '#52c41a',
      }}>
        <GroupOutlined />
        {data.label}
        <Tag color="green">{data.parallelRule === 'all_required' ? '全部完成' : '任一完成'}</Tag>
      </div>
      <div style={{ fontSize: 12, color: '#666' }}>
        {data.childCount || 0} 个子节点
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#52c41a' }} />
      
      {/* 调整大小手柄 */}
      <div
        onPointerDown={handleResizeStart}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 20,
          height: 20,
          cursor: 'nwse-resize',
          background: selected ? '#52c41a' : 'transparent',
          borderRadius: '0 0 6px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          touchAction: 'none',
        }}
      >
        {selected && (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M0 10 L10 0 M5 10 L10 5 M0 5 L5 0" stroke="#fff" strokeWidth="1.5" fill="none"/>
          </svg>
        )}
      </div>
    </div>
  )
}

// 自定义流程节点组件（带箭头把手，支持调整大小）
function ProcessNode({ data, selected }: { data: any; selected?: boolean }) {
  const [size, setSize] = useState({ 
    width: data.width || 160, 
    height: data.height || 80 
  })

  useEffect(() => {
    setSize({ 
      width: data.width || 160, 
      height: data.height || 80 
    })
  }, [data.width, data.height])

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = size.width
    const startHeight = size.height
    
    let newSize = { width: startWidth, height: startHeight }

    const handleResizeMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault()
      moveEvent.stopPropagation()
      newSize = {
        width: startWidth + moveEvent.clientX - startX,
        height: startHeight + moveEvent.clientY - startY
      }
      setSize(newSize)
    }

    const handleResizeEnd = (endEvent: PointerEvent) => {
      endEvent.preventDefault()
      endEvent.stopPropagation()
      ;(e.target as Element).releasePointerCapture(e.pointerId)
      data.width = newSize.width
      data.height = newSize.height
      document.removeEventListener('pointermove', handleResizeMove)
      document.removeEventListener('pointerup', handleResizeEnd)
    }

    document.addEventListener('pointermove', handleResizeMove)
    document.addEventListener('pointerup', handleResizeEnd)
  }

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        background: data.mandatory !== false ? '#fff' : '#f5f5f5',
        border: `2px solid ${selected ? '#1677ff' : data.mandatory !== false ? '#1677ff' : '#d9d9d9'}`,
        borderRadius: 8,
        padding: '12px 16px',
        textAlign: 'center',
        boxShadow: selected ? '0 0 0 2px rgba(22,119,255,0.2)' : '0 2px 8px rgba(0,0,0,0.1)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#1677ff' }} />
      {data.mandatory !== false && (
        <div style={{ position: 'absolute', top: 4, left: 6, color: '#ff4d4f', fontSize: 16, fontWeight: 'bold' }}>*</div>
      )}
      <div style={{ fontWeight: 500, fontSize: 14, wordBreak: 'break-word' }}>{data.label}</div>
      <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{data.nodeCode}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#1677ff' }} />
      
      {/* 调整大小手柄 */}
      <div
        onPointerDown={handleResizeStart}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 20,
          height: 20,
          cursor: 'nwse-resize',
          background: selected ? '#1677ff' : 'transparent',
          borderRadius: '0 0 6px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          touchAction: 'none',
        }}
      >
        {selected && (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M0 10 L10 0 M5 10 L10 5 M0 5 L5 0" stroke="#fff" strokeWidth="1.5" fill="none"/>
          </svg>
        )}
      </div>
    </div>
  )
}

const nodeTypes = {
  parallelBox: ParallelBoxNode,
  process: ProcessNode,
  start: StartNode,
  end: EndNode,
}

function WorkflowEditorInner() {
  const { configId } = useParams<{ configId: string }>()
  const navigate = useNavigate()
  const { t } = useI18n()
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<WorkflowConfigDetail | null>(null)
  const [availableNodes, setAvailableNodes] = useState<AvailableNode[]>([])
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nodeDrawerOpen, setNodeDrawerOpen] = useState(false)
  const [nodeForm] = Form.useForm()
  const [parallelBoxForm] = Form.useForm()
  const [parallelBoxDrawerOpen, setParallelBoxDrawerOpen] = useState(false)
  const statusOptions = useStatusOptions(t as (key: string) => string)
  const nodeTypeOptions = useNodeTypeOptions(t as (key: string) => string)

  const isReadOnly = config?.status === 'published'

  useEffect(() => {
    void (async () => {
      if (!configId) return
      setLoading(true)
      try {
        const [detail, nodesResp] = await Promise.all([
          getWorkflowConfigDetail(Number(configId)),
          getAvailableNodes(),
        ])
        setConfig(detail)
        setAvailableNodes(nodesResp)
        const { nodes: flowNodes, edges: flowEdges } = parseNodesToFlow(detail.nodes, detail.config_json)
        setNodes(flowNodes)
        setEdges(flowEdges)
      } catch (err) {
        // 错误已在拦截器中处理
      } finally {
        setLoading(false)
      }
    })()
  }, [configId])

  useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.2 }), 100)
    }
  }, [nodes, fitView])

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (isReadOnly) return
      setNodes((nds) => applyNodeChanges(changes, nds))
    },
    [isReadOnly],
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      if (isReadOnly) return
      setEdges((eds) => applyEdgeChanges(changes, eds))
    },
    [isReadOnly],
  )

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (isReadOnly) return
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            animated: true,
            markerEnd: { 
              type: MarkerType.ArrowClosed, 
              width: 20, 
              height: 20,
              color: '#1677ff',           },
            style: { stroke: '#1677ff', strokeWidth: 2 },
          },
          eds,
        ),
      )
    },
    [isReadOnly],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    if (isReadOnly) return
    setEdges((eds) => eds.filter((e) => e.id !== edge.id))
  }, [isReadOnly])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      if (isReadOnly) return
      const nodeCode = event.dataTransfer.getData('application/reactflow')
      if (!nodeCode) return

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      // 处理并行聚合框拖拽
      if (nodeCode === 'parallel_box') {
        const newNode: Node = {
          id: String(nodeIdCounter++),
          type: 'parallelBox',
          position,
          data: {
            label: t('workflow.editor.parallelBox'),
            nodeCode: 'parallel_box',
            nodeType: 'parallel_box',
            parallelRule: 'all_required',
            width: 400,
            height: 200,
            childCount: 0,
          },
        }
        setNodes((nds) => nds.concat(newNode))
        return
      }

      const availableNode = availableNodes.find((n) => n.code === nodeCode)
      if (!availableNode) return

      const newNode: Node = {
        id: String(nodeIdCounter++),
        type: 'process',
        position,
        data: {
          label: t(`workflow.node.${availableNode.code}` as MessageKey),
          nodeCode: availableNode.code,
          nodeType: 'process',
          mandatory: true,
          bindStatusBefore: undefined,
          bindStatusAfter: undefined,
        },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [availableNodes, screenToFlowPosition, t, isReadOnly],
  )

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
      
      if (node.type === 'parallelBox') {
        // 并行框属性
        parallelBoxForm.setFieldsValue({
          label: node.data.label,
          parallelRule: node.data.parallelRule || 'all_required',
          width: node.data.width || 400,
          height: node.data.height || 200,
        })
        setParallelBoxDrawerOpen(true)
      } else {
        // 普通节点属性
        nodeForm.setFieldsValue({
          label: node.data.label,
          nodeCode: node.data.nodeCode,
          nodeType: node.data.nodeType || 'process',
          mandatory: node.data.mandatory ?? true,
          bindStatusBefore: node.data.bindStatusBefore,
          bindStatusAfter: node.data.bindStatusAfter,
          parentNodeId: node.data.parentNodeId,
        })
        setNodeDrawerOpen(true)
      }
    },
    [nodeForm, parallelBoxForm],
  )

  const handleNodeFormSave = useCallback(() => {
    void nodeForm.validateFields().then((values) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === selectedNodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                label: values.label,
                nodeCode: values.nodeCode,
                nodeType: values.nodeType,
                mandatory: values.mandatory,
                bindStatusBefore: values.bindStatusBefore,
                bindStatusAfter: values.bindStatusAfter,
                parentNodeId: values.parentNodeId,
              },
            }
          }
          return n
        }),
      )
      setNodeDrawerOpen(false)
    })
  }, [nodeForm, selectedNodeId])

  const handleParallelBoxSave = useCallback(() => {
    void parallelBoxForm.validateFields().then((values) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === selectedNodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                label: values.label,
                parallelRule: values.parallelRule,
                width: values.width,
                height: values.height,
              },
            }
          }
          return n
        }),
      )
      setParallelBoxDrawerOpen(false)
    })
  }, [parallelBoxForm, selectedNodeId])

  const handleDeleteNode = useCallback(() => {
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId))
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId))
    setSelectedNodeId(null)
    setNodeDrawerOpen(false)
    setParallelBoxDrawerOpen(false)
  }, [selectedNodeId])

  const handleSave = useCallback(async () => {
    if (!configId || !config) return
    setSaving(true)
    try {
      // 计算每个并行框的子节点数量
      const parallelBoxes = nodes.filter(n => n.type === 'parallelBox')
      
      parallelBoxes.forEach(box => {
        const childCount = nodes.filter(n => 
          n.type !== 'parallelBox' && 
          n.position.x >= box.position.x && 
          n.position.x <= box.position.x + Number(box.data.width || 400) &&
          n.position.y >= box.position.y && 
          n.position.y <= box.position.y + Number(box.data.height || 200)
        ).length
        box.data.childCount = childCount
      })

      const configJson = JSON.stringify({
        nodes: nodes.map((n, idx) => ({
          id: n.id,
          node_code: n.data.nodeCode,
          node_name: n.data.label,
          node_type: n.type === 'parallelBox' ? 'parallel_box' : n.type === 'start' ? 'start' : n.type === 'end' ? 'end' : 'process',
          mandatory: n.data.mandatory ?? true,
          parallel_rule: n.data.parallelRule,
          bind_status_before: n.data.bindStatusBefore,
          bind_status_after: n.data.bindStatusAfter,
          position_x: Math.round(n.position.x),
          position_y: Math.round(n.position.y),
          width: n.data.width,
          height: n.data.height,
          sequence: n.type === 'start' ? 0 : n.type === 'end' ? nodes.length - 1 : idx + 1,
          parent_node_id: n.data.parentNodeId ? parseInt(String(n.data.parentNodeId)) : undefined,
        })),
        edges: edges.map((e) => ({
          source: e.source,
          target: e.target,
        })),
      })

      await updateWorkflowConfig(Number(configId), { config_json: configJson })
      void message.success(t('workflow.editor.saveSuccess'))
      const detail = await getWorkflowConfigDetail(Number(configId))
      setConfig(detail)
      const { nodes: flowNodes, edges: flowEdges } = parseNodesToFlow(detail.nodes, detail.config_json)
      setNodes(flowNodes)
      setEdges(flowEdges)
    } catch (err: any) {
      if (isHandledError(err)) return
      const errorMsg = err?.response?.data?.message || t('workflow.editor.saveFailed')
      if (errorMsg.includes('PUBLISHED_CANNOT_EDIT')) {
        void message.error(t('workflow.editor.publishedCannotEdit'))
      } else {
        void message.error(errorMsg)
      }
    } finally {
      setSaving(false)
    }
  }, [configId, config, nodes, edges, t])

  const handlePublish = useCallback(async () => {
    if (!configId) return
    try {
      await publishWorkflowConfig(Number(configId))
      void message.success(t('workflow.editor.publishSuccess'))
      navigate('/workflow/configs')
    } catch (err) {
      // 错误已在拦截器中处理
    }
  }, [configId, navigate, t])

  const onDragStart = useCallback((event: React.DragEvent, nodeCode: string) => {
    event.dataTransfer.setData('application/reactflow', nodeCode)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  // 获取可作为父节点的并行框列表
  const getParallelBoxOptions = useCallback(() => {
    return nodes
      .filter(n => n.type === 'parallelBox')
      .map(n => ({ label: n.data.label, value: n.id }))
  }, [nodes])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 顶部工具栏 */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fff',
          flexShrink: 0,
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/workflow/configs')}>
            {t('workflow.editor.backToList')}
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {config?.process_name || t('menu.workflow.processConfig')}
          </Title>
          <Tag color={config?.status === 'published' ? 'green' : 'orange'}>
            {config?.status === 'published' ? t('workflow.status.published') : t('workflow.status.draft')}
          </Tag>
          {config && <Tag>v{config.version}</Tag>}
          {config?.status === 'published' && (
            <Tag color="red">{t('workflow.editor.readOnly')}</Tag>
          )}
        </Space>
        <Space>
          <Popconfirm
            title={t('workflow.editor.confirmPublish')}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            onConfirm={handlePublish}
            disabled={config?.status === 'published'}
          >
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              disabled={config?.status === 'published'}
            >
              {t('workflow.editor.publish')}
            </Button>
          </Popconfirm>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={config?.status === 'published'}
          >
            {t('workflow.editor.save')}
          </Button>
        </Space>
      </div>

      {/* 主体区域 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左侧可用环节面板 */}
        <div
          style={{
            width: 220,
            height: '100%',
            borderRight: '1px solid #f0f0f0',
            background: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* 流程节点区域 */}
          <div style={{ padding: 16, borderBottom: '1px solid #e8e8e8', flexShrink: 0 }}>
            <Text strong style={{ fontSize: 14, marginBottom: 8, display: 'block' }}>
              {t('workflow.editor.availableNodes')}
            </Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
              {t('workflow.editor.dragHint')}
            </Text>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px', minHeight: 0 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {availableNodes.map((node) => (
                <div
                  key={node.code}
                  draggable={!isReadOnly}
                  onDragStart={(e) => onDragStart(e, node.code)}
                  style={{
                    padding: '8px 12px',
                    background: '#fff',
                    border: '1px solid #d9d9d9',
                    borderRadius: 6,
                    cursor: isReadOnly ? 'default' : 'grab',
                    fontSize: 13,
                    opacity: isReadOnly ? 0.5 : 1,
                  }}
                >
                  {t(`workflow.node.${node.code}` as MessageKey)}
                  <br />
                  <Text type="secondary" style={{ fontSize: 11 }}>{node.code}</Text>
                </div>
              ))}
            </Space>
          </div>
          {/* 控制流区域 */}
          <div style={{ padding: 16, borderTop: '1px solid #e8e8e8', background: '#f0f0f0', flexShrink: 0, height: 140 }}>
            <Text strong style={{ fontSize: 14, marginBottom: 12, display: 'block' }}>
              {t('workflow.editor.controlFlow')}
            </Text>
            <div
              draggable={!isReadOnly}
              onDragStart={(e) => onDragStart(e, 'parallel_box')}
              style={{
                padding: '12px 16px',
                background: '#f6ffed',
                border: '2px dashed #52c41a',
                borderRadius: 6,
                cursor: isReadOnly ? 'default' : 'grab',
                fontSize: 13,
                textAlign: 'center',
                color: '#52c41a',
                opacity: isReadOnly ? 0.5 : 1,
              }}
            >
              <GroupOutlined style={{ marginRight: 8 }} />
              {t('workflow.editor.parallelBox')}
            </div>
          </div>
        </div>

        {/* 中间画布 */}
        <div ref={reactFlowWrapper} style={{ flex: 1, height: '100%' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            nodesDraggable={!isReadOnly}
            nodesConnectable={!isReadOnly}
            elementsSelectable={!isReadOnly}
            deleteKeyCode={isReadOnly ? null : ['Backspace', 'Delete']}
            fitView
          >
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            <Panel position="top-right">
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('workflow.editor.nodeCount')}: {nodes.length} | {t('workflow.editor.edgeCount')}: {edges.length}
              </Text>
            </Panel>
          </ReactFlow>
        </div>
      </div>

      {/* 右侧普通节点属性编辑抽屉 */}
      <Drawer
        title={t('workflow.editor.nodeProperties')}
        placement="right"
        width={360}
        open={nodeDrawerOpen}
        onClose={() => setNodeDrawerOpen(false)}
        extra={
          !isReadOnly ? (
          <Space>
            <Popconfirm
              title={t('workflow.editor.confirmDeleteNode')}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              onConfirm={handleDeleteNode}
            >
              <Button danger icon={<DeleteOutlined />}>{t('workflow.editor.delete')}</Button>
            </Popconfirm>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleNodeFormSave}>
              {t('workflow.editor.save')}
            </Button>
          </Space>
          ) : null
        }
      >
        <Form form={nodeForm} layout="vertical">
          <Form.Item name="label" label={t('workflow.editor.nodeName')} rules={[{ required: true, message: '请输入节点名称' }]}>
            <TrimInput disabled={isReadOnly} />
          </Form.Item>
          <Form.Item name="nodeCode" label={t('workflow.editor.nodeCode')}>
            <TrimInput disabled />
          </Form.Item>
          <Form.Item name="nodeType" label={t('workflow.editor.nodeType')}>
            <Select options={nodeTypeOptions} disabled />
          </Form.Item>
          <Form.Item name="mandatory" label={t('workflow.editor.mandatory')} valuePropName="checked">
            <Switch disabled={isReadOnly} />
          </Form.Item>
          <Form.Item name="parentNodeId" label="所属并行框">
            <Select 
              allowClear 
              options={getParallelBoxOptions()} 
              placeholder="选择所属的并行聚合框（可选）"
              disabled={isReadOnly}
            />
          </Form.Item>
          <Form.Item name="bindStatusBefore" label={t('workflow.editor.bindStatusBefore')}>
            <Select allowClear options={statusOptions} disabled={isReadOnly} />
          </Form.Item>
          <Form.Item name="bindStatusAfter" label={t('workflow.editor.bindStatusAfter')}>
            <Select allowClear options={statusOptions} disabled={isReadOnly} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 并行框属性编辑抽屉 */}
      <Drawer
        title="并行聚合框属性"
        placement="right"
        width={360}
        open={parallelBoxDrawerOpen}
        onClose={() => setParallelBoxDrawerOpen(false)}
        extra={
          !isReadOnly ? (
          <Space>
            <Popconfirm
              title={t('workflow.editor.confirmDeleteParallelBox')}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              onConfirm={handleDeleteNode}
            >
              <Button danger icon={<DeleteOutlined />}>{t('workflow.editor.delete')}</Button>
            </Popconfirm>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleParallelBoxSave}>
              保存
            </Button>
          </Space>
          ) : null
        }
      >
        <Form form={parallelBoxForm} layout="vertical">
          <Form.Item name="label" label="名称" rules={[{ required: true }]}>
            <TrimInput disabled={isReadOnly} />
          </Form.Item>
          <Form.Item name="parallelRule" label="聚合规则">
            <Radio.Group disabled={isReadOnly}>
              <Radio.Button value="all_required">全部完成</Radio.Button>
              <Radio.Button value="any_required">任一完成</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="width" label="宽度">
            <TrimInput type="number" disabled={isReadOnly} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="height" label="高度">
            <TrimInput type="number" disabled={isReadOnly} style={{ width: '100%' }} />
          </Form.Item>
          <Card size="small" title="使用说明" style={{ marginTop: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              1. 拖拽流程节点到并行框区域内，表示这些节点并行执行<br/>
              2. 全部完成：所有子节点完成后才能继续<br/>
              3. 任一完成：任意一个子节点完成后即可继续
            </Text>
          </Card>
        </Form>
      </Drawer>
    </div>
  )
}

// 开始节点组件
function StartNode({ selected }: { selected?: boolean }) {
  return (
    <div
      style={{
        width: 120,
        height: 40,
        background: '#f6ffed',
        border: `2px solid ${selected ? '#52c41a' : '#b7eb8f'}`,
        borderRadius: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 500,
        color: '#52c41a',
        boxShadow: selected ? '0 0 0 2px rgba(82,196,26,0.2)' : '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="source" position={Position.Bottom} style={{ background: '#52c41a' }} />
      开始
    </div>
  )
}

// 结束节点组件
function EndNode({ selected }: { selected?: boolean }) {
  return (
    <div
      style={{
        width: 120,
        height: 40,
        background: '#fff2f0',
        border: `2px solid ${selected ? '#ff4d4f' : '#ffccc7'}`,
        borderRadius: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 500,
        color: '#ff4d4f',
        boxShadow: selected ? '0 0 0 2px rgba(255,77,79,0.2)' : '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#ff4d4f' }} />
      结束
    </div>
  )
}

function parseNodesToFlow(nodes: WorkflowNodeConfigItem[], configJson?: string | null): { nodes: Node[]; edges: Edge[] } {
  const flowNodes: Node[] = []
  const flowEdges: Edge[] = []

  // 从 config_json 中解析 start 和 end 节点的位置
  let startPos = { x: 250, y: 0 }
  let endPos: { x: number; y: number } | null = null
  let savedNodes: Array<{ id: string; node_type: string; position_x: number; position_y: number }> = []

  if (configJson) {
    try {
      const parsed = JSON.parse(configJson)
      if (parsed.nodes && Array.isArray(parsed.nodes)) {
        savedNodes = parsed.nodes
        const startNode = parsed.nodes.find((n: any) => n.node_type === 'start')
        if (startNode) {
          startPos = { x: startNode.position_x ?? 250, y: startNode.position_y ?? 0 }
        }
        const endNode = parsed.nodes.find((n: any) => n.node_type === 'end')
        if (endNode) {
          endPos = { x: endNode.position_x ?? 250, y: endNode.position_y ?? 0 }
        }
      }
    } catch (err) {
      // 解析失败则使用默认位置
    }
  }

  // 添加开始节点
  flowNodes.push({
    id: 'start',
    type: 'start',
    position: startPos,
    data: { label: '开始', nodeCode: 'start', nodeType: 'start' },
  })

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const isParallelBox = node.node_type === 'parallel_box'
    const savedNode = savedNodes.find((n: any) => String(n.id) === String(node.id))
    
    flowNodes.push({
      id: String(node.id),
      type: isParallelBox ? 'parallelBox' : 'process',
      position: {
        x: savedNode?.position_x ?? node.position_x ?? 250,
        y: savedNode?.position_y ?? node.position_y ?? (i + 1) * 100,
      },
      data: {
        label: node.node_name,
        nodeCode: node.node_code,
        nodeType: node.node_type,
        mandatory: node.mandatory,
        parallelRule: node.parallel_rule,
        bindStatusBefore: node.bind_status_before,
        bindStatusAfter: node.bind_status_after,
        width: node.width || (isParallelBox ? 400 : 160),
        height: node.height || (isParallelBox ? 200 : 80),
        parentNodeId: node.parent_node_id ? String(node.parent_node_id) : undefined,
      },
    })
  }

  // 添加结束节点
  const lastY = flowNodes.length > 1 ? (flowNodes[flowNodes.length - 1].position.y + 100) : 200
  flowNodes.push({
    id: 'end',
    type: 'end',
    position: endPos ?? { x: 250, y: lastY },
    data: { label: '结束', nodeCode: 'end', nodeType: 'end' },
  })

  // 从 config_json 中解析保存的连线（包括 start/end 相关连线）
  if (configJson) {
    try {
      const parsed = JSON.parse(configJson)
      if (parsed.edges && Array.isArray(parsed.edges)) {
        for (const edge of parsed.edges) {
          const sourceId = String(edge.source)
          const targetId = String(edge.target)
          // 只添加两端节点都存在的连线
          const sourceExists = flowNodes.some(n => n.id === sourceId)
          const targetExists = flowNodes.some(n => n.id === targetId)
          if (sourceExists && targetExists) {
            flowEdges.push({
              id: `e-${sourceId}-${targetId}`,
              source: sourceId,
              target: targetId,
              type: 'smoothstep',
              animated: true,
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 20,
                height: 20,
                color: '#1677ff',
              },
              style: { stroke: '#1677ff', strokeWidth: 2 },
            })
          }
        }
      }
    } catch (err) {
      // 解析失败则回退到默认顺序连线
    }
  }

  // 如果 config_json 中没有解析到任何连线，使用默认顺序连线
  if (flowEdges.length === 0) {
    // 开始节点到第一个节点
    if (flowNodes.length > 2) {
      const firstRealNode = flowNodes[1]
      if (!firstRealNode.data.parentNodeId) {
        flowEdges.push({
          id: 'e-start-first',
          source: 'start',
          target: firstRealNode.id,
          type: 'smoothstep',
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: '#1677ff',
          },
          style: { stroke: '#1677ff', strokeWidth: 2 },
        })
      }
    }

    // 普通节点之间的连线
    for (let i = 1; i < flowNodes.length - 2; i++) {
      const current = flowNodes[i]
      const next = flowNodes[i + 1]

      // 跳过并行框内部的子节点之间的连线
      if (current.data.parentNodeId || next.data.parentNodeId) continue

      flowEdges.push({
        id: `e${current.id}-${next.id}`,
        source: current.id,
        target: next.id,
        type: 'smoothstep',
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#1677ff',
        },
        style: { stroke: '#1677ff', strokeWidth: 2 },
      })
    }

    // 最后一个节点到结束节点
    if (flowNodes.length > 2) {
      const lastRealNode = flowNodes[flowNodes.length - 2]
      if (!lastRealNode.data.parentNodeId) {
        flowEdges.push({
          id: `e-${lastRealNode.id}-end`,
          source: lastRealNode.id,
          target: 'end',
          type: 'smoothstep',
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: '#1677ff',
          },
          style: { stroke: '#1677ff', strokeWidth: 2 },
        })
      }
    }
  }

  return { nodes: flowNodes, edges: flowEdges }
}

export default function WorkflowEditor() {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner />
    </ReactFlowProvider>
  )
}
