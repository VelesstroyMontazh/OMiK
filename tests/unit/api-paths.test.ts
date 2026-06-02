import { describe, expect, it } from 'vitest'
import { BACKEND_PATHS, EXCEL_ROUTES, excelRoute } from '@/lib/api-paths'

describe('api-paths', () => {
  it('maps tickets status paths', () => {
    expect(BACKEND_PATHS.TICKETS_REGISTRY_STATUS).toBe('/api/tickets-registry/status')
    expect(EXCEL_ROUTES.TICKETS_COSTS).toBe('/api/excel/tickets-costs')
  })

  it('excelRoute normalizes paths', () => {
    expect(excelRoute('/upload')).toBe('/api/excel/upload')
    expect(excelRoute('/api/excel/health')).toBe('/api/excel/health')
  })

  it('encodes job id', () => {
    expect(EXCEL_ROUTES.JOBS('abc/123')).toBe('/api/excel/jobs/abc%2F123')
  })
})
