import { expect, it } from 'vitest'
import { oathIcon, setIcon } from './equipment-icons'

const sheet = { size: 28, sheetWidth: 448, sheetHeight: 140 }

// 기대값은 `@dfragon/icons/equipment.json`에서 직접 확인한 칸 번호(강림한 여우 서약 29, 레어 서약 44, 근원에 닿은
// 자연 서약 13, 레전더리 돌파하는 한계 서약 18, 에테리얼 오브 아츠 세트 10)와 한 줄 16칸, 칸 28px로 셈한 sprite
// 위치다. 첫 줄이 아니고 x와 y가 다른 서약이 있어 가로, 세로를 바꾸면 실패한다.
it.each([
  ['태초', '강림한 여우 서약', { x: 364, y: 28 }],
  ['레어', '서약 : 경계', { x: 336, y: 56 }],
  // 버프 아이콘 표시 전용 서약과 이름이 겹치던 장착 서약이다.
  ['태초', '근원에 닿은 자연 서약', { x: 364, y: 0 }],
  // PVF 희귀도 6이 레전더리다.
  ['레전더리', '돌파하는 한계 서약', { x: 56, y: 28 }]
])('%s %s 아이콘은 sprite의 정해진 칸이다', (rarity, name, cell) => {
  expect(oathIcon(rarity, name)).toMatchObject({ ...cell, ...sheet })
})

it('115 세트 아이콘은 네오플 setItemId로 찾는다', () => {
  expect(setIcon('93e7825053bdec4e0f4c12837cf4f57e')).toMatchObject({ x: 280, y: 0, ...sheet })
})

it('희귀도가 다르거나 모르는 서약, 115 세트가 아닌 세트는 아이콘이 없다', () => {
  expect(oathIcon('에픽', '강림한 여우 서약')).toBeUndefined()
  expect(oathIcon('에픽', '돌파하는 한계 서약')).toBeUndefined()
  expect(oathIcon(null, '강림한 여우 서약')).toBeUndefined()
  expect(oathIcon('태초', 'toString')).toBeUndefined()
  // 버프 아이콘 표시 전용 서약 아이템은 생성할 때 뺐다.
  expect(oathIcon('유니크', '어둠에 잠긴 그림자 서약')).toBeUndefined()
  expect(setIcon('be471bcc556f0c5f8b16c05f6eab1100')).toBeUndefined()
})

// Vitest는 asset을 인라인하지 않으므로 이 테스트는 sprite 파일 연결만 확인한다. 빌드에서 별도 파일로 나오는지는
// `?no-inline` import가 정한다.
it('sprite URL은 equipment.webp를 가리킨다', () => {
  expect(setIcon('93e7825053bdec4e0f4c12837cf4f57e')?.sprite).toMatch(/equipment\.webp/)
})
