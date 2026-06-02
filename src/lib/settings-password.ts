export const SETTINGS_PASSWORD = 'admin2606'

export const SETTINGS_AUTH_KEY = 'omik_settings_authenticated'

export function checkSettingsPassword(value: string): boolean {
  return value.trim() === SETTINGS_PASSWORD
}

export function isSettingsAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(SETTINGS_AUTH_KEY) === '1'
}

export function setSettingsAuthenticated(): void {
  sessionStorage.setItem(SETTINGS_AUTH_KEY, '1')
}

export function clearSettingsAuthenticated(): void {
  sessionStorage.removeItem(SETTINGS_AUTH_KEY)
}
