/** Единственный каталог Excel/SQLite для Основной Базы (синхронно с backend MAIN_DB_DIR). */
export const MAIN_DB_UPLOAD_DIR = 'C:\\Otchet_OP_Marina\\OMiK_VSM\\upload'

export function normalizePath(p: string): string {
  return p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
}

export function isUnderMainDbUpload(filePath: string, uploadDir?: string | null): boolean {
  const root = normalizePath(uploadDir?.trim() || MAIN_DB_UPLOAD_DIR)
  const file = normalizePath(filePath.trim())
  return file === root || file.startsWith(`${root}\\`)
}

export function mainDbUploadError(uploadDir?: string | null): string {
  const dir = uploadDir?.trim() || MAIN_DB_UPLOAD_DIR
  return `Основная База загружается только из папки: ${dir}`
}
