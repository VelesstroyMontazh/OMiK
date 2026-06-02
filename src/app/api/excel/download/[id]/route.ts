import { NextRequest, NextResponse } from 'next/server'
import { proxyBackendRaw } from '@/lib/backend-proxy'
import { db } from '@/lib/db'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    let filePath: string | null = null
    try {
      const dbFile = await db.excelFile.findUnique({ where: { id } })
      if (dbFile) filePath = dbFile.path
    } catch (dbError) {
      console.error('Database lookup error:', dbError)
    }

    const backendId = filePath
      ? filePath.split('/').pop()?.split('.')[0] || id
      : id

    const res = await proxyBackendRaw(`/api/download/${encodeURIComponent(backendId)}`)
    if (res.status !== 200) return res

    if (!res.headers.get('content-disposition') && filePath) {
      const filename = filePath.split(/[/\\]/).pop() || 'download.xlsx'
      const headers = new Headers(res.headers)
      headers.set('Content-Disposition', `attachment; filename="${filename}"`)
      return new NextResponse(res.body, { status: res.status, headers })
    }
    return res
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
