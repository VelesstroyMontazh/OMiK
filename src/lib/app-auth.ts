export type AppUserRole = 'admin' | 'cok' | 'user'

export interface AppUser {
  login: string
  role: AppUserRole
  sites: string[]
}

const STORAGE_KEY = 'omik_app_user'

export function getAppUser(): AppUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AppUser
  } catch {
    return null
  }
}

export function setAppUser(user: AppUser | null): void {
  if (typeof window === 'undefined') return
  if (!user) sessionStorage.removeItem(STORAGE_KEY)
  else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

/** Admin и ЦОК — полный доступ ко всем площадкам и массовая загрузка. */
export function hasFullSiteAccess(user: AppUser | null): boolean {
  if (!user) return false
  return user.role === 'admin' || user.role === 'cok'
}

export function canAccessSite(user: AppUser | null, site: string): boolean {
  if (!user || hasFullSiteAccess(user)) return true
  const s = site.trim().toLowerCase()
  return user.sites.some((x) => x.trim().toLowerCase() === s)
}
