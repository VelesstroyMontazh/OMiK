import { spawn } from 'child_process'
import path from 'path'
import { pingExcelBackend } from '@/lib/backend-proxy'

let launchInProgress = false
let lastLaunchAttempt = 0
const LAUNCH_COOLDOWN_MS = 15_000

/** Windows: subprocess without console window (0x08000000) */
const CREATE_NO_WINDOW = 0x08000000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Тот же интерпретатор, что в START.bat / терминале пользователя. */
function resolvePythonExecutable(): string {
  const fromEnv = process.env.PYTHON?.trim()
  if (fromEnv) {
    return fromEnv.replace(/pythonw(\.exe)?$/i, 'python$1')
  }
  return process.platform === 'win32' ? 'python' : 'python3'
}

/**
 * Поднимает excel-service (порт 3031). По умолчанию без force-restart.
 */
export async function tryLaunchExcelService(options?: {
  forceRestart?: boolean
  skipCooldown?: boolean
}): Promise<boolean> {
  if (await pingExcelBackend(3000)) {
    return true
  }

  const forceRestart = options?.forceRestart ?? false
  const now = Date.now()
  if (
    !options?.skipCooldown &&
    (launchInProgress || now - lastLaunchAttempt < LAUNCH_COOLDOWN_MS)
  ) {
    return false
  }

  launchInProgress = true
  lastLaunchAttempt = now

  try {
    const root = process.cwd()
    const pyScript = path.join(root, '.zscripts', 'start_excel_service.py')
    const python = resolvePythonExecutable()
    const args = [pyScript, '--quiet']
    if (forceRestart) {
      args.push('--force-restart')
    }

    const child = spawn(python, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      cwd: root,
      env: { ...process.env, EXCEL_SERVICE_QUIET: '1' },
      ...(process.platform === 'win32' ? { creationFlags: CREATE_NO_WINDOW } : {}),
    })
    child.unref()

    for (let i = 0; i < 90; i++) {
      await sleep(1000)
      if (await pingExcelBackend(4000)) {
        return true
      }
    }
    return false
  } finally {
    launchInProgress = false
  }
}

export async function ensureExcelBackendReachable(): Promise<boolean> {
  if (await pingExcelBackend(3000)) {
    return true
  }
  return tryLaunchExcelService({ skipCooldown: true })
}

/** Ждём health перед upload/load (с автозапуском). */
export async function waitForExcelBackend(maxWaitMs = 60_000): Promise<boolean> {
  if (await pingExcelBackend(3000)) {
    return true
  }
  void tryLaunchExcelService({ skipCooldown: true })

  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    if (await pingExcelBackend(3000)) {
      return true
    }
    await sleep(1500)
  }
  return false
}
