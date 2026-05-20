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
  login: (token: string, user: UserInfo) => void
  logout: () => void
  loadCurrentUser: () => Promise<void>
  loadMenus: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  user: null,
  isLoggedIn: !!localStorage.getItem('token'),
  menus: [],
  login: (token, user) => {
    localStorage.setItem('token', token)
    set({ token, user, isLoggedIn: true })
  },
  logout: () => {
    localStorage.removeItem('token')
    set({ token: null, user: null, isLoggedIn: false, menus: [] })
  },
  /** 从 /auth/me 加载完整用户信息（含角色代码），页面刷新或登录后调用 */
  loadCurrentUser: async () => {
    const { token } = get()
    if (!token) return
    try {
      const user = await getMe()
      set({ user })
    } catch {
      // token 失效时静默忽略，保持当前登录状态不变
    }
  },
  /** 从 /menus/user 加载当前用户的菜单树（根据角色权限过滤） */
  loadMenus: async () => {
    const { token } = get()
    if (!token) return
    try {
      const menus = await getUserMenus()
      set({ menus })
    } catch (e) {
      console.error('Failed to load menus:', e)
    }
  },
}))
