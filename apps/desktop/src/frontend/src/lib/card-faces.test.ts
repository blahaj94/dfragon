import { expect, it } from 'vitest'
import { bufferCard, dealerCard } from '../testing/fixtures/character-cards'
import { apiBufferCard, apiDealerCard } from '../testing/fixtures/api-character-cards'
import apiBufferFixture from '../../../../../api/test/fixtures/character-card-buffer.json'
import apiDealerFixture from '../../../../../api/test/fixtures/character-card-dealer.json'
import type { CharacterCard } from '../types/cards'
import {
  itemImageUrl,
  toCharacterFace,
  toEquipmentFace,
  toInvestmentRows,
  toRarityTone
} from './card-faces'

it('카드 값이 없으면 세 면 모두 값 대신 -와 없다는 이름을 두고 0이나 빈칸을 만들지 않는다', () => {
  const character = toCharacterFace(null, 'long')
  expect(character.stats.map((stat) => [stat.label, stat.value])).toEqual([
    ['공격력 증가', '-'],
    ['공격력 증폭', '-'],
    ['크리티컬', '-'],
    ['스위칭', '-']
  ])
  expect(character.score).toEqual({ value: null, description: undefined })
  expect(character.serverRank).toEqual({ text: '-', label: '서버 순위 없음' })

  const { set, oath } = toEquipmentFace(null)
  expect(set).toMatchObject({ missing: true, name: '세트 정보 없음', point: '-', counts: [] })
  expect(oath).toMatchObject({ missing: true, name: '서약 정보 없음', point: '-', counts: [] })
  expect(set.groups.flatMap((group) => group.cells).every((cell) => cell.tone === 'empty')).toBe(
    true
  )
  expect(oath.upgrades.flat().every((cell) => !cell.filled)).toBe(true)

  const rows = toInvestmentRows(null)
  expect(rows.map((row) => row.itemLabel)).toEqual([
    '무기, 장착 정보 없음',
    '상의, 장착 정보 없음',
    '머리어깨, 장착 정보 없음',
    '하의, 장착 정보 없음',
    '벨트, 장착 정보 없음',
    '신발, 장착 정보 없음',
    '목걸이, 장착 정보 없음',
    '팔찌, 장착 정보 없음',
    '반지, 장착 정보 없음',
    '보조장비, 장착 정보 없음',
    '마법석, 장착 정보 없음',
    '귀걸이, 장착 정보 없음'
  ])
  expect(rows[0]).toMatchObject({
    itemName: '-',
    itemTone: 'missing',
    imageUrl: undefined,
    reinforce: { text: '-', tone: 'missing' },
    enchant: { grade: null, text: '-', label: '마법부여 없음' }
  })
})

it('딜러 카드는 딜러 스탯과 장비 점수를 보이고 순위가 수집 범위의 순위임을 보조 기술에 전한다', () => {
  const face = toCharacterFace(dealerCard, 'long')
  expect(face.stats).toEqual([
    { label: '공격력 증가', value: '7', unit: '만%' },
    { label: '공격력 증폭', value: '76', unit: '%' },
    { label: '크리티컬', value: '101.1', unit: '%' },
    { label: '스위칭', value: '-', unit: '' }
  ])
  expect(face.score.value).toBe(330556)
  expect(face.score.description).toContain('계산값')
  expect(face.serverRank).toEqual({
    text: '#18240',
    label: '서버 순위 18240위, DFragon이 수집한 캐릭터 52,310명 기준'
  })
  // 공대 카드는 같은 값에 줄인 라벨을 쓴다.
  expect(toCharacterFace(dealerCard, 'short').stats.map((stat) => stat.label)).toEqual([
    '공격력 증가',
    '증폭',
    '크리티컬',
    '스위칭'
  ])
})

it('버퍼 카드는 버퍼 라벨을 쓰고 버프 점수도 장비 점수 칸 값으로 보인다', () => {
  const face = toCharacterFace(bufferCard, 'long')
  expect(face.stats).toEqual([
    { label: '마을 지능', value: '7,594', unit: '' },
    { label: '30레벨 버프', value: '-', unit: '' },
    { label: '50레벨 버프', value: '-', unit: '' },
    { label: '스위칭', value: '-', unit: '' }
  ])
  expect(face.score.value).toBe(55358)
})

it('엔진이 건너뛴 점수는 값 없이 사유 종류만 전하고 엔진의 원문 메시지는 쓰지 않는다', () => {
  const skipped = (kind: string): CharacterCard => ({
    ...dealerCard,
    score: {
      calculator: 'equipment',
      value: null,
      skipped: { kind, message: 'unresolved: equipment TITLE missing' },
      versions: { package: 'dnfscore', rulesRev: 'rev12', bundleId: 'phase31-rev12' }
    }
  })
  expect(toCharacterFace(skipped('unresolved'), 'long').score).toEqual({
    value: null,
    description: '계산하지 못함, 장비 정보 부족'
  })
  expect(toCharacterFace(skipped('input_gate'), 'long').score.description).toBe(
    '계산하지 못함, 입력값이 게임 스탯과 다름'
  )
  const unknown = toCharacterFace(skipped('new_kind'), 'long').score
  expect(unknown).toEqual({ value: null, description: '계산하지 못함, 계산 제외' })
  expect(unknown.description).not.toContain('TITLE')
  expect(toCharacterFace(skipped('toString'), 'long').score.description).toBe(
    '계산하지 못함, 계산 제외'
  )
})

it('세트 섹션은 세트 포인트, 무기와 세트 부위의 희귀도 격자, 희귀도 개수를 보이고 세트가 없으면 비운다', () => {
  const { set } = toEquipmentFace(dealerCard)
  expect(set).toMatchObject({
    missing: false,
    name: '환상의 에테리얼 오브 아츠 세트',
    tone: 'primordial',
    point: '2,625',
    imageUrl: 'https://img-api.neople.co.kr/df/items/2d23a5dc389016bdc3a3e3fd142b38ce',
    counts: [
      { label: '태초', count: '3', tone: 'primordial' },
      { label: '에픽', count: '8', tone: 'epic' }
    ]
  })
  expect(set.groups.map((group) => group.cells.map((cell) => cell.tone))).toEqual([
    ['primordial'],
    ['epic', 'epic', 'epic', 'epic', 'epic'],
    ['primordial', 'primordial', 'primordial'],
    ['epic', 'epic', 'epic']
  ])

  // 세트에 속했지만 희귀도를 모르는 부위는 빈 칸과 구분해 `unknown`으로 칠한다.
  const unknownSlot = toEquipmentFace({
    ...dealerCard,
    set: {
      ...dealerCard.set!,
      slots: [{ slotId: 'SHOULDER', rarity: null }]
    }
  }).set
  expect(unknownSlot.groups[1].cells.map((cell) => cell.tone)).toEqual([
    'unknown',
    'empty',
    'empty',
    'empty',
    'empty'
  ])

  // 세트가 없어도 무기 칸은 장착한 무기의 희귀도를 보인다.
  const withoutSet = toEquipmentFace({ ...dealerCard, set: null }).set
  expect(withoutSet).toMatchObject({ missing: true, point: '-', counts: [], imageUrl: undefined })
  expect(withoutSet.groups[0].cells[0].tone).toBe('primordial')
  expect(
    withoutSet.groups
      .slice(1)
      .flatMap((group) => group.cells)
      .every((cell) => cell.tone === 'empty')
  ).toBe(true)
})

it('서약 섹션은 세트 옵션 이름과 서약 세트 포인트, 본체와 결정 11칸의 격자를 보이고 서약이 없으면 비운다', () => {
  const { oath } = toEquipmentFace(bufferCard)
  expect(oath).toMatchObject({
    missing: false,
    name: '행운 : 일궈낸 운명',
    imageLabel: '영원불변의 행운 서약',
    point: '1,315',
    counts: [
      { label: '레전더리', count: '4', tone: 'legendary' },
      { label: '유니크', count: '7', tone: 'unique' }
    ]
  })
  expect(oath.groups.map((group) => group.cells.length)).toEqual([1, 3, 8])
  expect(oath.groups[0].cells[0].tone).toBe('primordial')
  expect(oath.groups[1].cells.map((cell) => cell.tone)).toEqual(['unique', 'legendary', 'unique'])
  // 업그레이드가 없는 서약은 묵언의 진의 9칸이 모두 비어 있다.
  expect(oath.upgrades.flat().map((cell) => cell.label)).toEqual([
    '1단계 비어 있음',
    '2단계 비어 있음',
    '3단계 비어 있음',
    '4단계 비어 있음',
    '5단계 비어 있음',
    '6단계 비어 있음',
    '7단계 비어 있음',
    '8단계 비어 있음',
    '9단계 비어 있음'
  ])

  const missing = toEquipmentFace({ ...bufferCard, oath: null }).oath
  expect(missing).toMatchObject({ missing: true, name: '서약 정보 없음', point: '-' })
  expect(
    missing.groups.flatMap((group) => group.cells).every((cell) => cell.tone === 'empty')
  ).toBe(true)
})

it('묵언의 진의 7단계까지 연 서약은 앞 넷, 뒤 다섯 묶음의 일곱 칸을 옵션 이름으로 채우고 두 칸을 비운다', () => {
  const oath = dealerCard.oath!
  const card: CharacterCard = {
    ...dealerCard,
    oath: { ...oath, upgrades: oath.upgrades.filter((upgrade) => upgrade.step <= 7) }
  }
  const { upgrades } = toEquipmentFace(card).oath
  expect(upgrades.map((group) => group.length)).toEqual([4, 5])
  expect(upgrades.flat()).toEqual([
    { filled: true, label: '1단계 강인한 통찰' },
    { filled: true, label: '2단계 포용의 권능' },
    { filled: true, label: '3단계 심연의 고동' },
    { filled: true, label: '4단계 신념의 대가' },
    { filled: true, label: '5단계 이어진 걸음' },
    { filled: true, label: '6단계 영원의 궤적' },
    { filled: true, label: '7단계 만물의 흐름' },
    { filled: false, label: '8단계 비어 있음' },
    { filled: false, label: '9단계 비어 있음' }
  ])
})

it('기타 면은 강화와 증폭을 종류로 구분하고 등급표에 없는 마법부여를 기타로 바꾸지 않는다', () => {
  const rows = toInvestmentRows(dealerCard)
  expect(rows.map((row) => row.slotId)).toEqual([
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
  ])
  expect(rows[0]).toEqual({
    slotId: 'WEAPON',
    itemName: '검은 질병의 멸룡검 발뭉',
    itemLabel: '무기, 검은 질병의 멸룡검 발뭉',
    itemTone: 'primordial',
    imageUrl: 'https://img-api.neople.co.kr/df/items/4f7c8199cd7a85492e985ebb5daa2da8',
    reinforce: { text: '+13', tone: 'enhance', label: '강화 13' },
    enchant: { grade: '종결', filled: 3, label: '마법부여 종결' }
  })
  expect(rows[6].reinforce).toEqual({ text: '+10', tone: 'amplify', label: '증폭 10' })
  expect(rows[1].enchant).toEqual({ grade: '준종결', filled: 2, label: '마법부여 준종결' })
  expect(rows[3].enchant).toEqual({ grade: '기타', filled: 1, label: '마법부여 기타' })
  // 마법부여는 있지만 판정 기준이 없는 부위는 미평가 `-`다.
  expect(rows[9].enchant).toEqual({ grade: null, text: '-', label: '마법부여 미평가' })
})

it('API 응답 fixture의 카드 값으로 세 면을 채우고 엔진이 채우기 전의 점수는 비우고 순위는 -로 둔다', () => {
  // 옮긴 사본이 API fixture의 card와 같아야 계약 교차 확인이 유효하다.
  expect(apiDealerCard).toEqual(apiDealerFixture.card)
  expect(apiBufferCard).toEqual(apiBufferFixture.card)

  const dealer = toCharacterFace(apiDealerCard, 'long')
  expect(dealer.stats.map((stat) => stat.label)).toEqual([
    '공격력 증가',
    '공격력 증폭',
    '크리티컬',
    '스위칭'
  ])
  expect(dealer.stats[1]).toEqual({ label: '공격력 증폭', value: '73', unit: '%' })
  expect(dealer.score).toEqual({ value: null, description: undefined })
  expect(dealer.serverRank).toEqual({ text: '-', label: '서버 순위 없음' })
  expect(toCharacterFace(apiBufferCard, 'long').stats[0]).toEqual({
    label: '마을 지능',
    value: '5,847',
    unit: ''
  })

  const { set, oath } = toEquipmentFace(apiDealerCard)
  expect(set).toMatchObject({ missing: false, name: '로열 페어리 세트', point: '2,615' })
  expect(oath).toMatchObject({ missing: false, imageLabel: '세계를 태우는 용투 서약' })
  // 업그레이드 없는 서약은 묵언의 진의가 모두 비어 있다.
  expect(
    toEquipmentFace(apiBufferCard)
      .oath.upgrades.flat()
      .every((cell) => !cell.filled)
  ).toBe(true)

  const rows = toInvestmentRows(apiDealerCard)
  expect(rows).toHaveLength(12)
  expect(rows.every((row) => row.itemTone !== 'missing')).toBe(true)
  // API 등급표에 있는 마법부여만 등급이 있고, 표에 없는 마법부여는 기타로 바꾸지 않고 미평가 `-`로 둔다.
  expect(rows.map((row) => [row.slotId, row.enchant.grade])).toEqual([
    ['WEAPON', null],
    ['JACKET', null],
    ['SHOULDER', '종결'],
    ['PANTS', null],
    ['WAIST', '종결'],
    ['SHOES', '준종결'],
    ['AMULET', '종결'],
    ['WRIST', null],
    ['RING', '종결'],
    ['SUPPORT', null],
    ['MAGIC_STON', '준종결'],
    ['EARRING', null]
  ])
  expect(rows[2].enchant).toEqual({ grade: '종결', filled: 3, label: '마법부여 종결' })
  expect(rows[5].enchant).toEqual({ grade: '준종결', filled: 2, label: '마법부여 준종결' })
  expect(rows[0].enchant).toEqual({ grade: null, text: '-', label: '마법부여 미평가' })
  expect(toInvestmentRows(apiBufferCard).map((row) => row.enchant.grade)).toEqual([
    '종결',
    '종결',
    '종결',
    null,
    '종결',
    '준종결',
    '준종결',
    '준종결',
    '종결',
    '종결',
    '준종결',
    null
  ])
})

it('희귀도 이름을 색 토큰 키로 바꾸고 단계가 붙은 이름과 모르는 이름을 구분한다', () => {
  expect(toRarityTone('태초')).toBe('primordial')
  expect(toRarityTone('유니크 Ⅱ')).toBe('unique')
  expect(toRarityTone('신화')).toBe('unknown')
  expect(toRarityTone(null)).toBe('unknown')
  expect(toRarityTone('constructor')).toBe('unknown')
})

it('합성 미리보기가 준 itemId별 로컬 그림만 쓰고 나머지 그림은 고정 origin URL로 둔다', () => {
  const local = '/assets/item-20.png'
  const { set, oath } = toEquipmentFace(dealerCard, { [dealerCard.oath!.itemId]: local })
  expect(oath.imageUrl).toBe(local)
  expect(set.imageUrl).toBe(
    'https://img-api.neople.co.kr/df/items/2d23a5dc389016bdc3a3e3fd142b38ce'
  )
  // 기타 면 아이콘도 주입한 그림이 있는 부위만 로컬 그림을 쓴다.
  const weaponId = dealerCard.investment[0].itemId!
  const rows = toInvestmentRows(dealerCard, { [weaponId]: local })
  expect(rows[0].imageUrl).toBe(local)
  expect(rows[1].imageUrl).toBe(
    'https://img-api.neople.co.kr/df/items/2d23a5dc389016bdc3a3e3fd142b38ce'
  )
  // 장착하지 않은 부위는 아이템 식별자가 없어 그림 없이 빈 칸으로 둔다.
  const empty = toInvestmentRows({
    ...dealerCard,
    investment: dealerCard.investment.map((row, index) =>
      index === 0 ? { ...row, itemId: null, itemName: null, rarity: null } : row
    )
  })
  expect(empty[0]).toMatchObject({ itemTone: 'missing', imageUrl: undefined })
  // 객체의 상속 키는 주입한 그림으로 보지 않는다.
  const inherited = toEquipmentFace(
    { ...dealerCard, oath: { ...dealerCard.oath!, itemId: 'toString' } },
    {}
  )
  expect(inherited.oath.imageUrl).toBe('https://img-api.neople.co.kr/df/items/toString')
})

it('아이템 이미지는 검증한 식별자로만 고정 origin URL을 만든다', () => {
  expect(itemImageUrl('15a42c9cfd0709f609b22bb590f0a1e8')).toBe(
    'https://img-api.neople.co.kr/df/items/15a42c9cfd0709f609b22bb590f0a1e8'
  )
  expect(itemImageUrl('../servers/cain')).toBeUndefined()
  expect(itemImageUrl('https://example.com/a.png')).toBeUndefined()
  expect(itemImageUrl('')).toBeUndefined()
  expect(itemImageUrl(null)).toBeUndefined()
})
