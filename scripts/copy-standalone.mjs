import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const standalone = join(root, '.next', 'standalone')
const staticSrc = join(root, '.next', 'static')
const staticDst = join(standalone, '.next', 'static')
const publicSrc = join(root, 'public')
const publicDst = join(standalone, 'public')

if (!existsSync(standalone)) {
  console.error('Missing .next/standalone — run next build first')
  process.exit(1)
}

mkdirSync(join(standalone, '.next'), { recursive: true })
cpSync(staticSrc, staticDst, { recursive: true })
if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDst, { recursive: true })
}
console.log('Copied static assets into standalone output')
