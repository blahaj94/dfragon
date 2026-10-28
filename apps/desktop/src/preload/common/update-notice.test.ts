import { expect, it } from 'vitest'
import { parseUpdateNoticeSnapshot } from './update-notice'

const notice = { tag: 'v0.0.4-beta.1' }

it.each([
  ['알림 없음', { revision: 0, notice: null }],
  ['처음 revision의 알림', { revision: 0, notice }],
  ['안전한 최대 revision', { revision: Number.MAX_SAFE_INTEGER, notice }]
])('%s 상태를 받는다', (_name, value) => {
  expect(parseUpdateNoticeSnapshot(value)).toEqual(value)
})

it.each([
  ['음수 revision', { revision: -1, notice: null }],
  ['소수 revision', { revision: 0.5, notice: null }],
  ['안전하지 않은 revision', { revision: Number.MAX_SAFE_INTEGER + 1, notice: null }],
  ['NaN revision', { revision: Number.NaN, notice: null }],
  ['문자 revision', { revision: '0', notice: null }],
  ['revision 누락', { notice: null }],
  ['notice 누락', { revision: 0 }],
  ['revision 대신 다른 필드', { version: 0, notice: null }],
  ['추가 필드', { revision: 0, notice: null, raw: 'synthetic' }],
  ['배열', Object.assign([], { revision: 0, notice: null })],
  ['null', null],
  ['undefined', undefined],
  ['undefined 알림', { revision: 0, notice: undefined }],
  ['빈 알림', { revision: 0, notice: {} }],
  ['tag 대신 다른 필드', { revision: 0, notice: { url: 'https://example.test/' } }],
  ['추가 필드가 있는 알림', { revision: 0, notice: { ...notice, url: 'https://example.test/' } }],
  ['배열 알림', { revision: 0, notice: [notice.tag] }],
  ['Release tag가 아닌 알림', { revision: 0, notice: { tag: '0.0.4' } }],
  ['문자열이 아닌 tag', { revision: 0, notice: { tag: 4 } }]
])('%s 상태를 거절한다', (_name, value) => {
  expect(parseUpdateNoticeSnapshot(value)).toBeNull()
})
