import assert from 'node:assert/strict'
import test from 'node:test'
import { enchantGrades } from '../src/characters/card/enchant-grades.js'
import type { EnchantStatus } from '../src/characters/card/types.js'

// 퍼스트서버 글 번호와 글 날짜(YYYY-MM-DD)로 등급표 판정 근거를 적는다.
const FIRST_SERVER_DATASET_PATTERN = /^first-server \d+ \d{4}-\d{2}-\d{2}$/

const titles = {
  source:
    '저장소의 등급표는 판정에 쓴 퍼스트서버 글 번호, 날짜와 생성 시각을 적고 기타 면의 12부위 키만 가진다',
  entries:
    '부위마다 항목이 있고 항목마다 카드 이름이 하나 이상이며 한 항목 안에서 카드 이름과 옵션 이름이 겹치지 않는다',
  unique: '같은 옵션 조합은 한 부위에서 한 등급의 한 항목에만 있다'
}

// 기타 면의 12부위(docs/rules/character-details.md의 investment 순서).
const investmentSlots = [
  'WEAPON',
  'JACKET',
  'SHOULDER',
  'PANTS',
  'WAIST',
  'SHOES',
  'AMULET',
  'WRIST',
  'RING',
  'SUPPORT',
  'MAGIC_STON',
  'EARRING'
]

// 옵션 순서와 무관하게 같은 조합을 같은 문자열로 만든다.
function optionKey(status: readonly EnchantStatus[]): string {
  return status
    .map((option) => `${option.name}=${JSON.stringify(option.value)}`)
    .sort()
    .join(', ')
}

test(titles.source, () => {
  const { dataset, generated_at } = enchantGrades.source

  assert.match(dataset, FIRST_SERVER_DATASET_PATTERN)
  assert.equal(typeof generated_at, 'string')
  assert.ok(!Number.isNaN(Date.parse(generated_at ?? '')), generated_at ?? 'null')
  assert.deepEqual(Object.keys(enchantGrades.slots).sort(), [...investmentSlots].sort())
})

test(titles.entries, () => {
  for (const [slotId, grades] of Object.entries(enchantGrades.slots)) {
    const entries = Object.values(grades).flat()

    assert.ok(entries.length > 0, slotId)
    for (const entry of entries) {
      const names = entry.status.map((option) => option.name)
      const cardNames = entry.cardNames ?? []

      assert.ok(cardNames.length > 0, `${slotId}: ${optionKey(entry.status)}`)
      assert.equal(new Set(cardNames).size, cardNames.length, `${slotId}: ${cardNames.join(', ')}`)
      assert.equal(new Set(names).size, names.length, `${slotId}: ${cardNames.join(', ')}`)
    }
  }
})

test(titles.unique, () => {
  for (const [slotId, grades] of Object.entries(enchantGrades.slots)) {
    const seen = new Map<string, string>()

    for (const [grade, entries] of Object.entries(grades)) {
      for (const entry of entries) {
        const key = optionKey(entry.status)

        assert.equal(
          seen.get(key),
          undefined,
          `${slotId}: ${entry.cardNames?.join(', ')} (${grade}, ${seen.get(key)})`
        )
        seen.set(key, grade)
      }
    }
  }
})
