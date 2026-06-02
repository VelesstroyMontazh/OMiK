import { pingExcelBackend } from '@/lib/backend-proxy'
import { tryLaunchExcelService } from '@/lib/excel-service-launcher'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForPing(maxWaitMs: number): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    if (await pingExcelBackend(5000)) {
      return true
    }
    await sleep(1500)
  }
  return false
}

/**
 * Server-side: поднять excel на :3031 (убивает зависший процесс на порту).
 */
export async function ensureExcelBackendServer(
  maxWaitMs = 90_000,
): Promise<{ status: 'ok' | 'down' | 'busy'; detail?: string }> {
  if (await pingExcelBackend(2500)) {
    return { status: 'ok' }
  }

  // Долгий ответ = сервер занят тяжёлой операцией, но жив
  if (await pingExcelBackend(25_000)) {
    return { status: 'ok' }
  }

  // Порт часто занят «зомби» — сразу force-restart, без ручного START.bat
  await tryLaunchExcelService({ skipCooldown: true, forceRestart: true })
  if (await waitForPing(maxWaitMs)) {
    return { status: 'ok' }
  }

  if (await pingExcelBackend(30_000)) {
    return { status: 'busy', detail: 'Excel-service занят длительной операцией.' }
  }

  return {
    status: 'down',
    detail:
      'Excel на :3031 не отвечает. Дважды щёлкните RESTART-EXCEL.bat в папке проекта, затем F5.',
  }
}
