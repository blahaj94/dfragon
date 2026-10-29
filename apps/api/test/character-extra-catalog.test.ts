import assert from 'node:assert/strict'
import test from 'node:test'
import { enrichCharacterDetails } from '../src/characters/catalog/enrich.js'
import { createCatalogService } from '../src/characters/catalog/service.js'
import type { CatalogDetail } from '../src/characters/catalog/types.js'
import type { projectCharacterDetails } from '../src/characters/details/project.js'

const signal = new AbortController().signal
function catalogPayload(itemId: string) {
  return { itemId, itemName: '합성 아이템 ' + itemId }
}

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

test('장착 부속에 공용 상세를 연결하고 원본, 빈 슬롯, 서약 setId를 보존한다', async () => {
  const details = fixture(),
    original = structuredClone(details),
    calls: string[] = []
  const service = createCatalogService(async (itemIds) => {
    calls.push(...itemIds)

    return new Map(
      itemIds.map((itemId) => {
        const base = catalogPayload(itemId)
        const itemSet = { setItemId: 'shared-set' }
        const payload = { ...base, ...itemSet, tune: [{ level: 0, setPoint: 165 }] }

        return [itemId, payload]
      })
    )
  })
  const result = await enrichCharacterDetails(details, service, signal)
  assert.deepEqual(details, original)
  assert.equal(calls.length, 9)
  assert.equal(Object.hasOwn(result, 'setDetails'), false)
  assert.equal(Object.hasOwn(result.skillStyle as object, 'skillDetails'), false)
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
    const service = createCatalogService(async () => {
      throw new Error('failure')
    })
    const result = await enrichCharacterDetails(details, service, signal)
    assert.deepEqual(result.avatar, value)
    assert.equal(result.creature, null)
    assert.equal(result.oath, null)
    assert.deepEqual(result.buff.avatar, { avatar: value })
    assert.deepEqual(result.buff.creature, { creature: value })
    const equipment = result.equipment.equipment as Array<{ itemDetail: CatalogDetail }>
    assert.equal(equipment[0]!.itemDetail.status, 'unavailable')
  }
})

test('잘못된 참조는 조회하지 않고 반복 아이템은 한 번씩 연결하며 원본 순서를 보존한다', async () => {
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
  const requested: string[] = []
  const catalog = createCatalogService(async (itemIds) => {
    requested.push(...itemIds)

    return new Map(itemIds.map((itemId) => [itemId, catalogPayload(itemId)]))
  })

  const result = await enrichCharacterDetails(details, catalog, signal)

  assert.deepEqual(requested.sort(), ['buff', 'shared'])
  const equipment = result.equipment.equipment as Array<Record<string, unknown> | null>
  assert.deepEqual(
    equipment.map((entry) => entry?.itemId),
    ['shared', '', undefined, 'shared']
  )
  assert.deepEqual(equipment[0]!.itemDetail, equipment[3]!.itemDetail)
  assert.deepEqual(equipment[1], { itemId: '', setItemId: 'bad/set' })
  assert.equal(equipment[2], null)
  const skillStyle = result.skillStyle as Record<string, unknown>
  assert.equal(Object.hasOwn(skillStyle, 'skillDetails'), false)
  assert.equal(Object.hasOwn(result, 'setDetails'), false)
  assert.deepEqual(skillStyle.style, (details.skillStyle as Record<string, unknown>).style)
  assert.deepEqual(details, original)
})

test('예약된 itemDetail은 공용 조회값으로 교체하고 캐릭터 옵션은 보존한다', async () => {
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
  const catalog = createCatalogService(async (itemIds) => {
    return new Map(
      itemIds.map((itemId) => [itemId, { ...catalogPayload(itemId), tune: { level: 0 } }])
    )
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
  assert.equal(Object.hasOwn(skillStyle, 'skillDetails'), false)
  assert.deepEqual(skillStyle.style, (details.skillStyle as Record<string, unknown>).style)
  assert.deepEqual(details, original)
})
