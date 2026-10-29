import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import type { Server } from 'node:http'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { Controller, Get, Injectable } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { createApiHttpApp } from '../src/http.js'
import type { SearchCharacters } from '../src/types/neople-character-search.js'

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

const unusedSearchCharacters: SearchCharacters = async () => {
  throw new Error('app lifecycle test must not search Neople characters')
}

test('createApiHttpApp은 listen 전에는 port를 열지 않고 close 뒤 port를 닫는다', async () => {
  const app = await createApiHttpApp({ searchCharacters: unusedSearchCharacters })
  const server = app.getHttpServer() as Server

  assert.equal(server.listening, false)
  try {
    await app.listen(0, '127.0.0.1')
    assert.equal(server.listening, true)
  } finally {
    await app.close()
  }
  assert.equal(server.listening, false)
})

test('test module route는 listen 후 생성자로 주입한 provider의 응답을 HTTP로 제공한다', async () => {
  assert.deepEqual(Reflect.getMetadata('design:paramtypes', TestController), [GreetingService])
  const testingModule = await Test.createTestingModule({
    controllers: [TestController],
    providers: [GreetingService]
  }).compile()
  const app = testingModule.createNestApplication()

  try {
    await app.listen(0, '127.0.0.1')
    const address = (app.getHttpServer() as Server).address()
    assert(address !== null && typeof address !== 'string')
    const response = await fetch(`http://127.0.0.1:${address.port}/test`)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'hello')
  } finally {
    await app.close()
  }
})

test('Nest 테스트 container는 provider를 교체한다', async () => {
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

test('compiled main은 잘못된 필수 설정을 거절하고 정제된 문구로 종료한다', async (t) => {
  // 실제 환경, credential은 상속하지 않고 합성 입력만 전달한다.
  const environment: NodeJS.ProcessEnv = {
    PORT: '3000',
    NEOPLE_API_KEY: 'synthetic-private-api-key'
  }
  const cases = [
    { name: 'PORT 누락', change: { PORT: undefined } },
    { name: 'PORT 빈 값', change: { PORT: '' } },
    { name: 'PORT 비십진 입력', change: { PORT: '30.00' } },
    { name: 'Neople key 누락', change: { NEOPLE_API_KEY: undefined } },
    { name: 'Neople key 빈 값', change: { NEOPLE_API_KEY: '' } },
    { name: 'Neople key 공백', change: { NEOPLE_API_KEY: ' \n' } },
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
    })
  }
})
