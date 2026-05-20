export interface WorkflowNodeConfigItem {
  id: number
  workflow_config_id: number
  node_code: string
  node_name: string
  node_type: 'process' | 'parallel_box'
  mandatory: boolean
  parallel_rule?: string
  bind_status_before?: string
  bind_status_after?: string
  position_x?: number
  position_y?: number
  width?: number
  height?: number
  sequence: number
  parent_node_id?: number
  created_at?: string
  updated_at?: string
}

export interface WorkflowConfigListItem {
  id: number
  process_code: string
  process_name: string
  belonging: string
  status: 'draft' | 'published'
  version: number
  published_version?: number
  created_at?: string
  updated_at?: string
}

export interface WorkflowConfigDetail {
  id: number
  process_code: string
  process_name: string
  belonging: string
  status: 'draft' | 'published'
  version: number
  published_version?: number
  config_json?: string
  nodes: WorkflowNodeConfigItem[]
  created_at?: string
  updated_at?: string
}

export interface WorkflowConfigCreatePayload {
  process_code: string
  process_name: string
  belonging: string
}

export interface WorkflowConfigUpdatePayload {
  process_code?: string
  process_name?: string
  belonging?: string
  config_json?: string
}

export interface AvailableNode {
  code: string
  name: string
  name_en: string
}

export interface WorkflowConfigQueryParams {
  page?: number
  page_size?: number
  process_code?: string
  process_name?: string
  belonging?: string[]
  status?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}
