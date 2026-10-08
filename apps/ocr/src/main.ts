import { mkdir, chmod } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { createOcrApp } from './server.js'
import { OcrStore } from './store.js'
import { parseSyntheticUploadTokenSha256 } from './auth.js'
import { parseTestUploadEnabled } from './test-capture.js'

function parseHttpsOrigin(value: string | undefined): string {
  const url = new URL(value ?? '')
  if (url.protocol !== 'https:' || url.origin !== value) {
    throw new Error('Invalid OCR configuration')
  }

  return value
}

const OCR_OWNER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

try {
  process.umask(0o077)
  const directory = process.env.OCR_DATA_DIR ?? ''
  const ownerId = process.env.OCR_OWNER_ID ?? ''
  const maximumBytes = Number(process.env.OCR_MAX_BYTES ?? 1073741824)
  const port = Number(process.env.PORT ?? 3100)
  const proxy = process.env.OCR_TRUST_PROXY
  if (
    !isAbsolute(directory) ||
    !OCR_OWNER_ID_PATTERN.test(ownerId) ||
    !Number.isSafeInteger(maximumBytes) ||
    maximumBytes < 16 * 1024 * 1024 ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    (proxy !== undefined && proxy !== 'single-hop')
  ) {
    throw new Error('Invalid OCR configuration')
  }
  const config = {
    origin: parseHttpsOrigin(process.env.OCR_ORIGIN),
    authOrigin: parseHttpsOrigin(process.env.OCR_AUTH_ORIGIN),
    ownerId,
    testUploadEnabled: parseTestUploadEnabled(process.env.OCR_TEST_UPLOAD_ENABLED),
    trustedProxyHops: proxy === 'single-hop' ? (1 as const) : undefined,
    syntheticUploadTokenSha256: parseSyntheticUploadTokenSha256(
      process.env.OCR_SYNTHETIC_UPLOAD_TOKEN_SHA256
    )
  }

  await mkdir(directory, { recursive: true, mode: 0o700 })
  const path = join(directory, 'ocr.sqlite')
  const store = new OcrStore(path, maximumBytes)
  await chmod(path, 0o600)

  const runtime = await createOcrApp(config, store)
  await runtime.app.listen(port, process.env.OCR_HOST ?? '127.0.0.1')
  const server = runtime.app.getHttpServer()
  process.stdout.write('OCR server ready\n')

  let stopping = false
  const close = () => {
    if (stopping) {
      return
    }
    stopping = true
    server.close(() => {
      void runtime.close().finally(() => {
        store.close()
      })
    })
    setTimeout(() => server.closeAllConnections(), 10_000).unref()
  }
  process.once('SIGINT', close)
  process.once('SIGTERM', close)
  server.on('error', () => {
    process.stderr.write('OCR server failed\n')
    close()
    process.exitCode = 1
  })
} catch {
  process.stderr.write('OCR startup failed; check configuration and storage\n')
  process.exitCode = 1
}
