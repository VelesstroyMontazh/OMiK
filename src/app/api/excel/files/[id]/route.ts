import { NextRequest, NextResponse } from 'next/server'
import type { ExcelFile } from '@prisma/client'
import { backendFetch, proxyBackend } from '@/lib/backend-proxy'
import { db } from '@/lib/db'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    let backendData: Record<string, unknown> | null = null
    try {
      backendData = await backendFetch<Record<string, unknown>>(
        `/api/file/${encodeURIComponent(id)}`,
      )
    } catch {
      backendData = null
    }

    let dbFile: ExcelFile | null = null
    try {
      dbFile = await db.excelFile.findUnique({ where: { id } })
    } catch (dbError) {
      console.error('Database lookup error:', dbError)
    }

    if (!backendData && !dbFile) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...(backendData || {}),
      dbId: dbFile?.id ?? null,
      description: dbFile?.description ?? '',
      isActive: dbFile?.isActive ?? false,
      createdAt: dbFile?.createdAt?.toISOString() ?? null,
      updatedAt: dbFile?.updatedAt?.toISOString() ?? null,
    })
  } catch (error) {
    console.error('Get file error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    let backendData: Record<string, unknown> | null = null
    try {
      const res = await proxyBackend(`/api/file/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (res.status !== 200 && res.status !== 404) {
        const body = (await res.json()) as { detail?: string }
        return NextResponse.json(
          { error: body.detail || `Backend error: ${res.status}` },
          { status: res.status },
        )
      }
      if (res.status === 200) {
        backendData = (await res.json()) as Record<string, unknown>
      }
    } catch (error) {
      console.error('Backend delete error:', error)
    }

    try {
      await db.excelFile.deleteMany({ where: { id } })
    } catch (dbError) {
      console.error('Database delete error:', dbError)
    }

    return NextResponse.json({
      deleted: true,
      file_id: id,
      backend: backendData,
    })
  } catch (error) {
    console.error('Delete file error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
