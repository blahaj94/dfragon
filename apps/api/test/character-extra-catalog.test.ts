import assert from 'node:assert/strict'
import test from 'node:test'
import { enrichCharacterDetails } from '../src/characters/catalog/enrich.js'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { createNeopleCatalog } from '../src/characters/catalog/neople.js'
import { catalogKey, unavailableDetail } from '../src/characters/catalog/types.js'
import type {
  CatalogDetail,
  CatalogEntry,
  CatalogKey,
  CatalogValue
} from '../src/characters/catalog/types.js'
import type { CatalogService } from '../src/characters/catalog/service.js'
import type { CatalogStore } from '../src/characters/catalog/store.js'
import type { projectCharacterDetails } from '../src/characters/details/project.js'

const signal = new AbortController().signal
const item: CatalogKey = { kind: 'item', itemId: 'item-a' }
const set: CatalogKey = { kind: 'set', setItemId: 'set-a' }
function memoryStore() {
  const rows = new Map<string, CatalogEntry>()
  const store: CatalogStore = {
    async read(keys) {
      const entries = keys.flatMap((key) => {
        const entry = rows.get(catalogKey(key))
        if (entry != null) {
          return entry
        }

        return []
      })
      const now = new Date()
      const requestedAt = new Date().toISOString()

      return { entries, now, requestedAt }
    },
    async saveAndRead(values) {
      const entries = values.map((value) => {
        const snapshot = { ...value }
        const fetchedAt = new Date()
        const expiresAt = new Date(Date.now() + 86_400_000)

        return { ...snapshot, fetchedAt, expiresAt }
      })
      for (const entry of entries) {
        rows.set(catalogKey(entry.key), entry)
      }
      const now = new Date()

      return { entries, now }
    }
  }

  return { store, rows }
}

test('set adapter matches IDs independently of order and rejects missing, duplicate and mixed keys', async () => {
  const adapter = createNeopleCatalog('fixture-key', async (input, options) => {
    const url = new URL(String(input))
    assert.equal(url.pathname, '/df/multi/setitems')
    assert.equal(url.searchParams.get('setItemIds'), 'set-a,set-b,set-missing')
    assert.equal(url.searchParams.has('apikey'), false)
    assert.equal((options?.headers as Record<string, string>).apikey, 'fixture-key')

    return Response.json({
      rows: [
        { setItemId: 'set-b', setItemName: '중복' },
        { setItemId: 'set-a', setItemName: '세트', setItemOption: [{ future: true, status: [] }] },
        { setItemId: 'set-b', setItemName: '중복' },
        { setItemId: 'unrequested', setItemName: '다른 세트' }
      ]
    })
  })
  const result = await adapter(
    [set, { kind: 'set', setItemId: 'set-b' }, { kind: 'set', setItemId: 'set-missing' }],
    signal
  )
  assert.equal(result.length, 1)
  assert.deepEqual(result[0]!.key, set)
  assert.deepEqual(result[0]!.payload.setItemOption, [{ future: true, status: [] }])
  await assert.rejects(adapter([item, set], signal), /Invalid catalog batch/)
  await assert.rejects(
    adapter([{ kind: 'set', setItemId: 'bad/path' }], signal),
    /Invalid catalog request/
  )
})

test('discovers sets only from stored item data, reuses both caches and never traverses set members', async () => {
  const { store, rows } = memoryStore()
  const calls: CatalogKey[][] = []
  const service = createCatalogService(store, async (keys) => {
    calls.push(keys)

    return keys.map((key) => {
      const payload =
        key.kind === 'item'
          ? { setItemId: 'set-a' }
          : { setItems: [{ itemId: 'unworn-item' }], setItemId: 'set-a', setItemOption: [] }

      return { key, payload }
    })
  })
  const loaded = await service.load([item, item], signal)
  assert.equal(loaded.get(catalogKey(set))!.status, 'fresh')
  assert.deepEqual(calls, [[item], [set]])
  assert.equal(rows.size, 2)
  await service.load([item], signal)
  assert.equal(calls.length, 2)
  rows.get(catalogKey(set))!.expiresAt = new Date(0)
  const failed = createCatalogService(store, async () => {
    throw new Error('failed')
  })
  const stale = await failed.load([item], signal)
  assert.equal(stale.get(catalogKey(set))!.status, 'stale')
  assert.deepEqual(stale.get(catalogKey(set))!.data, loaded.get(catalogKey(set))!.data)

  const broken = memoryStore().store
  broken.saveAndRead = async () => {
    throw new Error('commit failed')
  }
  let attempts = 0
  const uncommitted = createCatalogService(broken, async (keys) => {
    attempts++

    return keys.map((key) => ({ key, payload: { setItemId: 'uncommitted-set' } }))
  })
  assert.equal((await uncommitted.load([item], signal)).has('set:uncommitted-set'), false)
  assert.equal(attempts, 1)
})

test('discovered sets share the 128-reference cap and the same deadline with initial work', async () => {
  const { store } = memoryStore()
  const requested: CatalogKey[] = []
  const signals: AbortSignal[] = []
  const service = createCatalogService(store, async (keys, deadline) => {
    requested.push(...keys)
    signals.push(deadline)

    return keys.map((key) => {
      if (key.kind === 'item') {
        const setItemId = 'set-' + key.itemId

        return { key, payload: { setItemId } }
      }

      return { key, payload: {} }
    })
  })
  const keys: CatalogKey[] = Array.from({ length: 127 }, (_, i) => {
    const itemId = 'item-' + i

    return { kind: 'item', itemId }
  })
  const result = await service.load(keys, signal)
  assert.equal(requested.length, 128)
  assert.equal(requested.filter((key) => key.kind === 'set').length, 1)
  assert.equal(
    [...result].filter(([key, detail]) => key.startsWith('set:') && detail.status === 'unavailable')
      .length,
    126
  )
  assert(signals.every((value) => value === signals[0]))

  const controller = new AbortController()
  const stopping = createCatalogService(memoryStore().store, async (keys) => {
    if (keys[0]?.kind === 'set') {
      controller.abort()
    }

    return keys.map((key) => ({ key, payload: { setItemId: 'set-a' } }))
  })
  await assert.rejects(stopping.load([item], controller.signal))
})

function fixture(): ReturnType<typeof projectCharacterDetails> {
  const avatar = {
    itemId: 'avatar',
    optionAbility: '선택한 스킬 +1',
    clone: { itemId: 'appearance' },
    emblems: [{ slotNo: 1, itemId: 'emblem' }, { slotNo: 2 }],
    future: { retained: true }
  }

  return {
    character: { jobId: 'job' },
    status: { status: [], buff: [] },
    equipment: {
      equipment: [{ itemId: 'equipment', tune: { level: 3 } }],
      setItemInfo: [{ setItemId: 'equipped-set', active: { setPoint: { current: 2800 } } }]
    },
    avatar: [avatar],
    creature: {
      itemId: 'creature',
      clone: { itemId: null, itemName: null },
      artifact: [{ itemId: 'artifact', slotColor: 'RED' }]
    },
    oath: {
      info: { itemId: 'oath', oathUpgrade: null },
      crystal: [
        { itemId: 'crystal', slotNo: 0, tune: { level: 3, setPoint: 195 } },
        { itemId: 'crystal', slotNo: 1 }
      ],
      setInfo: { setId: 16201, active: { status: [{ key: '버프력', value: 100 }] } }
    },
    mistAssimilation: { level: 1 },
    skillStyle: { style: { active: [] } },
    buff: {
      equipment: { equipment: [{ itemId: 'equipment' }] },
      avatar: { avatar: [avatar] },
      creature: { creature: [{ itemId: 'buff-creature', enchant: { reinforceSkill: [] } }] }
    },
    sections: {}
  }
}

test('all equipped attachments are enriched without changing originals, empty slots, or oath set identity', async () => {
  const details = fixture(),
    original = structuredClone(details),
    calls: CatalogKey[] = []
  const service = createCatalogService(memoryStore().store, async (keys) => {
    calls.push(...keys)

    return keys.map((key): CatalogValue => {
      const setItemId = key.kind === 'item' ? 'shared-set' : 'unused-set'

      return { key, payload: { setItemId, tune: [{ level: 0, setPoint: 165 }] } }
    })
  })
  const result = await enrichCharacterDetails(details, service, signal)
  assert.deepEqual(details, original)
  assert.equal(calls.filter((key) => key.kind === 'item').length, 9)
  assert.deepEqual(
    calls
      .filter((key) => key.kind === 'set')
      .map((key) => key.setItemId)
      .sort(),
    ['equipped-set', 'shared-set']
  )
  assert.deepEqual(Object.keys(result.setDetails).sort(), ['equipped-set', 'shared-set'])
  const output = JSON.parse(JSON.stringify(result))
  const paths = [
    output.equipment.equipment[0],
    output.avatar[0],
    output.avatar[0].clone,
    output.avatar[0].emblems[0],
    output.creature,
    output.creature.artifact[0],
    output.oath.info,
    output.oath.crystal[0],
    output.oath.crystal[1],
    output.buff.equipment.equipment[0],
    output.buff.avatar.avatar[0],
    output.buff.creature.creature[0]
  ]
  assert(paths.every((value) => value.itemDetail.status === 'fresh'))
  assert.deepEqual(output.avatar[0].emblems[1], { slotNo: 2 })
  assert.deepEqual(output.creature.clone, { itemId: null, itemName: null })
  assert.equal(output.avatar[0].optionAbility, '선택한 스킬 +1')
  assert.deepEqual(output.oath.crystal[0].tune, { level: 3, setPoint: 195 })
  assert.deepEqual(output.oath.setInfo, (details.oath as Record<string, unknown>).setInfo)
  assert.deepEqual(output.buff.creature.creature[0].enchant, { reinforceSkill: [] })
})

test('null and empty arrays survive optional detail failures without synthesizing equipment', async () => {
  for (const value of [null, []]) {
    const details = fixture()
    details.avatar = value
    details.creature = null
    details.oath = null
    details.buff.avatar = { avatar: value }
    details.buff.creature = { creature: value }
    const service = createCatalogService(memoryStore().store, async () => {
      throw new Error('failure')
    })
    const result = await enrichCharacterDetails(details, service, signal)
    assert.deepEqual(result.avatar, value)
    assert.equal(result.creature, null)
    assert.equal(result.oath, null)
    assert.deepEqual(result.buff.avatar, { avatar: value })
    assert.deepEqual(result.buff.creature, { creature: value })
    assert.equal(result.setDetails['equipped-set']!.status, 'unavailable')
  }
})

test('enrichment preserves reference order, item duplicates and guarded first-occurrence skill IDs', async () => {
  const details = fixture()
  details.equipment = {
    equipment: [
      { itemId: 'shared', setItemId: 'shared-set' },
      { itemId: '', setItemId: 'bad/set' },
      null,
      { itemId: 'shared' }
    ],
    setItemInfo: [null, [], { setItemId: '' }, { setItemId: 'equipped-set' }]
  }
  details.avatar = null
  details.creature = null
  details.oath = null
  details.skillStyle = {
    hash: 'opaque',
    style: {
      active: [null, [], { skillId: '' }, { skillId: 'skill-a' }, { skillId: 'skill-a' }],
      passive: [{ skillId: 'skill-b' }],
      evolution: [{ skillId: 'skill-a' }],
      enhancement: 'invalid',
      chain: { resetTime: 0, skills: [null, 'skill-b', 'skill-c', '', 'bad/id', 5] }
    }
  }
  details.buff = {
    equipment: {
      equipment: [{ itemId: 'buff', setItemId: 'shared-set' }],
      skillInfo: { skillId: 'skill-c' }
    },
    avatar: { avatar: null, skillInfo: { skillId: 'skill-d' } },
    creature: { creature: null, skillInfo: [] }
  }
  const original = structuredClone(details)
  const requests: CatalogKey[][] = []
  const catalog: CatalogService = {
    async load(keys, requestSignal) {
      assert.equal(requestSignal, signal)
      requests.push(keys)

      return new Map()
    }
  }

  const result = await enrichCharacterDetails(details, catalog, signal)

  assert.deepEqual(requests, [
    [
      { kind: 'item', itemId: 'buff' },
      { kind: 'set', setItemId: 'shared-set' },
      { kind: 'item', itemId: 'shared' },
      { kind: 'set', setItemId: 'shared-set' },
      { kind: 'item', itemId: 'shared' },
      { kind: 'set', setItemId: 'equipped-set' },
      { kind: 'skill', jobId: 'job', skillId: 'skill-a' },
      { kind: 'skill', jobId: 'job', skillId: 'skill-b' },
      { kind: 'skill', jobId: 'job', skillId: 'skill-c' },
      { kind: 'skill', jobId: 'job', skillId: 'skill-d' }
    ]
  ])
  const skillStyle = result.skillStyle as Record<string, unknown>
  assert.deepEqual(Object.keys(skillStyle.skillDetails as object), [
    'skill-a',
    'skill-b',
    'skill-c',
    'skill-d'
  ])
  assert.equal(skillStyle.style, (details.skillStyle as Record<string, unknown>).style)
  assert.deepEqual(details, original)
})

test('catalog dictionaries preserve reserved ID keys, detail identity and invalid-job fallbacks', async () => {
  const detail: CatalogDetail = { data: { retained: true }, fetchedAt: null, status: 'stale' }
  for (const jobId of ['job', '', null, undefined]) {
    const details = fixture()
    details.character.jobId = jobId
    details.skillStyle = {
      style: {
        active: [{ skillId: '__proto__' }, { skillId: 'constructor' }, { skillId: 'missing' }]
      }
    }
    const loaded = new Map<string, CatalogDetail>([
      ['set:__proto__', detail],
      ['item:equipment', detail],
      ['set:constructor', unavailableDetail],
      ['skill:job:__proto__', detail],
      ['skill:job:constructor', detail],
      ['other:ignored', detail]
    ])
    const reads: string[] = []
    const get = loaded.get.bind(loaded)
    loaded.get = (key) => {
      reads.push(key)

      return get(key)
    }
    let calls = 0
    const catalog: CatalogService = {
      async load(keys, requestSignal) {
        calls++
        assert.equal(requestSignal, signal)
        const requested = keys.filter((key) => key.kind === 'skill')
        const expected =
          jobId === 'job'
            ? [
                { kind: 'skill', jobId, skillId: '__proto__' },
                { kind: 'skill', jobId, skillId: 'constructor' },
                { kind: 'skill', jobId, skillId: 'missing' }
              ]
            : []
        assert.deepEqual(requested, expected)

        return loaded
      }
    }

    const result = await enrichCharacterDetails(details, catalog, signal)

    assert.equal(calls, 1)
    assert.deepEqual(Object.keys(result.setDetails), ['__proto__', 'constructor'])
    assert.equal(Object.getPrototypeOf(result.setDetails), Object.prototype)
    assert.equal(result.setDetails.__proto__, detail)
    assert.equal(result.setDetails.constructor, unavailableDetail)
    const skillDetails = (result.skillStyle as { skillDetails: Record<string, CatalogDetail> })
      .skillDetails
    assert.deepEqual(Object.keys(skillDetails), ['__proto__', 'constructor', 'missing'])
    assert.equal(Object.getPrototypeOf(skillDetails), Object.prototype)
    assert.equal(skillDetails.__proto__, jobId === 'job' ? detail : unavailableDetail)
    assert.equal(skillDetails.constructor, jobId === 'job' ? detail : unavailableDetail)
    assert.equal(skillDetails.missing, unavailableDetail)
    const expectedReads =
      jobId === 'job' ? ['skill:job:__proto__', 'skill:job:constructor', 'skill:job:missing'] : []
    assert.deepEqual(
      reads.filter((key) => key.startsWith('skill:')),
      expectedReads
    )
    const equipment = result.equipment.equipment as Array<{ itemDetail: CatalogDetail }>
    assert.equal(equipment[0]!.itemDetail, detail)
  }
})

test('enrichment keeps live skill traversal and reads item options before catalog lookups', async () => {
  const events: string[] = []
  const active: Array<{ skillId: string }> = [
    {
      get skillId() {
        events.push('first-skill')
        if (active.length === 1) {
          active.push({ skillId: 'second' })
        }

        return 'first'
      }
    }
  ]
  const details = fixture()
  details.equipment = {
    equipment: [
      {
        itemId: 'item',
        get option() {
          events.push('item-option')

          return 'retained'
        }
      }
    ],
    setItemInfo: []
  }
  details.avatar = null
  details.creature = null
  details.oath = null
  details.buff = { equipment: null, avatar: null, creature: null }
  details.skillStyle = { style: { active } }
  const loaded = new Map<string, CatalogDetail>()
  loaded.get = (key) => {
    events.push(`lookup:${key}`)

    return undefined
  }
  const catalog: CatalogService = {
    async load(keys) {
      events.push('load')
      assert.deepEqual(keys, [
        { kind: 'item', itemId: 'item' },
        { kind: 'skill', jobId: 'job', skillId: 'first' },
        { kind: 'skill', jobId: 'job', skillId: 'second' }
      ])

      return loaded
    }
  }

  const result = await enrichCharacterDetails(details, catalog, signal)

  assert.deepEqual(events, [
    'item-option',
    'first-skill',
    'first-skill',
    'load',
    'item-option',
    'lookup:item:item',
    'lookup:skill:job:first',
    'lookup:skill:job:second'
  ])
  const equipment = result.equipment.equipment as Array<Record<string, unknown>>
  assert.equal(equipment[0]!.option, 'retained')
})
