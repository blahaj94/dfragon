import { expect, it } from 'vitest'
import { getRecognizedNicknames } from './recognized-nicknames'

it('인식한 슬롯만 이름을 돌려주고 나머지와 결과가 없는 슬롯은 null로 채운다', () => {
  expect(
    getRecognizedNicknames(
      [{ kind: 'recognized', nickname: '가' }, { kind: 'rejected' }, { kind: 'missing' }],
      4
    )
  ).toEqual(['가', null, null, null])
})
