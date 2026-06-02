import { NextRequest, NextResponse } from 'next/server'
import { backendFetch } from '@/lib/backend-proxy'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const includeSheets = new URL(request.url).searchParams.get('include_sheets') === 'true'
    const backendPath = includeSheets ? '/api/files?include_sheets=true' : '/api/files'
    const backendData = await backendFetch<{ files?: Record<string, unknown>[] }>(
      backendPath,
      {},
      60_000,
    )

    let dbFiles: Awaited<ReturnType<typeof db.excelFile.findMany>> = []
    try {
      dbFiles = await db.excelFile.findMany({ orderBy: { createdAt: 'desc' } })
    } catch (dbError) {
      console.error('Failed to fetch files from database:', dbError)
    }

    const dbFileMap = new Map(dbFiles.map((f) => [f.path, f]))

    const combinedFiles = (backendData.files || []).map((backendFile) => {
      const dbRecord = dbFileMap.get(backendFile.file_path as string)
      return {
        ...backendFile,
        dbId: dbRecord?.id ?? null,
        description: dbRecord?.description ?? '',
        isActive: dbRecord?.isActive ?? false,
        createdAt: dbRecord?.createdAt?.toISOString() ?? null,
        updatedAt: dbRecord?.updatedAt?.toISOString() ?? null,
      }
    })

    const backendPaths = new Set(
      (backendData.files || []).map((f) => f.file_path as string),
    )
    const dbOnlyFiles = dbFiles
      .filter((f) => !backendPaths.has(f.path))
      .map((f) => ({
        file_id: f.id,
        stored_filename: f.name,
        file_path: f.path,
        file_size: f.size,
        extension: f.name.includes('.') ? '.' + f.name.split('.').pop() : '',
        sheets: [],
        dbId: f.id,
        description: f.description,
        isActive: f.isActive,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
        deletedFromDisk: true,
      }))

    return NextResponse.json({
      files: [...combinedFiles, ...dbOnlyFiles],
      count: combinedFiles.length + dbOnlyFiles.length,
    })
  } catch (error) {
    console.error('List files error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
