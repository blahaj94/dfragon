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

it('서약 본체 줄은 로컬 아이템 그림이 있어도 번들한 서약 아이콘을 쓰고, 아이콘이 없는 서약만 아이템 그림이다', () => {
  const oath = dealerCard.oath!
  const itemImages = { [oath.itemId]: 'file:///local/oath.png' }
  const bodyImage = (card: CharacterCard) =>
    toDetailOathGroups(card, undefined, itemImages)[0].rows[0].image
  const unknownOath: CharacterCard = { ...dealerCard, oath: { ...oath, name: '모르는 서약' } }

  // 강림한 여우 서약은 sprite 29번 칸(한 줄 16칸, 칸 28px)이다.
  expect(bodyImage(dealerCard)).toMatchObject({
    sprite: expect.stringMatching(/equipment\.webp/),
    x: 364,
    y: 28
  })
  expect(bodyImage(unknownOath)).toBe('file:///local/oath.png')
})

it('설명 상자 문구는 줄의 itemId로 찾고, 아이템 설명 첫 줄의 `[...]` 제목을 떼어 둔다', () => {
  const [weapon, jacket] = dealerCard.investment
  const itemTexts = {
    [weapon.itemId!]: {
      explain: '[용을 베는 자]\n스킬 퀵슬롯의 빈 슬롯이 3개 이상일 때\n- 모든 속도 +20%',
      buff: '30레벨 버프 스킬 Lv +3',
      flavor: '그 피로 세상을 멸할 힘을 얻는다.'
    },
    [jacket.itemId!]: { explain: '모든 속성 강화 +40 [최대]', buff: null, flavor: null },
    [dealerCard.oath!.itemId]: { explain: '[제목만]', buff: null, flavor: '서약 플레이버' }
  }
  const rows = toDetailEquipmentGroups(dealerCard, itemTexts).flatMap((group) => group.rows)
  const [oath] = toDetailOathGroups(dealerCard, itemTexts)[0].rows

  expect(rows.find((row) => row.id === 'WEAPON')?.text).toEqual({
    heading: '[용을 베는 자]',
    explain: '스킬 퀵슬롯의 빈 슬롯이 3개 이상일 때\n- 모든 속도 +20%',
    buff: '30레벨 버프 스킬 Lv +3',
    flavor: '그 피로 세상을 멸할 힘을 얻는다.'
  })
  expect(rows.find((row) => row.id === 'JACKET')?.text).toMatchObject({
    heading: null,
    explain: '모든 속성 강화 +40 [최대]'
  })
  expect(oath.text).toEqual({
    heading: '[제목만]',
    explain: null,
    buff: null,
    flavor: '서약 플레이버'
  })
})

it('문구를 받지 못한 아이템과 장착 정보 없음 줄은 설명 상자 문구를 비운다', () => {
  const empty = { heading: null, explain: null, buff: null, flavor: null }
  const inherited = Object.create({ [dealerCard.investment[0].itemId!]: { explain: '상속' } })

  expect(toDetailEquipmentGroups(dealerCard, {})[0].rows[0].text).toEqual(empty)
  expect(toDetailEquipmentGroups(dealerCard, inherited)[0].rows[0].text).toEqual(empty)
  expect(toDetailEquipmentGroups(null, {})[0].rows[0].text).toEqual(empty)
})
