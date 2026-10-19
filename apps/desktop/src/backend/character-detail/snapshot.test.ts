import { describe, expect, it } from 'vitest'
import { CHARACTER_DETAIL_ITEM_TEXT_MAX_LENGTH } from '../../preload/common/character-detail'
import type { CharacterDetails, CharacterJsonValue } from '../../preload/common/types/character'
import { createCharacterDetailSnapshot } from './snapshot'

function details(): CharacterDetails {
  return {
    character: {
      serverId: 'cain',
      characterId: 'character-1',
      characterName: '가나',
      serverName: '카인',
      adventureName: '모험단',
      jobName: '귀검사',
      jobGrowName: '웨펀마스터',
      level: 115,
      fame: 71000,
      guildName: '길드'
    },
    status: { status: [{ name: '힘', value: 100 }], buff: null },
    equipment: { equipment: [{ itemId: 'equipment-1' }], setItemInfo: [] },
    avatar: [{ itemId: 'avatar-1' }],
    creature: { itemId: 'creature-1' },
    oath: null,
    mistAssimilation: null,
    skillStyle: null,
    buff: { equipment: null, avatar: null, creature: null },
    sections: {},
    freshness: {
      lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z',
      expiresAt: '2026-10-07T00:05:00.000Z'
    }
  }
}

type JsonObject = { readonly [key: string]: CharacterJsonValue }

// API가 장착 아이템에 붙이는 아이템 상세. `data`는 같은 itemId의 Neople 아이템 응답 원문이다.
function itemDetail(
  itemId: string,
  fields: JsonObject | null,
  status = 'fresh'
): CharacterJsonValue {
  const data = fields === null ? null : { itemId, ...fields }
  const fetchedAt = fields === null ? null : '2026-10-07T00:00:00.000Z'

  return { data, fetchedAt, status }
}

function equipped(
  slotId: string | null,
  itemId: string,
  fields: JsonObject | null,
  status?: string
): JsonObject {
  const item = { itemId, itemName: itemId, itemDetail: itemDetail(itemId, fields, status) }
  if (slotId === null) {
    return item
  }

  return { slotId, ...item }
}

describe('캐릭터 상세 창 snapshot', () => {
  it('기본 정보, 길드와 조회 시각, 카드 값만 담고 상세 응답의 원문 섹션은 전달하지 않는다', () => {
    const snapshot = createCharacterDetailSnapshot(details(), null)

    expect(snapshot).toEqual({
      character: {
        serverId: 'cain',
        characterId: 'character-1',
        characterName: '가나',
        serverName: '카인',
        adventureName: '모험단',
        jobName: '귀검사',
        jobGrowName: '웨펀마스터',
        level: 115,
        fame: 71000,
        imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/character-1?zoom=1',
        guildName: '길드'
      },
      card: null,
      itemTexts: {},
      skills: null,
      freshness: {
        lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z',
        expiresAt: '2026-10-07T00:05:00.000Z'
      }
    })
  })

  it.each([null, 0])('명성과 레벨 %s를 다른 표시값으로 대체하지 않는다', (value) => {
    const source = details()
    const snapshot = createCharacterDetailSnapshot(
      {
        ...source,
        character: { ...source.character, fame: value, level: value, adventureName: null }
      },
      null
    )

    expect(snapshot.character).toMatchObject({ fame: value, level: value, adventureName: null })
  })

  it('선택적 필드가 없거나 표시 타입이 아니면 null로 남긴다', () => {
    const source = details()
    const snapshot = createCharacterDetailSnapshot(
      {
        ...source,
        character: {
          serverId: 'cain',
          characterId: 'character-1',
          characterName: '가나',
          serverName: '카인',
          jobName: {},
          jobGrowName: [],
          level: '115',
          fame: Number.NaN,
          guildName: 7
        }
      },
      null
    )

    expect(snapshot.character).toMatchObject({
      guildName: null,
      adventureName: null,
      jobName: null,
      jobGrowName: null,
      level: null,
      fame: null
    })
  })

  it('12부위와 서약 본체, 결정의 아이템 상세에서 설명, 버프 스킬, 플레이버 문구만 골라 담는다', () => {
    const source = details()
    const snapshot = createCharacterDetailSnapshot(
      {
        ...source,
        equipment: {
          equipment: [
            equipped('WEAPON', 'weapon', {
              itemExplain: '[용을 베는 자]\n모든 속도 +20%',
              itemExplainDetail: '상세 설명',
              itemBuff: { explain: '30레벨 버프 스킬 Lv +3', reinforceSkill: [] },
              itemFlavorText: '그 피로 세상을 멸할 힘을 얻는다.',
              itemName: '멸룡검 발뭉'
            }),
            equipped('WEAPON', 'second-weapon', { itemExplain: '같은 부위의 두 번째 항목' }),
            equipped('TITLE', 'title', { itemExplain: '칭호 설명' }),
            equipped('JACKET', 'jacket', { itemExplain: ' ', itemBuff: null, itemFlavorText: '' })
          ],
          setItemInfo: []
        },
        oath: {
          info: equipped(null, 'oath', { itemFlavorText: '서약 플레이버' }),
          crystal: [
            { slotNo: 0, ...equipped(null, 'crystal-0', { itemExplain: '결정 설명' }) },
            { slotNo: 11, ...equipped(null, 'crystal-11', { itemExplain: '자리 밖 결정' }) }
          ]
        }
      },
      null
    )

    expect(snapshot.itemTexts).toEqual({
      weapon: {
        explain: '[용을 베는 자]\n모든 속도 +20%',
        buff: '30레벨 버프 스킬 Lv +3',
        flavor: '그 피로 세상을 멸할 힘을 얻는다.'
      },
      jacket: { explain: null, buff: null, flavor: null },
      oath: { explain: null, buff: null, flavor: '서약 플레이버' },
      'crystal-0': { explain: '결정 설명', buff: null, flavor: null }
    })
  })

  it('아이템 상세를 받지 못했거나 다른 아이템을 가리키면 설명 문구를 담지 않는다', () => {
    const source = details()
    const text = { itemExplain: '설명' }
    const snapshot = createCharacterDetailSnapshot(
      {
        ...source,
        equipment: {
          equipment: [
            equipped('WEAPON', 'weapon', null, 'unavailable'),
            equipped('JACKET', 'jacket', text, 'stale'),
            { slotId: 'PANTS', itemId: 'pants', itemDetail: itemDetail('other', text) },
            { slotId: 'WAIST', itemId: '../waist', itemDetail: itemDetail('../waist', text) },
            equipped('SHOES', 'shoes', text, 'unavailable'),
            { slotId: 'AMULET', itemId: 'amulet' }
          ],
          setItemInfo: []
        }
      },
      null
    )

    expect(snapshot.itemTexts).toEqual({ jacket: { explain: '설명', buff: null, flavor: null } })
  })

  it('12부위, 서약 본체, 결정 11칸이 모두 다른 아이템이어도 상세 preload가 받는 개수 안이다', () => {
    const source = details()
    const slots = ['WEAPON', 'JACKET', 'SHOULDER', 'PANTS', 'WAIST', 'SHOES']
    const accessories = ['AMULET', 'WRIST', 'RING', 'SUPPORT', 'MAGIC_STON', 'EARRING']
    const text = { itemExplain: '설명' }
    const snapshot = createCharacterDetailSnapshot(
      {
        ...source,
        equipment: {
          equipment: [...slots, ...accessories].map((slotId) => equipped(slotId, slotId, text)),
          setItemInfo: []
        },
        oath: {
          info: equipped(null, 'oath', text),
          crystal: Array.from({ length: 11 }, (_, slotNo) => ({
            slotNo,
            ...equipped(null, `crystal-${slotNo}`, text)
          }))
        }
      },
      null
    )

    expect(Object.keys(snapshot.itemTexts)).toHaveLength(24)
  })

  it('상세 창이 받는 길이를 넘는 문구는 없는 값으로 둔다', () => {
    const source = details()
    const limit = 'a'.repeat(CHARACTER_DETAIL_ITEM_TEXT_MAX_LENGTH)
    const snapshot = createCharacterDetailSnapshot(
      {
        ...source,
        equipment: {
          equipment: [
            equipped('WEAPON', 'weapon', { itemExplain: limit, itemFlavorText: `${limit}a` })
          ],
          setItemInfo: []
        }
      },
      null
    )

    expect(snapshot.itemTexts.weapon).toEqual({ explain: limit, buff: null, flavor: null })
  })

  // API 상세 응답의 스킬 스타일. `style`은 Neople 스킬 스타일 원문, `skillDetails`는 API가 붙인 공용 상세다.
  function withSkills(style: JsonObject, skillDetails: JsonObject): CharacterDetails {
    const source = details()

    return {
      ...source,
      character: { ...source.character, jobId: 'job-1', jobGrowId: 'grow-1' },
      skillStyle: { hash: 'hash', style, skillDetails }
    }
  }

  function skillDetail(data: JsonObject | null, status = 'fresh'): CharacterJsonValue {
    const fetchedAt = data === null ? null : '2026-10-07T00:00:00.000Z'

    return { data, fetchedAt, status }
  }

  const levelRows = [
    { level: 59, coolTime: 6.5 },
    { level: 60, coolTime: 6 }
  ]

  it('습득, 패시브 스킬의 레벨과 공용 상세의 설명, 현재 레벨 쿨타임, VP 이름과 고른 VP를 담는다', () => {
    const snapshot = createCharacterDetailSnapshot(
      withSkills(
        {
          active: [{ skillId: 'active-1', name: '귀참', level: 60, requiredLevel: 1 }],
          passive: [{ skillId: 'passive-1', name: '검기상인', level: 5, requiredLevel: 20 }],
          evolution: [{ skillId: 'active-1', type: 2 }],
          enhancement: [],
          chain: null
        },
        {
          'active-1': skillDetail({
            name: '귀참',
            desc: '전방을 벤다.\n\n[충전 시]\n더 넓게 벤다.',
            levelInfo: { optionDesc: '', rows: levelRows },
            evolution: [
              { type: 2, name: '두 번째 진화' },
              { type: 1, name: '첫 번째 진화' },
              { type: 3, name: ' ' }
            ]
          }),
          'passive-1': skillDetail({ name: '검기상인', desc: '', levelInfo: { rows: [] } })
        }
      ),
      null
    )

    expect(snapshot.skills).toEqual({
      jobId: 'job-1',
      jobGrowId: 'grow-1',
      learned: {
        'active-1': {
          name: '귀참',
          level: 60,
          description: '전방을 벤다.\n\n[충전 시]\n더 넓게 벤다.',
          coolTime: 6,
          vpNames: ['첫 번째 진화', '두 번째 진화'],
          vpName: '두 번째 진화'
        },
        'passive-1': {
          name: '검기상인',
          level: 5,
          description: null,
          coolTime: null,
          vpNames: [],
          vpName: null
        }
      }
    })
  })

  it.each([
    ['unavailable 상태', skillDetail(null, 'unavailable')],
    ['data가 없는', skillDetail(null)],
    ['모르는 상태', skillDetail({ desc: '설명', levelInfo: { rows: levelRows } }, 'pending')]
  ])('공용 상세가 %s 스킬은 이름과 레벨만 담는다', (_, detail) => {
    const snapshot = createCharacterDetailSnapshot(
      withSkills(
        {
          active: [{ skillId: 'active-1', name: '귀참', level: 60 }],
          evolution: [{ skillId: 'active-1', type: 1 }]
        },
        { 'active-1': detail }
      ),
      null
    )

    expect(snapshot.skills?.learned['active-1']).toEqual({
      name: '귀참',
      level: 60,
      description: null,
      coolTime: null,
      vpNames: [],
      vpName: null
    })
  })

  it('stale 상세도 이전 저장값이므로 쓰고, 쿨타임이 음수이거나 숫자가 아니면 없는 값이다', () => {
    const snapshot = createCharacterDetailSnapshot(
      withSkills(
        {
          active: [
            { skillId: 'stale', name: '스테일', level: 1 },
            { skillId: 'negative', name: '음수', level: 1 },
            { skillId: 'text', name: '문자열', level: 1 }
          ]
        },
        {
          stale: skillDetail(
            { desc: '설명', levelInfo: { rows: [{ level: 1, coolTime: 0 }] } },
            'stale'
          ),
          negative: skillDetail({ levelInfo: { rows: [{ level: 1, coolTime: -1 }] } }),
          text: skillDetail({ levelInfo: { rows: [{ level: 1, coolTime: '5' }] } })
        }
      ),
      null
    )

    expect(snapshot.skills?.learned.stale).toMatchObject({ description: '설명', coolTime: 0 })
    expect(snapshot.skills?.learned.negative.coolTime).toBeNull()
    expect(snapshot.skills?.learned.text.coolTime).toBeNull()
  })

  it('이름이나 레벨이 틀린 항목과 잘못된 skillId는 빼고, 같은 skillId는 처음 항목을 쓴다', () => {
    const snapshot = createCharacterDetailSnapshot(
      withSkills(
        {
          active: [
            { skillId: 'skill-1', name: '처음', level: 3 },
            { skillId: 'no-name', name: ' ', level: 1 },
            { skillId: 'bad-level', name: '레벨', level: 1.5 },
            { skillId: '../escape', name: '경로', level: 1 },
            null
          ],
          passive: [{ skillId: 'skill-1', name: '나중', level: 9 }]
        },
        {}
      ),
      null
    )

    expect(snapshot.skills?.learned).toEqual({
      'skill-1': {
        name: '처음',
        level: 3,
        description: null,
        coolTime: null,
        vpNames: [],
        vpName: null
      }
    })
  })

  it.each([
    ['직업 ID가 없는', { jobId: null }, { active: [] }],
    ['전직 ID가 문자열이 아닌', { jobGrowId: 7 }, { active: [] }],
    ['스킬 스타일 style이 없는', {}, null]
  ])('%s 캐릭터는 스킬 탭 값을 null로 둔다', (_, character, style) => {
    const source = withSkills(style ?? {}, {})
    const snapshot = createCharacterDetailSnapshot(
      {
        ...source,
        character: { ...source.character, ...character },
        skillStyle: style === null ? { hash: 'hash' } : source.skillStyle
      },
      null
    )

    expect(snapshot.skills).toBeNull()
  })

  it('원본 객체의 후속 변경이 이미 만든 snapshot을 바꾸지 않는다', () => {
    const source = details()
    const snapshot = createCharacterDetailSnapshot(source, null)
    Object.assign(source.character, { characterName: '변경됨' })
    Object.assign(source.freshness, { expiresAt: '2026-10-07T01:00:00.000Z' })

    expect(snapshot.character.characterName).toBe('가나')
    expect(snapshot.freshness.expiresAt).toBe('2026-10-07T00:05:00.000Z')
  })
})
