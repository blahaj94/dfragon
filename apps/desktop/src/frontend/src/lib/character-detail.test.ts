import { expect, it } from 'vitest'
import { dealerCard } from '../testing/fixtures/character-cards'
import type { CharacterCard } from '../types/cards'
import { toDetailEquipmentGroups, toDetailOathGroups } from './character-detail'

it('장비 목록은 캔버스 상세 창 보드처럼 무기, 방어구 다섯, 장신구 셋, 특수 장비 셋 묶음이다', () => {
  const groups = toDetailEquipmentGroups(dealerCard)

  expect(groups.map((group) => group.rows.map((row) => row.id))).toEqual([
    ['WEAPON'],
    ['SHOULDER', 'JACKET', 'PANTS', 'WAIST', 'SHOES'],
    ['WRIST', 'AMULET', 'RING'],
    ['SUPPORT', 'MAGIC_STON', 'EARRING']
  ])
  expect(groups[0].rows[0]).toMatchObject({
    name: '검은 질병의 멸룡검 발뭉',
    label: '무기, 검은 질병의 멸룡검 발뭉',
    tone: 'primordial',
    kind: '무기 · 태초',
    lead: true,
    reinforce: { text: '+13', tone: 'enhance', label: '강화 13' }
  })
})

it('마법부여는 카드 값의 이름과 수치를 그대로 잇고, 옵션이 없거나 희귀도를 모르면 그 칸을 비운다', () => {
  const [weapon, ...rest] = dealerCard.investment
  const card: CharacterCard = {
    ...dealerCard,
    investment: [{ ...weapon, rarity: null, enchant: { status: [], grade: null } }, ...rest]
  }
  const [unrated] = toDetailEquipmentGroups(card)[0].rows

  expect(toDetailEquipmentGroups(dealerCard)[0].rows[0].enchant).toBe(
    '모든 속성 강화 15 · 물리 공격력 30 · 마법 공격력 30 · 독립 공격력 30'
  )
  expect(unrated).toMatchObject({ enchant: null, kind: '무기', tone: 'unknown' })
})

it('카드 값이 없으면 12부위를 장착 정보 없음 줄로 두고 서약 목록은 비운다', () => {
  const rows = toDetailEquipmentGroups(null).flatMap((group) => group.rows)

  expect(rows).toHaveLength(12)
  expect(rows.every((row) => row.tone === 'missing' && row.name === '-')).toBe(true)
  expect(rows[0].label).toBe('무기, 장착 정보 없음')
  expect(toDetailOathGroups(null)).toEqual([])
})

it('서약 목록은 본체 뒤에 결정 자리 0~2, 3~10을 두고 빠진 자리는 장착 정보 없음 줄이다', () => {
  const oath = dealerCard.oath!
  const card: CharacterCard = {
    ...dealerCard,
    oath: { ...oath, crystals: oath.crystals.filter((crystal) => crystal.slotNo !== 4) }
  }
  const groups = toDetailOathGroups(card)

  expect(groups.map((group) => group.rows.length)).toEqual([1, 3, 8])
  expect(groups[0].rows[0]).toMatchObject({
    label: '서약, 강림한 여우 서약',
    lead: true,
    reinforce: null
  })
  expect(groups[2].rows[1]).toMatchObject({
    id: 'crystal-4',
    tone: 'missing',
    label: '서약 결정, 장착 정보 없음'
  })
  expect(groups[2].rows[0]).toMatchObject({ kind: '서약 결정 · 에픽', tone: 'epic' })
})
