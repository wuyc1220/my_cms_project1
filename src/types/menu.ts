/** 菜单相关类型定义 */

export interface MenuItem {
  id: number
  parent_id: number | null
  name: string
  i18n_key: string
  path: string | null
  icon: string | null
  sort_order: number
  status: string
  is_external: boolean
  menu_type: string  // 'menu' | 'permission'
  children?: MenuItem[]
}

export interface MenuCreatePayload {
  parent_id?: number | null
  name: string
  i18n_key: string
  path?: string | null
  icon?: string | null
  sort_order?: number
  status?: string
  is_external?: boolean
  menu_type?: string  // 'menu' | 'permission'
}

export interface MenuUpdatePayload {
  parent_id?: number | null
  name?: string
  i18n_key?: string
  path?: string | null
  icon?: string | null
  sort_order?: number
  status?: string
  is_external?: boolean
  menu_type?: string  // 'menu' | 'permission'
}
