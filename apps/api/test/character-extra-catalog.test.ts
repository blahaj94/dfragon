import assert from 'node:assert/strict'
import test from 'node:test'
import { enrichCharacterDetails } from '../src/characters/catalog/enrich.js'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { createNeopleCatalog } from '../src/characters/catalog/neople.js'
import { catalogKey } from '../src/characters/catalog/types.js'
import type {
  CatalogDetail,
  CatalogEntry,
  CatalogKey,
  CatalogValue
} from '../src/characters/catalog/types.js'
import type { CatalogStore } from '../src/characters/catalog/store.js'
import type { projectCharacterDetails } from '../src/characters/details/project.js'

const signal = new AbortController().signal
const item: CatalogKey = { kind: 'item', itemId: 'item-a' }
const set: CatalogKey = { kind: 'set', setItemId: 'set-a' }
function catalogPayload(key: CatalogKey) {
  if (key.kind === 'item') {
    const itemId = key.itemId
    const itemName = '합성 아이템 ' + itemId

    return { itemId, itemName }
  }

  if (key.kind === 'set') {
    const setItemId = key.setItemId
    const setItemName = '합성 세트 ' + setItemId

    return { setItemId, setItemName, setItemOption: [] }
  }
  const jobId = key.jobId
  const name = '합성 스킬 ' + key.skillId

  return { jobId, name, levelInfo: { rows: [] } }
}

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

test('세트 응답 순서와 무관하게 ID를 대응하고 누락·중복 응답과 혼합 요청을 거절한다', async () => {
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

test('저장된 아이템에서만 세트를 발견하고 캐시를 재사용하며 세트 구성품을 재귀 조회하지 않는다', async () => {
  const { store, rows } = memoryStore()
  const calls: CatalogKey[][] = []
  const service = createCatalogService(store, async (keys) => {
    calls.push(keys)

    return keys.map((key) => {
      const payload =
        key.kind === 'item'
          ? { ...catalogPayload(key), setItemId: 'set-a' }
          : { ...catalogPayload(key), setItemInfo: [{ itemId: 'unworn-item' }] }

      return { key, payload }
    })
  })
  const loaded = await service.load([item, item], signal)
  assert.equal(loaded.get(catalogKey(set))!.detail.status, 'fresh')
  assert.deepEqual(loaded.get(catalogKey(set))!.key, set)
  assert.deepEqual(calls, [[item], [set]])
  assert.equal(rows.size, 2)
  await service.load([item], signal)
  assert.equal(calls.length, 2)
  rows.get(catalogKey(set))!.expiresAt = new Date(0)
  const failed = createCatalogService(store, async () => {
    throw new Error('failed')
  })
  const stale = await failed.load([item], signal)
  assert.equal(stale.get(catalogKey(set))!.detail.status, 'stale')
  assert.deepEqual(
    stale.get(catalogKey(set))!.detail.data,
    loaded.get(catalogKey(set))!.detail.data
  )

  const broken = memoryStore().store
  broken.saveAndRead = async () => {
    throw new Error('commit failed')
  }
  let attempts = 0
  const uncommitted = createCatalogService(broken, async (keys) => {
    attempts++

    return keys.map((key) => {
      const payload = { ...catalogPayload(key), setItemId: 'uncommitted-set' }

      return { key, payload }
    })
  })
  assert.equal((await uncommitted.load([item], signal)).has('set:uncommitted-set'), false)
  assert.equal(attempts, 1)
})

test('후속 세트도 초기 참조와 함께 128개 한도와 하나의 취소 신호를 공유한다', async () => {
  const { store } = memoryStore()
  const requested: CatalogKey[] = []
  const signals: AbortSignal[] = []
  const service = createCatalogService(store, async (keys, deadline) => {
    requested.push(...keys)
    signals.push(deadline)

    return keys.map((key) => {
      if (key.kind === 'item') {
        const setItemId = 'set-' + key.itemId

        const payload = { ...catalogPayload(key), setItemId }

        return { key, payload }
      }

      const payload = catalogPayload(key)

      return { key, payload }
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
    [...result].filter(
      ([key, detail]) => key.startsWith('set:') && detail.detail.status === 'unavailable'
    ).length,
    126
  )
  assert(signals.every((value) => value === signals[0]))

  const controller = new AbortController()
  const stopping = createCatalogService(memoryStore().store, async (keys) => {
    if (keys[0]?.kind === 'set') {
      controller.abort()
    }

    return keys.map((key) => {
      const setReference = key.kind === 'item' ? { setItemId: 'set-a' } : {}
      const payload = { ...catalogPayload(key), ...setReference }

      return { key, payload }
    })
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

test('장착 부속에 공용 상세를 연결하고 원본·빈 슬롯·서약 setId를 보존한다', async () => {
  const details = fixture(),
    original = structuredClone(details),
    calls: CatalogKey[] = []
  const service = createCatalogService(memoryStore().store, async (keys) => {
    calls.push(...keys)

    return keys.map((key): CatalogValue => {
      const base = catalogPayload(key)
      const itemSet = key.kind === 'item' ? { setItemId: 'shared-set' } : {}
      const payload = { ...base, ...itemSet, tune: [{ level: 0, setPoint: 165 }] }

      return { key, payload }
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

test('공용 상세 실패에도 미장착 null과 빈 배열을 그대로 유지한다', async () => {
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

test('잘못된 참조는 조회하지 않고 반복 아이템·스킬은 한 번씩 연결하며 원본 순서를 보존한다', async () => {
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
  const requested: CatalogKey[] = []
  const catalog = createCatalogService(memoryStore().store, async (keys) => {
    requested.push(...keys)

    return keys.map((key) => {
      const payload = catalogPayload(key)

      return { key, payload }
    })
  })

  const result = await enrichCharacterDetails(details, catalog, signal)

  assert.deepEqual(requested.map(catalogKey).sort(), [
    'item:buff',
    'item:shared',
    'set:equipped-set',
    'set:shared-set',
    'skill:job:skill-a',
    'skill:job:skill-b',
    'skill:job:skill-c',
    'skill:job:skill-d'
  ])
  const equipment = result.equipment.equipment as Array<Record<string, unknown> | null>
  assert.deepEqual(
    equipment.map((entry) => entry?.itemId),
    ['shared', '', undefined, 'shared']
  )
  assert.deepEqual(equipment[0]!.itemDetail, equipment[3]!.itemDetail)
  assert.deepEqual(equipment[1], { itemId: '', setItemId: 'bad/set' })
  assert.equal(equipment[2], null)
  const skillStyle = result.skillStyle as Record<string, unknown>
  const skillDetails = skillStyle.skillDetails as Record<string, CatalogDetail>
  assert.deepEqual(Object.keys(skillDetails).sort(), ['skill-a', 'skill-b', 'skill-c', 'skill-d'])
  for (const id of ['skill-a', 'skill-b', 'skill-c', 'skill-d']) {
    assert.equal(skillDetails[id]!.status, 'fresh')
    assert.deepEqual(skillDetails[id]!.data, {
      jobId: 'job',
      name: '합성 스킬 ' + id,
      levelInfo: { rows: [] }
    })
  }
  assert.deepEqual(skillStyle.style, (details.skillStyle as Record<string, unknown>).style)
  assert.deepEqual(details, original)
})

test('예약어 ID도 JSON 사전에 안전하게 연결하고 유효한 jobId가 없으면 스킬 조회를 생략한다', async (t) => {
  for (const [name, jobId] of [
    ['정상 jobId', 'job'],
    ['빈 jobId', ''],
    ['null jobId', null]
  ] as const) {
    await t.test(name, async () => {
      const details = fixture()
      details.character.jobId = jobId
      details.equipment = {
        equipment: [{ itemId: 'equipment' }],
        setItemInfo: [{ setItemId: '__proto__' }, { setItemId: 'constructor' }]
      }
      details.avatar = null
      details.creature = null
      details.oath = null
      details.buff = { equipment: null, avatar: null, creature: null }
      details.skillStyle = {
        style: {
          active: [{ skillId: '__proto__' }, { skillId: 'constructor' }, { skillId: 'missing' }]
        }
      }
      const requested: CatalogKey[] = []
      const catalog = createCatalogService(memoryStore().store, async (keys) => {
        requested.push(...keys)

        return keys.flatMap((key) => {
          if (key.kind === 'skill' && key.skillId === 'missing') {
            return []
          }
          const payload = catalogPayload(key)

          return [{ key, payload }]
        })
      })

      const result = await enrichCharacterDetails(details, catalog, signal)
      const serialized = JSON.parse(JSON.stringify(result))
      assert.deepEqual(Object.keys(serialized.setDetails).sort(), ['__proto__', 'constructor'])
      for (const id of ['__proto__', 'constructor']) {
        assert(Object.hasOwn(serialized.setDetails, id))
        assert.deepEqual(serialized.setDetails[id].data, {
          setItemId: id,
          setItemName: '합성 세트 ' + id,
          setItemOption: []
        })
        assert.equal(serialized.setDetails[id].status, 'fresh')
      }
      const skillDetails = serialized.skillStyle.skillDetails
      assert.deepEqual(Object.keys(skillDetails).sort(), ['__proto__', 'constructor', 'missing'])
      for (const id of ['__proto__', 'constructor', 'missing']) {
        assert(Object.hasOwn(skillDetails, id))
        if (jobId === 'job' && id !== 'missing') {
          assert.deepEqual(skillDetails[id].data, {
            jobId: 'job',
            name: '합성 스킬 ' + id,
            levelInfo: { rows: [] }
          })
          assert.equal(skillDetails[id].status, 'fresh')
        } else {
          assert.deepEqual(skillDetails[id], { data: null, fetchedAt: null, status: 'unavailable' })
        }
      }
      const skills = requested
        .filter((key) => key.kind === 'skill')
        .map(catalogKey)
        .sort()
      const expected =
        jobId === 'job' ? ['skill:job:__proto__', 'skill:job:constructor', 'skill:job:missing'] : []
      assert.deepEqual(skills, expected)
      assert.deepEqual(serialized.equipment.equipment[0].itemDetail.data, {
        itemId: 'equipment',
        itemName: '합성 아이템 equipment'
      })
    })
  }
})

test('예약된 itemDetail·skillDetails는 공용 저장값으로 교체하고 캐릭터 옵션은 보존한다', async () => {
  const details = fixture()
  details.equipment = {
    equipment: [{ itemId: 'equipment', option: '장착 옵션', itemDetail: { injected: true } }],
    setItemInfo: []
  }
  details.avatar = null
  details.creature = null
  details.oath = null
  details.buff = { equipment: null, avatar: null, creature: null }
  details.skillStyle = {
    style: { active: [{ skillId: 'first' }] },
    skillDetails: { obsolete: { injected: true } }
  }
  const original = structuredClone(details)
  const catalog = createCatalogService(memoryStore().store, async (keys) => {
    return keys.map((key) => {
      const payload = { ...catalogPayload(key), tune: { level: 0 } }

      return { key, payload }
    })
  })

  const result = await enrichCharacterDetails(details, catalog, signal)

  const equipment = result.equipment.equipment as Array<Record<string, unknown>>
  assert.equal(equipment[0]!.option, '장착 옵션')
  assert.deepEqual((equipment[0]!.itemDetail as CatalogDetail).data, {
    itemId: 'equipment',
    itemName: '합성 아이템 equipment',
    tune: { level: 0 }
  })
  const skillStyle = result.skillStyle as Record<string, unknown>
  const skillDetails = skillStyle.skillDetails as Record<string, CatalogDetail>
  assert.deepEqual(Object.keys(skillDetails), ['first'])
  assert.deepEqual(skillDetails.first!.data, {
    jobId: 'job',
    name: '합성 스킬 first',
    levelInfo: { rows: [] },
    tune: { level: 0 }
  })
  assert.deepEqual(skillStyle.style, (details.skillStyle as Record<string, unknown>).style)
  assert.deepEqual(details, original)
})
