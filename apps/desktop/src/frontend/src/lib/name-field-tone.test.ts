import { expect, it } from 'vitest'
import { toNameFieldTone } from './name-field-tone'

it('toNameFieldTone은 편집과 실패를 먼저, 대기 중 빈 슬롯은 vacant로 정한다', () => {
  expect(toNameFieldTone('selected', 'idle')).toBe('selected')
  expect(toNameFieldTone('failure', 'empty')).toBe('failure')
  expect(toNameFieldTone('waiting', 'idle')).toBe('vacant')
  expect(toNameFieldTone('waiting', 'waiting-portrait')).toBe('waiting')
  expect(toNameFieldTone('waiting', 'pending')).toBe('waiting')
  expect(toNameFieldTone('default', 'success')).toBe('default')
})
