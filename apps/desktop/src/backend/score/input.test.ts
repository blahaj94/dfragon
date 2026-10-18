import { describe, expect, it } from 'vitest'
import { apiDetailsFromEngineInput, readEngineInput } from './details-test-fixture'
import { toScoreEngineInput } from './input'

// API는 장착 장비의 engrave에는 itemDetail을 붙이지 않으므로 그 아이템 상세는 엔진 입력에 들어가지 않는다.
function engraveOnlyItemIds(input: ReturnType<typeof readEngineInput>): string[] {
  const equipment = input.equipment.equipment
  if (!Array.isArray(equipment)) {
    return []
  }

  return equipment.flatMap((item) => {
    const engrave =
      typeof item === 'object' && item !== null && 'engrave' in item ? item.engrave : null
    if (typeof engrave !== 'object' || engrave === null || !('itemId' in engrave)) {
      return []
    }

    if (typeof engrave.itemId !== 'string') {
      return []
    }

    return [engrave.itemId]
  })
}

describe('상세 응답을 점수 엔진 입력 문서로 바꾸기', () => {
  it.each(['dealer-blade', 'buffer-muse'] as const)(
    '%s 상세 응답의 10개 섹션을 Neople 원문 문서로 되돌리고 아이템 상세를 items로 옮긴다',
    (name) => {
      const original = readEngineInput(name)
      const details = apiDetailsFromEngineInput(original, null)

      const input = toScoreEngineInput(details)

      const { items, ...documents } = input
      const { items: originalItems, ...originalDocuments } = original
      expect(documents).toEqual(originalDocuments)
      const skipped = engraveOnlyItemIds(original)
      const expectedItems = Object.fromEntries(
        Object.entries(originalItems).filter(([itemId]) => !skipped.includes(itemId))
      )
      expect(items).toEqual(expectedItems)
      expect(JSON.stringify(input)).not.toContain('itemDetail')
      expect(JSON.stringify(input)).not.toContain('skillDetails')
    }
  )

  it('버퍼 벡터의 engrave 아이템은 API 상세가 없어 items에서 빠진다', () => {
    const original = readEngineInput('buffer-muse')

    const input = toScoreEngineInput(apiDetailsFromEngineInput(original, null))

    const [engraveId] = engraveOnlyItemIds(original)
    expect(engraveId).toBeDefined()
    expect(Object.hasOwn(original.items, engraveId)).toBe(true)
    expect(Object.hasOwn(input.items, engraveId)).toBe(false)
  })

  it('itemDetail의 data가 없거나 다른 itemId를 가리키면 items에 넣지 않고 장비 원문은 유지한다', () => {
    const original = readEngineInput('dealer-blade')
    const details = apiDetailsFromEngineInput(original, null)
    const [first, second, ...rest] = details.equipment.equipment as Record<string, unknown>[]
    const unavailable = {
      ...first,
      itemDetail: { data: null, fetchedAt: null, status: 'unavailable' }
    }
    const mismatched = {
      ...second,
      itemDetail: { data: { itemId: 'other' }, fetchedAt: null, status: 'fresh' }
    }
    const equipment = [unavailable, mismatched, ...rest] as typeof details.equipment.equipment

    const input = toScoreEngineInput({
      ...details,
      equipment: { ...details.equipment, equipment },
      // 같은 아이템이 버프 장착에도 있으면 그쪽 상세로 채워지므로 이 사례에서는 비운다.
      buff: { equipment: null, avatar: null, creature: null }
    })

    const firstId = first.itemId as string
    const secondId = second.itemId as string
    expect(input.items[firstId]).toBeUndefined()
    expect(input.items[secondId]).toBeUndefined()
    const restored = input.equipment.equipment as Record<string, unknown>[]
    expect(restored[0]).not.toHaveProperty('itemDetail')
    expect(restored[0].itemId).toBe(firstId)
    expect(input.buff_equip_equipment).toMatchObject({ skill: { buff: null } })
  })
})
