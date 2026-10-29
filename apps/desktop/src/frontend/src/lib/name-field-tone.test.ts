import { expect, it } from 'vitest'
import { toNameFieldTone } from './name-field-tone'

it('toNameFieldTone은 편집과 실패를 그대로, 빈 슬롯의 대기 카드는 vacant로 정한다', () => {
  expect(toNameFieldTone('selected')).toBe('selected')
  expect(toNameFieldTone('failure')).toBe('failure')
  expect(toNameFieldTone('waiting')).toBe('vacant')
  expect(toNameFieldTone('default')).toBe('default')
  expect(toNameFieldTone('ranker')).toBe('default')
})
