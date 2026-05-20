import request from './index'
import type { MenuItem, MenuCreatePayload, MenuUpdatePayload } from '../types/menu'

/** 获取当前用户菜单树（根据角色权限过滤） */
export const getUserMenus = async (): Promise<MenuItem[]> => {
  const response = await request.get<MenuItem[]>('/menus/user')
  return response.data
}

/** 获取完整菜单树（管理用） */
export const getMenuTree = async (): Promise<MenuItem[]> => {
  const response = await request.get<MenuItem[]>('/menus/')
  return response.data
}

/** 创建菜单 */
export const createMenu = async (data: MenuCreatePayload): Promise<MenuItem> => {
  const response = await request.post<MenuItem>('/menus/', data)
  return response.data
}

/** 更新菜单 */
export const updateMenu = async (id: number, data: MenuUpdatePayload): Promise<MenuItem> => {
  const response = await request.put<MenuItem>(`/menus/${id}`, data)
  return response.data
}

/** 删除菜单 */
export const deleteMenu = async (id: number): Promise<void> => {
  await request.delete(`/menus/${id}`)
}

/** 获取角色关联的菜单ID列表 */
export const getRoleMenuIds = async (roleId: number): Promise<number[]> => {
  const response = await request.get<number[]>(`/menus/roles/${roleId}/ids`)
  return response.data
}

/** 分配角色菜单权限 */
export const assignRoleMenus = async (roleId: number, menuIds: number[]): Promise<void> => {
  await request.put(`/menus/roles/${roleId}`, { menu_ids: menuIds })
}
