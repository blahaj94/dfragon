import 'reflect-metadata'
import { createApiRuntime } from './runtime/application.js'
import { readRuntimeConfiguration } from './runtime/configuration.js'

const startupFailureMessage = 'API failed to start'

async function main(): Promise<void> {
  const configuration = await readRuntimeConfiguration(process.env)
  const app = await createApiRuntime(configuration)
  try {
    if (configuration.localHttps !== undefined) {
      await app.listen(configuration.port, '127.0.0.1')
    } else {
      await app.listen(configuration.port)
    }
  } catch (error) {
    await app.close()
    throw error
  }

  const shutdown = (): void => {
    // close가 열린 연결을 기다리며 끝나지 않으면 두 번째 signal은 Node 기본 동작으로 즉시 종료한다.
    process.off('SIGINT', shutdown)
    process.off('SIGTERM', shutdown)
    app.close().catch(() => {
      console.error(startupFailureMessage)
      process.exitCode = 1
    })
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

try {
  await main()
} catch {
  console.error(startupFailureMessage)
  process.exitCode = 1
}
