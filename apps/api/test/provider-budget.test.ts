import assert from 'node:assert/strict'
import test from 'node:test'
import { NeopleBudget, NEOPLE_BUDGET } from '../src/characters/provider-budget.js'
import { createNeopleCharacterSearchForTest } from '../src/characters/neople-character-search.js'
import { createNeopleCharacterDetailsForTest } from '../src/characters/details/neople.js'
import { createNeopleCatalog } from '../src/characters/catalog/neople.js'
import { SearchAdmission } from '../src/characters/search-admission.js'

test('search, detail and catalog share a sliding provider budget, including failed calls', async () => {
  let now = 0
  const budget = new NeopleBudget(() => now)
  for (let i = 0; i < NEOPLE_BUDGET.calls - 1; i++) {
    await assert.rejects(
      budget.run(async () => {
        throw new Error('synthetic provider failure')
      })
    )
  }
  let calls = 0
  const transport: typeof fetch = async () => {
    calls++
    return Response.json({ rows: [] })
  }
  const search = createNeopleCharacterSearchForTest('fixture', { fetch: transport }, budget)
  const details = createNeopleCharacterDetailsForTest('fixture', { fetch: transport, budget })
  const catalog = createNeopleCatalog('fixture', transport, budget)
  const input = { characterName: '합성', serverId: 'siroco', limit: 10 }
  assert.deepEqual(await search(input), { rows: [] })
  await assert.rejects(
    details({ serverId: 'siroco', characterId: 'fixture' }, new AbortController().signal),
    { status: 429, retryAfter: 60 }
  )
  await assert.rejects(
    catalog([{ kind: 'item', itemId: 'fixture' }], new AbortController().signal),
    { status: 429 }
  )
  assert.equal(calls, 1)
  now = NEOPLE_BUDGET.windowMs - 1
  await assert.rejects(search(input), { status: 429, retryAfter: 1 })
  now++
  await search(input)
  assert.equal(calls, 2)
})

test('provider concurrency remains occupied while response bodies are pending, then recovers', async () => {
  const budget = new NeopleBudget()
  let calls = 0
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const transport: typeof fetch = async () => {
    calls++
    return new Response(
      new ReadableStream({
        async start(controller) {
          await gate
          controller.enqueue(new TextEncoder().encode('{"rows":[]}'))
          controller.close()
        }
      })
    )
  }
  const search = createNeopleCharacterSearchForTest('fixture', { fetch: transport }, budget)
  const input = { characterName: '합성', serverId: 'siroco', limit: 10 }
  const pending = Array.from({ length: NEOPLE_BUDGET.concurrent }, () => search(input))
  try {
    await assert.rejects(search(input), { status: 429, retryAfter: 1 })
    assert.equal(calls, NEOPLE_BUDGET.concurrent)
  } finally {
    release()
  }
  await Promise.all(pending)
  await search(input)
  assert.equal(calls, NEOPLE_BUDGET.concurrent + 1)
})

test('IPv6 representations and rotating addresses in the same /64 share admission; mapped IPv4 is canonical', async () => {
  const admission = new SearchAdmission()
  const reserve = async (ip: string) => {
    const lease = await admission.acquire(ip, new AbortController().signal)
    try {
      lease.reserve()
    } finally {
      lease.release()
    }
  }
  try {
    for (let i = 1; i <= 10; i++) {
      await reserve(`2001:db8:1:2::${i}`)
    }
    await assert.rejects(reserve('2001:0db8:0001:0002:0:0:0:ffff'), { status: 429 })
    await reserve('2001:db8:1:3::1')
    for (let i = 0; i < 10; i++) {
      await reserve(i % 2 ? '192.0.2.1' : '::ffff:192.0.2.1')
    }
    await assert.rejects(reserve('192.0.2.1'), { status: 429 })
  } finally {
    admission.close()
  }
})
