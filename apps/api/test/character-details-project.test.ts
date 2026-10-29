import assert from 'node:assert/strict'
import test from 'node:test'
import { projectCharacterDetails } from '../src/characters/details/project.js'
import type {
  CharacterDetailSection,
  CharacterPayload,
  CharacterPayloads
} from '../src/characters/details/sections.js'

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

const fetchedAt = new Date('2026-09-01T00:01:00.000Z')

function payloadsFor(
  payloads: Partial<Record<CharacterDetailSection, CharacterPayload>> = {}
): CharacterPayloads {
  return structuredClone({ ...storedPayloads, ...payloads })
}

test('공통 헤더를 모으고 섹션의 장착 값을 보존하며 섹션마다 revision 1과 조회 시각을 담는다', () => {
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
  const payloads = payloadsFor({
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
  })
  const original = structuredClone(payloads)
  const metadata = {
    revision: 1,
    contentUpdatedAt: '2026-09-01T00:01:00.000Z',
    lastSuccessfulFetchAt: '2026-09-01T00:01:00.000Z'
  }

  const result = projectCharacterDetails(identity, payloads, fetchedAt)

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
  })
  assert.deepEqual(payloads, original)
})

test('선택 신상 정보의 누락은 null로 정제하고 미장착 null과 빈 배열을 구분한다', () => {
  const result = projectCharacterDetails(
    identity,
    payloadsFor({
      avatar: { ...common, avatar: [] },
      buff_equipment: { ...common, skill: { buff: { equipment: [] } } },
      buff_avatar: { ...common, skill: null },
      buff_creature: { ...common, skill: {} }
    }),
    fetchedAt
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
