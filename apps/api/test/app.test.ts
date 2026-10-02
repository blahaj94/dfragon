import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import type { Server } from 'node:http'
import { createServer } from 'node:net'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { Controller, Get, Injectable, Module } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { closeApp, createApp } from '../src/app.js'

@Injectable()
class GreetingService {
  message(): string {
    return 'hello'
  }
}

@Controller()
class TestController {
  constructor(private readonly greetingService: GreetingService) {}

  @Get('test')
  getMessage(): string {
    return this.greetingService.message()
  }
}

@Module({ controllers: [TestController], providers: [GreetingService] })
class TestModule {}

let app: INestApplication
let baseUrl: string

before(async () => {
  app = await createApp(TestModule)
  assert.equal((app.getHttpServer() as Server).listening, false)
  await app.listen(0, '127.0.0.1')
  const server = app.getHttpServer() as Server
  const address = server.address()
  const isAddressMissing = address == null
  assert(!isAddressMissing)
  const isAddressEmpty = address === ''
  assert(!isAddressEmpty)
  const isAddressObject = typeof address !== 'string'
  assert(isAddressObject)
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  const server = app.getHttpServer() as Server
  await app.close()
  assert.equal(server.listening, false)
})

test('Nest 테스트 container는 생성자 metadata로 주입하고 provider를 교체한다', async () => {
  assert.deepEqual(Reflect.getMetadata('design:paramtypes', TestController), [GreetingService])
  const testingModule = await Test.createTestingModule({
    controllers: [TestController],
    providers: [GreetingService]
  })
    .overrideProvider(GreetingService)
    .useValue({ message: () => 'overridden' })
    .compile()

  try {
    assert.equal(testingModule.get(TestController).getMessage(), 'overridden')
  } finally {
    await testingModule.close()
  }
})

test('앱 factory는 listen 후 실제 HTTP 응답을 제공한다', async () => {
  const response = await fetch(`${baseUrl}/test`)

  assert.equal(response.status, 200)
  assert.equal(await response.text(), 'hello')
})

test('종료 실패는 예외 원문을 출력하지 않고 고정 문구와 실패 exitCode를 남긴다', async (t) => {
  const localApp = await createApp(TestModule)
  const exitCode = process.exitCode
  const logged = t.mock.method(console, 'error', () => undefined)
  const mockedClose = t.mock.method(localApp, 'close', async () => {
    throw new Error('synthetic-private-credential')
  })
  try {
    await closeApp(localApp)
    assert.equal(process.exitCode, 1)
    assert.deepEqual(
      logged.mock.calls.map(({ arguments: args }) => args),
      [['API failed to start']]
    )
  } finally {
    process.exitCode = exitCode
    mockedClose.mock.restore()
    await localApp.close()
  }
})

test('compiled main은 잘못된 필수 설정을 DB 연결 전에 거절하고 정제된 문구로 종료한다', async (t) => {
  let connections = 0
  const database = createServer((socket) => {
    connections++
    socket.destroy()
  })
  t.after(
    () =>
      new Promise<void>((resolve, reject) => {
        database.close((error) => {
          if (error) {
            reject(error)

            return
          }
          resolve()
        })
      })
  )
  await new Promise<void>((resolve) => database.listen(0, '127.0.0.1', resolve))
  const address = database.address()
  assert(address != null && typeof address !== 'string')
  // 실제 환경·credential은 상속하지 않고 테스트가 만든 DB 접속 감시 주소만 전달한다.
  const environment: NodeJS.ProcessEnv = {
    PORT: '3000',
    DB_HOST: '127.0.0.1',
    DB_PORT: String(address.port),
    DB_USERNAME: 'synthetic',
    DB_PASSWORD: 'synthetic-private-database-password',
    DB_NAME: 'synthetic',
    NEOPLE_API_KEY: 'synthetic-private-api-key'
  }
  const cases = [
    { name: 'PORT 누락', change: { PORT: undefined } },
    { name: 'PORT 빈 값', change: { PORT: '' } },
    { name: 'PORT 비십진 입력', change: { PORT: '30.00' } },
    { name: 'DB 사용자 누락', change: { DB_USERNAME: undefined } },
    { name: 'Neople key 누락', change: { NEOPLE_API_KEY: undefined } },
    { name: '프록시 모드 오류', change: { SEARCH_TRUST_PROXY: 'unsafe-proxy' } },
    { name: 'TLS 파일 짝 누락', change: { LOCAL_HTTPS_CERT_FILE: '/missing/cert.pem' } }
  ]
  for (const { name, change } of cases) {
    await t.test(name, async () => {
      await assert.rejects(
        promisify(execFile)(
          process.execPath,
          [
            '--import',
            'reflect-metadata',
            fileURLToPath(new URL('../../dist/main.js', import.meta.url))
          ],
          {
            cwd: fileURLToPath(new URL('../../', import.meta.url)),
            env: { ...environment, ...change },
            timeout: 5000,
            killSignal: 'SIGKILL'
          }
        ),
        {
          code: 1,
          signal: null,
          stdout: '',
          stderr: 'API failed to start\n'
        }
      )
      assert.equal(connections, 0)
    })
  }
})
