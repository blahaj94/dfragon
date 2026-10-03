import assert from 'node:assert/strict'
import test from 'node:test'
import { CharacterDetailFailure } from '../src/characters/details/errors.js'
import { projectCharacterDetails } from '../src/characters/details/project.js'
import { characterDetailSections } from '../src/characters/details/sections.js'
import type {
  CharacterDetailSection,
  CharacterPayload
} from '../src/characters/details/sections.js'
import type { CharacterApiResponse } from '../src/database/schemas/character-api-responses.js'

const identity = { serverId: 'siroco', characterId: 'fixture-character' }
const common = { ...identity, characterName: '합성 캐릭터' }
const storedPayloads = {
  basic: { ...common },
  status: { ...common, status: [], buff: [] },
  equipment: { ...common, equipment: [], setItemInfo: [] },
  avatar: { ...common, avatar: null },
  creature: { ...common, creature: null },
  oath: { ...common, oath: null },
  mist_assimilation: { ...common, mistAssimilation: null },
  skill_style: { ...common, skill: null },
  buff_equipment: { ...common, skill: { buff: null } },
  buff_avatar: { ...common, skill: { buff: null } },
  buff_creature: { ...common, skill: { buff: null } }
} satisfies Record<CharacterDetailSection, CharacterPayload>

function rowsFor(
  payloads: Partial<Record<CharacterDetailSection, CharacterPayload>> = {}
): CharacterApiResponse[] {
  return characterDetailSections.map((section) => {
    const payload = structuredClone(payloads[section] ?? storedPayloads[section])

    return {
      characterId: identity.characterId,
      section,
      payload,
      revision: 1,
      contentUpdatedAt: new Date('2026-09-01T00:00:00.000Z'),
      lastSuccessfulFetchAt: new Date('2026-09-01T00:01:00.000Z'),
      requestStartedAt: new Date('2026-09-01T00:00:30.000Z')
    }
  })
}

test('DB 행 순서와 무관하게 공통 헤더를 모으고 섹션의 장착 값과 조회 메타데이터를 보존한다', () => {
  const status = [
    { name: '힘', value: 0 },
    { name: '공격 속도', value: '48.3%' }
  ]
  const statusBuff = [{ name: '버프력', value: 1200 }]
  const equipment = [{ itemId: 'weapon', slotId: 'WEAPON', tune: { level: 3 } }]
  const setItemInfo = [{ setItemId: 'set', active: { setPoint: { current: 2800 } } }]
  const oath = { info: null, crystal: [], blessing: { future: true } }
  const skillStyle = {
    hash: 'fixture-hash',
    style: { active: [], chain: { resetTime: 0, skills: [null, 'skill', null] } }
  }
  const buffEquipment = {
    skillInfo: { skillId: 'buff-skill', level: 10 },
    equipment,
    futureOption: { rate: '3%' }
  }
  const rows = rowsFor({
    basic: {
      ...common,
      level: 115,
      jobId: 'job',
      jobGrowId: 'grow',
      jobName: '직업',
      jobGrowName: '전직',
      fame: 0,
      adventureName: '모험단',
      guildId: null,
      guildName: null,
      unknownHeader: 'DB 원본에만 남는다'
    },
    status: { ...common, status, buff: statusBuff },
    equipment: { ...common, equipment, setItemInfo },
    avatar: { ...common, avatar: [] },
    oath: { ...common, oath },
    mist_assimilation: { ...common, mistAssimilation: { level: 0 } },
    skill_style: { ...common, skill: skillStyle },
    buff_equipment: { ...common, skill: { buff: buffEquipment } }
  }).reverse()
  const basicRow = rows.find((row) => row.section === 'basic')!
  basicRow.revision = 7
  basicRow.contentUpdatedAt = new Date('2026-09-02T00:00:00.000Z')
  basicRow.lastSuccessfulFetchAt = new Date('2026-09-02T00:01:00.000Z')
  const original = structuredClone(rows)
  const metadata = {
    revision: 1,
    contentUpdatedAt: '2026-09-01T00:00:00.000Z',
    lastSuccessfulFetchAt: '2026-09-01T00:01:00.000Z'
  }

  const result = projectCharacterDetails(identity, rows)

  assert.deepEqual(result, {
    character: {
      ...identity,
      serverName: '시로코',
      characterName: '합성 캐릭터',
      level: 115,
      jobId: 'job',
      jobGrowId: 'grow',
      jobName: '직업',
      jobGrowName: '전직',
      fame: 0,
      adventureName: '모험단',
      guildId: null,
      guildName: null
    },
    status: { status, buff: statusBuff },
    equipment: { equipment, setItemInfo },
    avatar: [],
    creature: null,
    oath,
    mistAssimilation: { level: 0 },
    skillStyle,
    buff: { equipment: buffEquipment, avatar: null, creature: null },
    sections: {
      basic: {
        revision: 7,
        contentUpdatedAt: '2026-09-02T00:00:00.000Z',
        lastSuccessfulFetchAt: '2026-09-02T00:01:00.000Z'
      },
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
  })
  assert.deepEqual(rows, original)
})

test('선택 신상 정보의 누락은 null로 정제하고 미장착 null과 빈 배열을 구분한다', () => {
  const result = projectCharacterDetails(
    identity,
    rowsFor({
      avatar: { ...common, avatar: [] },
      buff_equipment: { ...common, skill: { buff: { equipment: [] } } },
      buff_avatar: { ...common, skill: null },
      buff_creature: { ...common, skill: {} }
    })
  )

  assert.deepEqual(result.character, {
    ...identity,
    serverName: '시로코',
    characterName: '합성 캐릭터',
    level: null,
    jobId: null,
    jobGrowId: null,
    jobName: null,
    jobGrowName: null,
    fame: null,
    adventureName: null,
    guildId: null,
    guildName: null
  })
  assert.deepEqual(result.status, { status: [], buff: [] })
  assert.deepEqual(result.equipment, { equipment: [], setItemInfo: [] })
  assert.deepEqual(result.avatar, [])
  assert.equal(result.creature, null)
  assert.equal(result.oath, null)
  assert.equal(result.mistAssimilation, null)
  assert.equal(result.skillStyle, null)
  assert.deepEqual(result.buff, { equipment: { equipment: [] }, avatar: null, creature: null })
})

test('11개 섹션 중 하나라도 저장값이 없으면 정제된 내부 오류로 거절한다', async (t) => {
  for (const section of characterDetailSections) {
    await t.test(`${section} 저장값 누락`, () => {
      const rows = rowsFor().filter((row) => row.section !== section)
      assert.throws(
        () => projectCharacterDetails(identity, rows),
        (error: unknown) => {
          assert(error instanceof CharacterDetailFailure)
          assert.equal(error.status, 500)
          assert.deepEqual(error.body, {
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: '서버 오류로 캐릭터 정보를 처리하지 못했습니다.'
            }
          })

          return true
        }
      )
    })
  }
})
