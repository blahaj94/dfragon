import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import electron from 'electron'
import { resolveConfig } from 'electron-vite'
import { createServer } from 'vite'

const { config } = await resolveConfig({ mode: 'mvp-preview' }, 'serve')
if (config?.renderer == null) {
  throw new Error('MVP renderer configuration is missing')
}
const server = await createServer({
  ...config.renderer,
  configFile: false,
  server: { host: '127.0.0.1' }
})

try {
  await server.listen()
  const rendererUrl = server.resolvedUrls?.local[0]
  if (rendererUrl == null) {
    throw new Error('MVP renderer server did not start')
  }
  const child = spawn(
    electron,
    [fileURLToPath(new URL('./ui-fixture.mjs', import.meta.url)), 'mvp', 'system'],
    { stdio: 'inherit', env: { ...process.env, LDB_MVP_RENDERER_URL: rendererUrl } }
  )
  process.once('SIGINT', () => child.kill('SIGINT'))
  process.once('SIGTERM', () => child.kill('SIGTERM'))
  const [code] = await once(child, 'exit')
  process.exitCode = code ?? 0
} finally {
  await server.close()
}
