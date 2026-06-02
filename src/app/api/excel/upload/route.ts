import { NextRequest, NextResponse } from 'next/server'
import { errorDetail, fetchFromExcelBackend } from '@/lib/backend-proxy'
import { ensureExcelBackendServer } from '@/lib/ensure-excel-backend'
import { db } from '@/lib/db'

/** Крупные .xlsm (18+ MB) — до 10 мин на файл */
export const maxDuration = 600

const UPLOAD_TIMEOUT_MS = 600_000

export async function POST(request: NextRequest) {
  try {
    const ensured = await ensureExcelBackendServer(45_000)
    if (ensured.status !== 'ok' && ensured.status !== 'busy') {
      const msg = ensured.detail || 'Excel-service не запущен на :3031'
      return NextResponse.json({ error: msg, detail: msg }, { status: 503 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const backendForm = new FormData()
    backendForm.append('file', file)

    const response = await fetchFromExcelBackend(
      '/api/upload',
      {
        method: 'POST',
        body: backendForm,
      },
      UPLOAD_TIMEOUT_MS,
    )

    if (!response.ok) {
      let errorMessage = response.statusText
      try {
        const body = (await response.json()) as { detail?: unknown; error?: unknown }
        const raw = body.detail ?? body.error
        if (raw) {
          errorMessage =
            typeof raw === 'string' ? raw : JSON.stringify(raw)
        }
      } catch {
        // ignore
      }
      return NextResponse.json(
        { error: errorMessage, detail: errorMessage },
        { status: response.status },
      )
    }

    const data = (await response.json()) as {
      stored_filename?: string
      file_path?: string
      file_size?: number
      sheets?: unknown[]
      file_id?: string
      original_filename?: string
    }

    try {
      await db.excelFile.create({
        data: {
          name: data.stored_filename || file.name,
          originalName: file.name,
          path: data.file_path || '',
          size: data.file_size || file.size,
          sheetCount: Array.isArray(data.sheets) ? data.sheets.length : 0,
          isActive: false,
          description: '',
        },
      })
    } catch (dbError) {
      console.error('Failed to save file metadata to database:', dbError)
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Upload error:', error)
    const message = errorDetail(error, UPLOAD_TIMEOUT_MS)
    return NextResponse.json({ error: message, detail: message }, { status: 500 })
  }
}
