import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { projectCharacterCard } from '../src/characters/card/project.js'
import type { CharacterCard } from '../src/characters/card/types.js'
import { projectCharacterDetails } from '../src/characters/details/project.js'
import type { CharacterDetailSection } from '../src/characters/details/sections.js'

// 이전 Desktop은 카드 전체를 엄격하게 검사하므로 지운 칸은 빈 값으로 남긴다.
const retiredFields = {
  stats: null,
  score: null,
  serverRank: null,
  set: null,
  oath: null,
  investment: []
} as const

function readFixture(role: 'dealer' | 'buffer') {
  const url = new URL(`../../test/fixtures/character-card-${role}.json`, import.meta.url)

  return JSON.parse(readFileSync(url, 'utf8')) as {
    sections: Record<CharacterDetailSection, Record<string, unknown>>
    card: CharacterCard
  }
}

test('실응답 fixture의 딜러와 버퍼는 역할만 정하고 지운 칸은 빈 값으로 둔다', () => {
  for (const role of ['dealer', 'buffer'] as const) {
    const fixture = readFixture(role)
    const { serverId, characterId } = fixture.sections.basic as Record<string, string>
    const identity = { serverId: serverId!, characterId: characterId! }
    const at = new Date('2026-10-19T00:00:00.000Z')

    const card = projectCharacterCard(projectCharacterDetails(identity, fixture.sections, at))

    assert.deepEqual(card, { role, ...retiredFields }, role)
  }
})

test('역할은 眞 접두를 포함한 버퍼 전직명으로 정하고 직업을 모르면 null이다', () => {
  for (const [jobGrowName, role] of [
    ['眞 크루세이더', 'buffer'],
    ['眞 인챈트리스', 'buffer'],
    ['眞 패러메딕', 'buffer'],
    ['眞 뮤즈', 'buffer'],
    ['뮤즈', 'buffer'],
    ['眞 이단심판관', 'dealer'],
    ['眞 뮤즈 아님', 'dealer'],
    [null, null],
    ['', null],
    [42, null],
    [undefined, null]
  ] as const) {
    const card = projectCharacterCard({ character: { jobGrowName } })
    assert.deepEqual(card, { role, ...retiredFields }, String(jobGrowName))
  }
})
