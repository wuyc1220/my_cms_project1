export interface DictNodeListItem {
  id: number
  parent_id: number | null
  code: string
  name: string
  sort_order: number
  status: string
  remark: string | null
  is_system: boolean
  children: DictNodeListItem[]
}

export interface DictNodeCreatePayload {
  parent_id?: number | null
  code?: string | null
  name: string
  sort_order?: number
  remark?: string | null
}

export interface DictNodeUpdatePayload {
  name?: string
  sort_order?: number
  remark?: string | null
}
