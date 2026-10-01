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

function rowsFor(
  payloads: Partial<Record<CharacterDetailSection, CharacterPayload>> = {}
): CharacterApiResponse[] {
  const characterId = identity.characterId
  const contentUpdatedAt = new Date('2026-09-01T00:00:00.000Z')
  const lastSuccessfulFetchAt = new Date('2026-09-01T00:01:00.000Z')
  const requestStartedAt = new Date('2026-09-01T00:00:30.000Z')

  return characterDetailSections.map((section) => {
    const payload = payloads[section] ?? {}

    return {
      characterId,
      section,
      payload,
      revision: 1,
      contentUpdatedAt,
      lastSuccessfulFetchAt,
      requestStartedAt
    }
  })
}

test('projection uses the last section row and preserves nullish defaults and payload references', () => {
  const jobGrowName = { future: true }
  const status = [{ name: 'fixture-status', value: 0 }]
  const statusBuff: unknown[] = []
  const equipment = [{ itemId: 'fixture-item' }]
  const setItemInfo: unknown[] = []
  const avatar: unknown[] = []
  const oath = { info: null, crystal: [] }
  const mistAssimilation = { level: 0 }
  const skillStyle = { style: { active: [] } }
  const buffEquipment = { equipment }
  const rows = rowsFor({
    basic: { characterName: 'previous' },
    status: { status, buff: statusBuff },
    equipment: { equipment, setItemInfo },
    avatar: { avatar },
    creature: { creature: null },
    oath: { oath },
    mist_assimilation: { mistAssimilation },
    skill_style: { skill: skillStyle },
    buff_equipment: { skill: { buff: buffEquipment } },
    buff_avatar: { skill: null },
    buff_creature: { skill: {} }
  }).reverse()
  const contentUpdatedAt = new Date('2026-09-02T00:00:00.000Z')
  const lastSuccessfulFetchAt = new Date('2026-09-02T00:01:00.000Z')
  rows.push({
    ...rows.find((row) => row.section === 'basic')!,
    payload: {
      characterName: '',
      level: 0,
      jobId: false,
      jobGrowId: null,
      jobName: undefined,
      jobGrowName,
      fame: NaN,
      adventureName: 'fixture-adventure',
      unselected: 'retained in storage'
    },
    revision: 7,
    contentUpdatedAt,
    lastSuccessfulFetchAt
  })
  const original = structuredClone(rows)

  const result = projectCharacterDetails(identity, rows)

  assert.deepEqual(result.character, {
    ...identity,
    serverName: '시로코',
    characterName: '',
    level: 0,
    jobId: false,
    jobGrowId: null,
    jobName: null,
    jobGrowName,
    fame: NaN,
    adventureName: 'fixture-adventure',
    guildId: null,
    guildName: null
  })
  assert.equal(result.character.jobGrowName, jobGrowName)
  assert.equal(result.status.status, status)
  assert.equal(result.status.buff, statusBuff)
  assert.equal(result.equipment.equipment, equipment)
  assert.equal(result.equipment.setItemInfo, setItemInfo)
  assert.equal(result.avatar, avatar)
  assert.equal(result.creature, null)
  assert.equal(result.oath, oath)
  assert.equal(result.mistAssimilation, mistAssimilation)
  assert.equal(result.skillStyle, skillStyle)
  assert.deepEqual(result.buff, { equipment: buffEquipment, avatar: null, creature: null })
  assert.equal(result.buff.equipment, buffEquipment)
  assert.deepEqual(Object.keys(result.sections), characterDetailSections)
  assert.deepEqual(result.sections.basic, {
    revision: 7,
    contentUpdatedAt: '2026-09-02T00:00:00.000Z',
    lastSuccessfulFetchAt: '2026-09-02T00:01:00.000Z'
  })
  assert.deepEqual(rows, original)
})

test('projection preserves getter order and the starting metadata iteration length', () => {
  const reads: string[] = []
  const basicFields = [
    'characterName',
    'level',
    'jobId',
    'jobGrowId',
    'jobName',
    'jobGrowName',
    'fame',
    'adventureName',
    'guildId',
    'guildName'
  ]
  const basic: CharacterPayload = {}
  for (const field of basicFields) {
    Object.defineProperty(basic, field, {
      get() {
        reads.push(`basic:${field}`)

        return field
      }
    })
  }
  Object.defineProperty(basic, 'unselected', {
    get() {
      throw new Error('Unselected fields must not be read')
    }
  })
  const rows = rowsFor({ basic })
  let appendedSection = false
  for (const row of rows) {
    const { section, payload, revision, contentUpdatedAt, lastSuccessfulFetchAt } = row
    Object.defineProperties(row, {
      payload: {
        get() {
          reads.push(`${section}:payload`)

          return payload
        }
      },
      revision: {
        get() {
          reads.push(`${section}:revision`)
          if (section === 'basic' && !appendedSection) {
            appendedSection = true
            characterDetailSections.push('basic')
          }

          return revision
        }
      },
      contentUpdatedAt: {
        get() {
          reads.push(`${section}:contentUpdatedAt`)

          return contentUpdatedAt
        }
      },
      lastSuccessfulFetchAt: {
        get() {
          reads.push(`${section}:lastSuccessfulFetchAt`)

          return lastSuccessfulFetchAt
        }
      }
    })
  }
  const requestedIdentity = {
    get serverId() {
      reads.push('identity:serverId')

      return identity.serverId
    },
    get characterId() {
      reads.push('identity:characterId')

      return identity.characterId
    }
  }

  const originalSections = [...characterDetailSections]
  try {
    projectCharacterDetails(requestedIdentity, rows)
  } finally {
    characterDetailSections.splice(0, characterDetailSections.length, ...originalSections)
  }

  assert.deepEqual(reads, [
    'basic:payload',
    'identity:serverId',
    'identity:characterId',
    'identity:serverId',
    ...basicFields.map((field) => `basic:${field}`),
    'status:payload',
    'status:payload',
    'equipment:payload',
    'equipment:payload',
    'avatar:payload',
    'creature:payload',
    'oath:payload',
    'mist_assimilation:payload',
    'skill_style:payload',
    'buff_equipment:payload',
    'buff_avatar:payload',
    'buff_creature:payload',
    ...characterDetailSections.flatMap((section) => [
      `${section}:revision`,
      `${section}:contentUpdatedAt`,
      `${section}:lastSuccessfulFetchAt`
    ])
  ])
})

test('missing sections fail before reading payloads or identity', () => {
  const rows = rowsFor().filter((row) => row.section !== 'buff_creature')
  Object.defineProperty(
    rows.find((row) => row.section === 'basic')!,
    'payload',
    {
      get() {
        throw new Error('Payload must not be read before section validation')
      }
    }
  )
  const requestedIdentity = {
    get serverId(): string {
      throw new Error('Identity must not be read before section validation')
    },
    characterId: identity.characterId
  }

  assert.throws(
    () => projectCharacterDetails(requestedIdentity, rows),
    (error: unknown) => error instanceof CharacterDetailFailure && error.status === 500
  )
})
