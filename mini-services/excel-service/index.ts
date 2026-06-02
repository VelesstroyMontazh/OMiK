import { spawn } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const serviceDir = dirname(fileURLToPath(import.meta.url))

const pythonProcess = spawn('python', ['app.py'], {
  cwd: serviceDir,
  stdio: 'inherit',
  env: { ...process.env, PORT: '3031' },
})

pythonProcess.on('error', (err) => {
  console.error('Failed to start Python service:', err)
})

process.on('SIGTERM', () => {
  pythonProcess.kill()
  process.exit(0)
})
