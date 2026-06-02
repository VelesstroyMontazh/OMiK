import { NextRequest, NextResponse } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

const STATUS_TIMEOUT_MS = 180_000
const DELETE_TIMEOUT_MS = 300_000
const LOAD_TIMEOUT_MS = 600_000
const PROCESS_TIMEOUT_MS = 600_000
const DATA_TIMEOUT_MS = 120_000
const DASHBOARD_TIMEOUT_MS = 600_000
const EXPORT_TIMEOUT_MS = 600_000

export const maxDuration = 600

function appendPloshchadkaFilter(params: URLSearchParams, searchParams: URLSearchParams) {
  const ploshchadka = searchParams.get('ploshchadka') || searchParams.get('podrazdelenie')
  if (ploshchadka) params.set('ploshchadka', ploshchadka)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'status'

  switch (action) {
    case 'status': {
      const registry = searchParams.get('registry')
      const light = searchParams.get('light') === 'true'
      const params = new URLSearchParams()
      if (registry) params.set('registry', registry)
      if (light) params.set('light', 'true')
      const qs = params.toString() ? `?${params.toString()}` : ''
      return proxyBackend(`/api/tickets-costs/status${qs}`, undefined, STATUS_TIMEOUT_MS)
    }
    case 'filter-options': {
      const registry = searchParams.get('registry') || 'vsm'
      return proxyBackend(
        `/api/tickets-costs/filter-options?registry=${encodeURIComponent(registry)}`,
        undefined,
        STATUS_TIMEOUT_MS,
      )
    }
    case 'dashboard': {
      const params = new URLSearchParams()
      const registry = searchParams.get('registry')
      const year = searchParams.get('year')
      const month = searchParams.get('month')
      if (registry) params.set('registry', registry)
      if (year) params.set('year', year)
      if (month) params.set('month', month)
      appendPloshchadkaFilter(params, searchParams)
      const obosnovanie = searchParams.get('obosnovanie')
      if (obosnovanie) params.set('obosnovanie', obosnovanie)
      const organizaciya = searchParams.get('organizaciya')
      if (organizaciya) params.set('organizaciya', organizaciya)
      const klassifikaciya = searchParams.get('klassifikaciya')
      if (klassifikaciya) params.set('klassifikaciya', klassifikaciya)
      const aviaperevozchik = searchParams.get('aviaperevozchik')
      if (aviaperevozchik) params.set('aviaperevozchik', aviaperevozchik)
      const qs = params.toString() ? `?${params.toString()}` : ''
      return proxyBackend(`/api/tickets-costs/dashboard${qs}`, undefined, DASHBOARD_TIMEOUT_MS)
    }
    case 'data': {
      const params = new URLSearchParams()
      params.set('registry', searchParams.get('registry') || 'vsm')
      const search = searchParams.get('search')
      const year = searchParams.get('year')
      const month = searchParams.get('month')
      const obosnovanie = searchParams.get('obosnovanie')
      if (search) params.set('search', search)
      appendPloshchadkaFilter(params, searchParams)
      if (year) params.set('year', year)
      if (month) params.set('month', month)
      if (obosnovanie) params.set('obosnovanie', obosnovanie)
      const organizaciya = searchParams.get('organizaciya')
      if (organizaciya) params.set('organizaciya', organizaciya)
      const klassifikaciya = searchParams.get('klassifikaciya')
      if (klassifikaciya) params.set('klassifikaciya', klassifikaciya)
      const aviaperevozchik = searchParams.get('aviaperevozchik')
      if (aviaperevozchik) params.set('aviaperevozchik', aviaperevozchik)
      params.set('offset', searchParams.get('offset') || '0')
      const limitParam = searchParams.get('limit')
      params.set('limit', limitParam ?? '200')
      const dataTimeout = limitParam === '0' ? PROCESS_TIMEOUT_MS : DATA_TIMEOUT_MS
      return proxyBackend(`/api/tickets-costs/data?${params.toString()}`, undefined, dataTimeout)
    }
    case 'export': {
      const params = new URLSearchParams()
      params.set('registry', searchParams.get('registry') || 'vsm')
      const search = searchParams.get('search')
      const podrazdelenie = searchParams.get('podrazdelenie')
      const year = searchParams.get('year')
      const month = searchParams.get('month')
      const obosnovanie = searchParams.get('obosnovanie')
      if (search) params.set('search', search)
      if (podrazdelenie) params.set('podrazdelenie', podrazdelenie)
      if (year) params.set('year', year)
      if (month) params.set('month', month)
      if (obosnovanie) params.set('obosnovanie', obosnovanie)
      const organizaciya = searchParams.get('organizaciya')
      if (organizaciya) params.set('organizaciya', organizaciya)
      const klassifikaciya = searchParams.get('klassifikaciya')
      if (klassifikaciya) params.set('klassifikaciya', klassifikaciya)
      const aviaperevozchik = searchParams.get('aviaperevozchik')
      if (aviaperevozchik) params.set('aviaperevozchik', aviaperevozchik)
      return proxyBackend(`/api/tickets-costs/export?${params.toString()}`, undefined, EXPORT_TIMEOUT_MS)
    }
    case 'source-preview': {
      const registry = searchParams.get('registry') || 'vsm'
      const fileId = searchParams.get('file_id')
      if (!fileId) return NextResponse.json({ error: 'file_id required' }, { status: 400 })
      return proxyBackend(
        `/api/tickets-costs/source-preview?registry=${encodeURIComponent(registry)}&file_id=${encodeURIComponent(fileId)}`,
        undefined,
        DATA_TIMEOUT_MS,
      )
    }
    case 'runs': {
      const registry = searchParams.get('registry') || 'vsm'
      return proxyBackend(`/api/tickets-costs/runs?registry=${encodeURIComponent(registry)}`, undefined, STATUS_TIMEOUT_MS)
    }
    case 'run-data': {
      const registry = searchParams.get('registry') || 'vsm'
      const runId = searchParams.get('run_id')
      if (!runId) return NextResponse.json({ error: 'run_id required' }, { status: 400 })
      const offset = searchParams.get('offset') || '0'
      const limit = searchParams.get('limit') || '0'
      return proxyBackend(
        `/api/tickets-costs/run-data?registry=${encodeURIComponent(registry)}&run_id=${encodeURIComponent(runId)}&offset=${offset}&limit=${limit}`,
        undefined,
        DATA_TIMEOUT_MS,
      )
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const action = body.action as string
  const registry = body.registry || 'vsm'

  switch (action) {
    case 'queue-add':
      return proxyBackend(
        '/api/tickets-costs/upload-queue',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registry,
            items: body.items || [],
          }),
        },
        STATUS_TIMEOUT_MS,
      )
    case 'load': {
      const loadPath = body.background
        ? '/api/tickets-costs/load?background=true'
        : '/api/tickets-costs/load'
      return proxyBackend(
        loadPath,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_paths: body.file_paths || [],
            registry,
            sheet_name: body.sheet_name,
            append: Boolean(body.append),
          }),
        },
        body.background ? 60_000 : LOAD_TIMEOUT_MS,
      )
    }
    case 'pipeline':
      return proxyBackend(
        '/api/tickets-costs/pipeline?background=true',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registry,
            file_paths: body.file_paths || [],
            sheet_name: body.sheet_name,
            append: Boolean(body.append),
            fuzzy_fio_cutoff: Number(body.fuzzy_fio_cutoff) || 86,
          }),
        },
        60_000,
      )
    case 'process': {
      const background = Boolean(body.background)
      const path = background
        ? '/api/tickets-costs/process?background=true'
        : '/api/tickets-costs/process'
      return proxyBackend(
        path,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registry,
            fuzzy_fio_cutoff: Number(body.fuzzy_fio_cutoff) || 86,
          }),
        },
        background ? 30_000 : PROCESS_TIMEOUT_MS,
      )
    }
    case 'save-rows':
      return proxyBackend(
        '/api/tickets-costs/save-rows',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registry, rows: body.rows || [] }),
        },
        DATA_TIMEOUT_MS,
      )
    case 'activate-run':
      return proxyBackend(
        '/api/tickets-costs/activate-run',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registry, run_id: body.run_id }),
        },
        PROCESS_TIMEOUT_MS,
      )
    case 'dedupe-enrich':
      return proxyBackend(
        '/api/tickets-costs/dedupe-enrich',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registry,
            fuzzy: Boolean(body.fuzzy),
            fuzzy_fio_cutoff: Number(body.fuzzy_fio_cutoff) || 86,
            run_dedupe: body.run_dedupe !== false,
          }),
        },
        PROCESS_TIMEOUT_MS,
      )
    case 'table-action':
      return proxyBackend(
        '/api/tickets-costs/table-action',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registry,
            action: body.table_action || body.action,
            fuzzy_fio_cutoff: Number(body.fuzzy_fio_cutoff) || 90,
          }),
        },
        PROCESS_TIMEOUT_MS,
      )
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const registry = searchParams.get('registry') || 'vsm'

  if (action === 'delete-run') {
    const runId = searchParams.get('run_id')
    if (!runId) return NextResponse.json({ error: 'run_id required' }, { status: 400 })
    return proxyBackend(
      `/api/tickets-costs/run?registry=${encodeURIComponent(registry)}&run_id=${encodeURIComponent(runId)}`,
      { method: 'DELETE' },
      DELETE_TIMEOUT_MS,
    )
  }
  if (action === 'queue-remove') {
    const queueId = searchParams.get('queue_id')
    if (!queueId) return NextResponse.json({ error: 'queue_id required' }, { status: 400 })
    return proxyBackend(
      `/api/tickets-costs/upload-queue?registry=${encodeURIComponent(registry)}&queue_id=${encodeURIComponent(queueId)}`,
      { method: 'DELETE' },
      STATUS_TIMEOUT_MS,
    )
  }
  if (action === 'delete-source') {
    const fileId = searchParams.get('file_id')
    if (!fileId) return NextResponse.json({ error: 'file_id required' }, { status: 400 })
    return proxyBackend(
      `/api/tickets-costs/source-file?registry=${encodeURIComponent(registry)}&file_id=${encodeURIComponent(fileId)}`,
      { method: 'DELETE' },
      DELETE_TIMEOUT_MS,
    )
  }
  if (action === 'clear-sources') {
    return proxyBackend(
      `/api/tickets-costs/source-files?registry=${encodeURIComponent(registry)}`,
      { method: 'DELETE' },
      DELETE_TIMEOUT_MS,
    )
  }

  return proxyBackend(
    `/api/tickets-costs/clear?registry=${encodeURIComponent(registry)}`,
    { method: 'DELETE' },
    DELETE_TIMEOUT_MS,
  )
}
