import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { createCharacterDetailService } from '../src/characters/details/service.js'
import { characterFreshness } from '../src/characters/details/freshness.js'
import { CharacterDetailFailure } from '../src/characters/details/errors.js'
import { characterDetailSections } from '../src/characters/details/sections.js'
import type { CharacterPayloads } from '../src/characters/details/sections.js'

const identity = { serverId: 'siroco', characterId: 'refresh-fixture' }
const signal = new AbortController().signal
const common = { ...identity, characterName: '합성 캐릭터', jobId: 'job' }
const payloads: CharacterPayloads = {
  basic: { ...common },
  status: { ...common, status: [], buff: [] },
  equipment: { ...common, equipment: [], setItemInfo: [] },
  avatar: { ...common, avatar: [] },
  creature: { ...common, creature: null },
  oath: { ...common, oath: null },
  mist_assimilation: { ...common, mistAssimilation: null },
  skill_style: { ...common, skill: { style: { active: [] } } },
  buff_equipment: { ...common, skill: { buff: null } },
  buff_avatar: { ...common, skill: { buff: null } },
  buff_creature: { ...common, skill: { buff: null } }
}

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })

  return { promise, release }
}

test('끝난 요청을 재사용하지 않고 매번 Neople에서 받으며 freshness는 조회 시각 + 5분이다', async (t) => {
  let calls = 0
  const service = createCharacterDetailService({
    fetchDetails: async () => {
      calls++

      return payloads
    }
  })
  t.after(() => service.onModuleDestroy())

  const before = Date.now()
  const first = await service.get('192.0.2.1', identity, signal)
  await service.get('192.0.2.1', identity, signal)
  const after = Date.now()

  assert.equal(calls, 2)
  assert.equal(first.character.characterName, '합성 캐릭터')
  const fetchedAt = Date.parse(first.freshness.lastSuccessfulFetchAt)
  assert.ok(before <= fetchedAt && fetchedAt <= after)
  assert.equal(Date.parse(first.freshness.expiresAt), fetchedAt + 300_000)
  for (const section of characterDetailSections) {
    assert.deepEqual(first.sections[section], {
      revision: 1,
      contentUpdatedAt: first.freshness.lastSuccessfulFetchAt,
      lastSuccessfulFetchAt: first.freshness.lastSuccessfulFetchAt
    })
  }
})

test('11개 섹션이 모두 없으면 freshness를 만들지 않는다', () => {
  assert.equal(characterFreshness([]), null)
})

test('겹친 요청은 작업을 공유하고 한 대기자의 연결 종료는 다른 대기자를 취소하지 않는다', async (t) => {
  const entered = gate(),
    finish = gate()
  let calls = 0,
    sharedSignal: AbortSignal | undefined
  const service = createCharacterDetailService({
    fetchDetails: async (_identity, s) => {
      calls++
      sharedSignal = s
      entered.release()
      await finish.promise

      return payloads
    }
  })
  t.after(async () => {
    finish.release()
    await service.onModuleDestroy()
  })
  const disconnected = new AbortController()
  const first = service.get('192.0.2.1', identity, disconnected.signal)
  const rejection = assert.rejects(first)
  await entered.promise
  const second = service.get('192.0.2.2', identity, signal)
  void second.catch(() => undefined)
  await nextTurn()
  disconnected.abort()
  await rejection
  assert.equal(sharedSignal!.aborted, false)
  finish.release()
  assert.equal((await second).character.characterName, '합성 캐릭터')
  assert.equal(calls, 1)
})

test('마지막 대기자가 취소하면 공유 작업을 취소하고 새 요청은 독립 조회한다', async (t) => {
  const entered = gate(),
    late = gate()
  let calls = 0,
    abortedSignal: AbortSignal | undefined
  const service = createCharacterDetailService({
    fetchDetails: async (_identity, s) => {
      calls++
      if (calls === 1) {
        abortedSignal = s
        entered.release()
        await late.promise
      }

      return payloads
    }
  })
  t.after(async () => {
    late.release()
    await service.onModuleDestroy()
  })
  const controller = new AbortController(),
    first = service.get('192.0.2.1', identity, controller.signal),
    rejected = assert.rejects(first)
  await entered.promise
  controller.abort()
  await rejected
  assert.equal(abortedSignal!.aborted, true)
  await service.get('192.0.2.1', identity, signal)
  assert.equal(calls, 2)
})

test('공유 조회 실패 뒤 새 요청을 허용하고 서버 종료는 취소된 작업 정리를 기다린다', async (t) => {
  const entered = gate(),
    finish = gate()
  let calls = 0
  const service = createCharacterDetailService({
    fetchDetails: async () => {
      calls++
      entered.release()
      await finish.promise
      throw new CharacterDetailFailure('unavailable')
    }
  })
  t.after(() => service.onModuleDestroy())
  const first = service.get('one', identity, signal),
    second = service.get('two', identity, signal)
  const failures = Promise.all([
    assert.rejects(first, { status: 503 }),
    assert.rejects(second, { status: 503 })
  ])
  await entered.promise
  finish.release()
  await failures
  assert.equal(calls, 1)
  await assert.rejects(service.get('one', identity, signal), { status: 503 })
  assert.equal(calls, 2)

  const start = gate(),
    cleanup = gate(),
    stopped = new AbortController()
  const shutting = createCharacterDetailService({
    fetchDetails: async (_identity, s) => {
      start.release()
      s.addEventListener('abort', () => stopped.abort(), { once: true })
      await cleanup.promise

      return payloads
    }
  })
  const pending = shutting.get('three', identity, signal),
    rejected = assert.rejects(pending)
  await start.promise
  let closed = false
  const closing = shutting.onModuleDestroy().then(() => {
    closed = true
  })
  await rejected
  assert.equal(stopped.signal.aborted, true)
  assert.equal(closed, false)
  cleanup.release()
  await closing
})

test('상세 응답은 기존 필드에 card를 더하고 서버 내 순위는 null이다', async (t) => {
  const service = createCharacterDetailService({ fetchDetails: async () => payloads })
  t.after(() => service.onModuleDestroy())

  const result = await service.get('192.0.2.1', identity, signal)

  assert.equal(result.card.serverRank, null)
  assert.equal(result.card.investment.length, 12)
  const { card: _card, ...rest } = result
  assert.deepEqual(
    Object.keys(rest).sort(),
    [
      'avatar',
      'buff',
      'character',
      'creature',
      'equipment',
      'freshness',
      'mistAssimilation',
      'oath',
      'sections',
      'skillStyle',
      'status'
    ].sort()
  )
})
