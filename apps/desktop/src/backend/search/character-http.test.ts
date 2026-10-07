import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { crc32, deflateSync } from 'node:zlib'
import { PNG } from 'pngjs'
import { describe, expect, it, vi } from 'vitest'
import type { AuthClock } from '../auth/types'
import type { CharacterCandidate, CharacterDetails } from '../../preload/common/types/character'
import {
  CHARACTER_HTTP_LIMITS,
  createCharacterCandidatesHttp,
  createCharacterDetailsHttp,
  createCharacterImageHttp
} from './character-http'
import { SearchHttpFailure } from './http'

vi.mock('electron', () => ({ session: { fromPartition: vi.fn() } }))

const API_ORIGIN = 'https://api.example.test'
const IMAGE_URL = 'https://img-api.neople.co.kr/df/servers/cain/characters/character-1?zoom=1'
const identity = { serverId: 'cain', characterId: 'character-1' }
const candidate: CharacterCandidate = {
  ...identity,
  characterName: '가나',
  serverName: '카인',
  fame: 71000,
  imageUrl: IMAGE_URL
}

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers })
}

function signal(): AbortSignal {
  return new AbortController().signal
}

function pngChunk(type: string, payload: Buffer): Buffer {
  const bytes = Buffer.alloc(payload.length + 12)
  bytes.writeUInt32BE(payload.length, 0)
  bytes.write(type, 4, 'ascii')
  payload.copy(bytes, 8)
  bytes.writeUInt32BE(crc32(bytes.subarray(4, bytes.length - 4)), bytes.length - 4)

  return bytes
}

function detail(): CharacterDetails {
  const metadata = {
    revision: 1,
    contentUpdatedAt: '2026-10-07T00:00:00.000Z',
    lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z'
  }
  const character = {
    ...identity,
    characterName: '가나',
    serverName: '카인',
    level: 115,
    jobName: '귀검사(남)',
    jobGrowName: '眞 웨펀마스터',
    fame: null,
    adventureName: '모험단',
    guildName: null
  }
  const sections = {
    basic: metadata,
    status: metadata,
    equipment: metadata,
    avatar: metadata,
    creature: metadata,
    oath: metadata,
    mist_assimilation: metadata,
    skill_style: metadata,
    buff_equipment: metadata,
    buff_avatar: metadata,
    buff_creature: metadata
  }

  return {
    character,
    status: { status: [{ name: '힘', value: 100 }], buff: null },
    equipment: {
      equipment: [{ itemId: 'item-1', seasonOptions: [false, { value: 0 }] }],
      setItemInfo: []
    },
    avatar: null,
    creature: { itemId: 'creature-1' },
    oath: [],
    mistAssimilation: null,
    skillStyle: { skill: { active: [] } },
    buff: { equipment: null, avatar: [], creature: null },
    sections,
    freshness: {
      lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z',
      expiresAt: '2026-10-07T00:05:00.000Z'
    },
    setDetails: { 'set-1': { name: '세트', options: [] } }
  }
}

describe('OCR 후보 검색 HTTP', () => {
  it.each(['가', '😀'.repeat(12), '가+%가&나'])(
    '이름 %j를 바꾸지 않고 후보 경로 하나로 보낸다',
    async (nickname) => {
      const row = { ...candidate, characterName: nickname }
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json({ rows: [row] }))
      const read = createCharacterCandidatesHttp({ apiOrigin: API_ORIGIN, fetch })

      expect(await read({ nickname, signal: signal() })).toEqual([row])

      const request = new Request(...fetch.mock.calls[0])
      const url = new URL(request.url)
      expect(url.origin).toBe(API_ORIGIN)
      expect(url.pathname).toBe('/characters/candidates')
      expect([...url.searchParams]).toEqual([['characterName', nickname]])
      expect(request.method).toBe('GET')
      expect(request.headers.get('Authorization')).toBeNull()
      expect(request.headers.get('apikey')).toBeNull()
      expect(request.headers.get('Cookie')).toBeNull()
      expect(request.credentials).toBe('omit')
      expect(request.redirect).toBe('error')
      expect(request.cache).toBe('no-store')
    }
  )

  it.each(['', '가'.repeat(13), ' 가나', '가나 ', '가\ud800'])(
    '잘못된 이름 %j는 네트워크 호출 전에 거부한다',
    async (nickname) => {
      const fetch = vi.fn<typeof globalThis.fetch>()
      const read = createCharacterCandidatesHttp({ apiOrigin: API_ORIGIN, fetch })

      await expect(read({ nickname, signal: signal() })).rejects.toMatchObject({
        code: 'INVALID_SEARCH_QUERY'
      })
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it('명성이 같은 후보, 0, null의 서버 응답 순서를 보존하고 빈 결과도 허용한다', async () => {
    const rows = [71000, 71000, 0, null].map((fame, index) => {
      const characterId = `character-${index}`
      const imageUrl = `https://img-api.neople.co.kr/df/servers/cain/characters/${characterId}?zoom=1`

      return { ...candidate, characterId, fame, imageUrl }
    })
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json({ rows }))
      .mockResolvedValueOnce(json({ rows: [] }))
    const read = createCharacterCandidatesHttp({ apiOrigin: API_ORIGIN, fetch })

    expect(await read({ nickname: '가나', signal: signal() })).toEqual(rows)
    expect(await read({ nickname: '가나', signal: signal() })).toEqual([])
  })

  it.each([
    { characterName: '다른이름' },
    { serverId: 'all' },
    { serverName: '바칼' },
    { characterId: '../character-1' },
    { fame: '71000' },
    { fame: undefined },
    { imageUrl: 'https://unexpected.example/sprite.png' },
    { imageUrl: `${IMAGE_URL}&zoom=2` }
  ])('잘못된 후보 %j가 섞이면 부분 성공하지 않는다', async (fields) => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(json({ rows: [candidate, { ...candidate, ...fields }] }))
    const read = createCharacterCandidatesHttp({ apiOrigin: API_ORIGIN, fetch })

    await expect(read({ nickname: '가나', signal: signal() })).rejects.toMatchObject({
      code: 'SEARCH_RESPONSE_INVALID'
    })
  })

  it('후보 응답 본문을 크기 제한 안에서 읽고 초과 스트림은 취소한다', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(CHARACTER_HTTP_LIMITS.candidateJsonBytes + 1))
      },
      cancel
    })
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(body))
    const read = createCharacterCandidatesHttp({ apiOrigin: API_ORIGIN, fetch })

    await expect(read({ nickname: '가나', signal: signal() })).rejects.toMatchObject({
      code: 'SEARCH_RESPONSE_INVALID'
    })
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('고정 API origin 설정에 경로나 HTTP를 허용하지 않는다', () => {
    expect(() => createCharacterCandidatesHttp({ apiOrigin: `${API_ORIGIN}/path` })).toThrow()
    expect(() => createCharacterDetailsHttp({ apiOrigin: 'http://localhost:1234' })).toThrow()
  })
})

describe('캐릭터 상세 HTTP', () => {
  it('선택한 identity로만 요청하고 상세 섹션, null 명성, 계절별 JSON을 보존한다', async () => {
    const body = detail()
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json(body))
    const read = createCharacterDetailsHttp({ apiOrigin: API_ORIGIN, fetch })

    expect(await read({ ...identity, signal: signal() })).toEqual(body)
    const request = new Request(...fetch.mock.calls[0])
    expect(request.url).toBe(`${API_ORIGIN}/characters/cain/character-1`)
    expect(request.headers.get('Authorization')).toBeNull()
    expect(request.headers.get('apikey')).toBeNull()
  })

  it.each([{ serverId: 'bakal', serverName: '바칼' }, { characterId: 'character-2' }])(
    '응답의 다른 identity %j는 거부한다',
    async (fields) => {
      const body = detail()
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(json({ ...body, character: { ...body.character, ...fields } }))
      const read = createCharacterDetailsHttp({ apiOrigin: API_ORIGIN, fetch })

      await expect(read({ ...identity, signal: signal() })).rejects.toMatchObject({
        code: 'SEARCH_RESPONSE_INVALID'
      })
    }
  )

  it('필수 상세 섹션이 누락되면 성공으로 처리하지 않는다', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(json({ ...detail(), avatar: undefined }))
    const read = createCharacterDetailsHttp({ apiOrigin: API_ORIGIN, fetch })

    await expect(read({ ...identity, signal: signal() })).rejects.toMatchObject({
      code: 'SEARCH_RESPONSE_INVALID'
    })
  })

  it('상세 query 오류를 기존 검색 소비자의 오류 코드로 전달한다', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(json({ error: { code: 'INVALID_CHARACTER_QUERY' } }, 400))
    const read = createCharacterDetailsHttp({ apiOrigin: API_ORIGIN, fetch })

    await expect(read({ ...identity, signal: signal() })).rejects.toMatchObject({
      code: 'INVALID_SEARCH_QUERY'
    })
  })
})

describe('캐릭터 PNG HTTP', () => {
  it('고정 URL에서 PNG 전체 RGBA와 투명도를 읽고 인증 정보를 보내지 않는다', async () => {
    const png = new PNG({ width: 2, height: 1 })
    png.data.set([12, 24, 36, 255, 48, 60, 72, 0])
    const bytes = PNG.sync.write(png)
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/png' } })
      )
    const read = createCharacterImageHttp({ fetch })

    expect(await read({ ...identity, signal: signal() })).toEqual({
      width: 2,
      height: 1,
      rgba: new Uint8Array([12, 24, 36, 255, 48, 60, 72, 0])
    })
    const request = new Request(...fetch.mock.calls[0])
    expect(request.url).toBe(IMAGE_URL)
    expect(request.headers.get('Authorization')).toBeNull()
    expect(request.headers.get('apikey')).toBeNull()
    expect(request.credentials).toBe('omit')
    expect(request.redirect).toBe('error')
  })

  it.each([
    { serverId: 'all' },
    { characterId: '../other' },
    { characterId: 'x?zoom=2' },
    { characterId: 'character-1\n' }
  ])('지원하지 않는 이미지 identity %j는 호출 전에 거부한다', async (fields) => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    const read = createCharacterImageHttp({ fetch })

    await expect(read({ ...identity, ...fields, signal: signal() })).rejects.toMatchObject({
      code: 'INVALID_SEARCH_QUERY'
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['본문 한도 초과', '크기 한도 초과', '깨진 PNG', 'PNG가 아닌 응답'])(
    '%s는 비교 가능한 이미지로 반환하지 않는다',
    async (kind) => {
      let bytes = PNG.sync.write(new PNG({ width: 1, height: 1 }))
      let contentType = 'image/png'
      if (kind === '본문 한도 초과') {
        bytes = Buffer.alloc(CHARACTER_HTTP_LIMITS.imageBytes + 1)
      } else if (kind === '크기 한도 초과') {
        bytes.writeUInt32BE(CHARACTER_HTTP_LIMITS.imageDimension + 1, 16)
      } else if (kind === '깨진 PNG') {
        bytes = bytes.subarray(0, 35)
      } else {
        contentType = 'text/html'
      }
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(
          new Response(new Uint8Array(bytes), { headers: { 'Content-Type': contentType } })
        )
      const read = createCharacterImageHttp({ fetch })

      await expect(read({ ...identity, signal: signal() })).rejects.toMatchObject({
        code: 'SEARCH_RESPONSE_INVALID'
      })
    }
  )

  it('이미지 404를 빈 이미지나 불일치로 바꾸지 않는다', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 404 }))
    const read = createCharacterImageHttp({ fetch })

    await expect(read({ ...identity, signal: signal() })).rejects.toMatchObject({
      code: 'NEOPLE_API_ERROR'
    })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it.each(['중복 IHDR', '크기보다 큰 interlace 압축 데이터'])(
    '%s를 pngjs 디코더 전에 거부한다',
    async (kind) => {
      const original = PNG.sync.write(new PNG({ width: 1, height: 1 }))
      let bytes: Buffer
      if (kind === '중복 IHDR') {
        const other = PNG.sync.write(new PNG({ width: 2, height: 1 }))
        bytes = Buffer.concat([original.subarray(0, 33), other.subarray(8)])
      } else {
        const header = Buffer.from(original.subarray(16, 29))
        header[12] = 1
        bytes = Buffer.concat([
          original.subarray(0, 8),
          pngChunk('IHDR', header),
          pngChunk('IDAT', deflateSync(Buffer.alloc(1024))),
          pngChunk('IEND', Buffer.alloc(0))
        ])
      }
      const decode = vi.spyOn(PNG.sync, 'read')
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(
          new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/png' } })
        )
      const read = createCharacterImageHttp({ fetch })
      try {
        await expect(read({ ...identity, signal: signal() })).rejects.toMatchObject({
          code: 'SEARCH_RESPONSE_INVALID'
        })
        expect(decode).not.toHaveBeenCalled()
      } finally {
        decode.mockRestore()
      }
    }
  )
})

describe('캐릭터 통신 실패와 호출자 취소', () => {
  it.each(['candidates', 'details'] as const)(
    '%s의 호출 제한은 수신 시각과 Retry-After를 보존하고 재시도하지 않는다',
    async (kind) => {
      const code = kind === 'details' ? 'CHARACTER_RATE_LIMITED' : 'SEARCH_RATE_LIMITED'
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(json({ error: { code } }, 429, { 'Retry-After': '7' }))
      const clock: Pick<AuthClock, 'read'> = {
        read: () => ({ monotonicMs: 1234, wallMs: 5678, discontinuous: false })
      }
      const options = { apiOrigin: API_ORIGIN, fetch, clock }
      const request =
        kind === 'details'
          ? createCharacterDetailsHttp(options)({ ...identity, signal: signal() })
          : createCharacterCandidatesHttp(options)({ nickname: '가나', signal: signal() })

      await expect(request).rejects.toMatchObject({
        code: 'SEARCH_RATE_LIMITED',
        retryAfterSeconds: 7,
        retryAfterReceivedAt: 1234
      })
      expect(fetch).toHaveBeenCalledOnce()
    }
  )

  it('HTTP와 다른 오류 코드 또는 성공 body의 error는 잘못된 응답이다', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json({ error: { code: 'CHARACTER_RATE_LIMITED' } }, 429))
      .mockResolvedValueOnce(json({ rows: [candidate], error: { code: 'NEOPLE_API_ERROR' } }))
    const read = createCharacterCandidatesHttp({ apiOrigin: API_ORIGIN, fetch })

    await expect(read({ nickname: '가나', signal: signal() })).rejects.toMatchObject({
      code: 'SEARCH_RESPONSE_INVALID'
    })
    await expect(read({ nickname: '가나', signal: signal() })).rejects.toMatchObject({
      code: 'SEARCH_RESPONSE_INVALID'
    })
  })

  it.each(['잘못된 UTF-8', '깨진 JSON', '본문 연결 실패'])(
    '%s 실패를 응답 검증과 통신 오류로 구분한다',
    async (kind) => {
      let response: Response
      let code = 'SEARCH_RESPONSE_INVALID'
      if (kind === '잘못된 UTF-8') {
        response = new Response(new Uint8Array([255]))
      } else if (kind === '깨진 JSON') {
        response = new Response('{')
      } else {
        response = new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error('synthetic'))
            }
          })
        )
        code = 'SEARCH_NETWORK_ERROR'
      }
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response)
      const read = createCharacterCandidatesHttp({ apiOrigin: API_ORIGIN, fetch })

      await expect(read({ nickname: '가나', signal: signal() })).rejects.toMatchObject({ code })
    }
  )

  it.each(['candidates', 'image', 'details'] as const)(
    '%s의 멈춘 body를 호출자 신호로 취소한다',
    async (kind) => {
      const controller = new AbortController()
      const cancel = vi.fn()
      const pull = vi.fn()
      const body = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 })
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'image/png' } }))
      let request: Promise<unknown>
      if (kind === 'candidates') {
        request = createCharacterCandidatesHttp({ apiOrigin: API_ORIGIN, fetch })({
          nickname: '가나',
          signal: controller.signal
        })
      } else if (kind === 'image') {
        request = createCharacterImageHttp({ fetch })({ ...identity, signal: controller.signal })
      } else {
        request = createCharacterDetailsHttp({ apiOrigin: API_ORIGIN, fetch })({
          ...identity,
          signal: controller.signal
        })
      }
      const failure = expect(request).rejects.toMatchObject({ name: 'AbortError' })
      await vi.waitFor(() => expect(pull).toHaveBeenCalledOnce())
      controller.abort()

      await failure
      expect(cancel).toHaveBeenCalledOnce()
      expect(fetch).toHaveBeenCalledOnce()
    }
  )

  it('이미 취소한 호출은 새 단계의 네트워크 요청을 시작하지 않는다', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    const read = createCharacterImageHttp({ fetch })
    const controller = new AbortController()
    controller.abort()

    await expect(read({ ...identity, signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError'
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('실제 HTTP redirect를 따라가지 않고 503도 자동 재시도하지 않는다', async () => {
    const paths: string[] = []
    const server = createServer((request, response) => {
      paths.push(request.url ?? '')
      if (paths.length === 1) {
        response.writeHead(302, { Location: '/should-not-follow' }).end()
      } else {
        response.writeHead(503, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: { code: 'NEOPLE_UNAVAILABLE' } }))
      }
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as AddressInfo).port
    const transport: typeof globalThis.fetch = (input, init) => {
      const original = new Request(input, init)
      const url = new URL(original.url)
      const local = `http://127.0.0.1:${port}${url.pathname}${url.search}`

      return globalThis.fetch(new Request(local, original))
    }
    const read = createCharacterCandidatesHttp({ apiOrigin: API_ORIGIN, fetch: transport })
    try {
      await expect(read({ nickname: '가+나', signal: signal() })).rejects.toBeInstanceOf(
        SearchHttpFailure
      )
      await expect(read({ nickname: '가+나', signal: signal() })).rejects.toMatchObject({
        code: 'NEOPLE_UNAVAILABLE'
      })
      expect(paths).toEqual([
        '/characters/candidates?characterName=%EA%B0%80%2B%EB%82%98',
        '/characters/candidates?characterName=%EA%B0%80%2B%EB%82%98'
      ])
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
    }
  })
})
