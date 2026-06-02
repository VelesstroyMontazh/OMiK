import { describe, expect, it } from 'vitest'
import {
  isUnderMainDbUpload,
  mainDbUploadError,
  MAIN_DB_UPLOAD_DIR,
  normalizePath,
} from '@/lib/main-db-upload'

describe('main-db-upload', () => {
  it('normalizes slashes and trailing backslashes', () => {
    expect(normalizePath('C:/Otchet/upload/')).toBe('c:\\otchet\\upload')
  })

  it('accepts files under project upload dir', () => {
    const file = `${MAIN_DB_UPLOAD_DIR}\\Отчет.xlsx`
    expect(isUnderMainDbUpload(file)).toBe(true)
    expect(isUnderMainDbUpload(file.replace(/\\/g, '/'))).toBe(true)
  })

  it('rejects files outside upload dir', () => {
    expect(isUnderMainDbUpload('C:\\Otchet_OP_Marina\\OMiK_VSM\\download\\a.xlsx')).toBe(false)
    expect(isUnderMainDbUpload('D:\\other\\a.xlsx')).toBe(false)
  })

  it('builds error message with upload dir', () => {
    expect(mainDbUploadError()).toContain(MAIN_DB_UPLOAD_DIR)
  })
})
