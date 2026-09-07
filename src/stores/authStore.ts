import { create } from 'zustand'
import type { UserInfo } from '../types/auth'
import type { MenuItem } from '../types/menu'
import { getMe } from '../api/auth'
import { getUserMenus } from '../api/menus'

interface AuthState {
  token: string | null
  user: UserInfo | null
  isLoggedIn: boolean
  menus: MenuItem[]
  /** 菜单树是否已成功加载（区分"未加载"与"加载后为空=无任何菜单权限"） */
  menusLoaded: boolean
  login: (token: string, user: UserInfo) => void
  logout: () => void
  loadCurrentUser: () => Promise<void>
  loadMenus: () => Promise<void>
}

/** 深度优先获取菜单树中第一个可访问的页面路径（跳过分组和权限点） */
export function getFirstMenuPath(menus: MenuItem[]): string | null {
  for (const menu of menus) {
    if (menu.menu_type === 'permission') continue
    if (menu.path) return menu.path
    if (menu.children) {
      const childPath = getFirstMenuPath(menu.children)
      if (childPath) return childPath
    }
  }
  return null
}

/** 判断菜单树中是否存在指定路径的页面菜单 */
export function hasMenuPath(menus: MenuItem[], path: string): boolean {
  return menus.some(
    (m) => m.path === path || (m.children ? hasMenuPath(m.children, path) : false),
  )
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  user: null,
  isLoggedIn: !!localStorage.getItem('token'),
  menus: [],
  menusLoaded: false,
  login: (token, user) => {
    localStorage.setItem('token', token)
    set({ token, user, isLoggedIn: true })
  },
  logout: () => {
    localStorage.removeItem('token')
    set({ token: null, user: null, isLoggedIn: false, menus: [], menusLoaded: false })
  },
  /** 从 /auth/me 加载完整用户信息（含角色代码），页面刷新或登录后调用 */
  loadCurrentUser: async () => {
      const { token, logout } = get()
      if (!token) return
      try {
        const user = await getMe()
        set({ user })
      } catch (err: any) {
        if (err.response?.status === 401) {
          logout()
        }
      }
    },
  /** 从 /menus/user 加载当前用户的菜单树（根据角色权限过滤） */
  loadMenus: async () => {
    const { token } = get()
    if (!token) return
    try {
      const menus = await getUserMenus()
      set({ menus, menusLoaded: true })
    } catch (e) {
      console.error('Failed to load menus:', e)
    }
  },
}))

// 跨标签页同步：当其他标签页清除 token（如空闲超时登出）时，当前标签页也自动登出
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'token' && event.newValue === null) {
      console.warn('[AuthStore] 检测到其他标签页已登出，同步清空当前状态')
      useAuthStore.setState({ token: null, user: null, isLoggedIn: false, menus: [], menusLoaded: false })
    }
  })
}
