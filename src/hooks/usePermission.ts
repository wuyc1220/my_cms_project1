import { useMemo } from 'react'
import { useAuthStore } from '../stores/authStore'
import type { MenuItem } from '../types/menu'

function collectPermissionKeys(items: MenuItem[]): Set<string> {
  const keys = new Set<string>()
  const walk = (list: MenuItem[]) => {
    for (const item of list) {
      if (item.menu_type === 'permission') {
        keys.add(item.i18n_key)
      }
      if (item.children?.length) {
        walk(item.children)
      }
    }
  }
  walk(items)
  return keys
}

export function usePermission() {
  const { user, menus } = useAuthStore()

  const isAdmin = useMemo(
    () => !!user?.role_codes?.includes('admin'),
    [user?.role_codes],
  )

  const permissionKeys = useMemo(
    () => collectPermissionKeys(menus),
    [menus],
  )

  const hasPermission = (key: string): boolean => {
    if (isAdmin) return true
    return permissionKeys.has(key)
  }

  return { hasPermission, permissionKeys, isAdmin }
}
