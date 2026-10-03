import { describe, expect, it } from 'vitest'
import { AuthHttpFailure } from './http'
import { verificationFailureNotice } from './user-verification'

describe('복원 중 사용자 조회 오류 안내', () => {
  it.each([
    ['authentication-required', 'REAUTH_REQUIRED'],
    ['network', 'NETWORK_UNAVAILABLE'],
    ['unavailable', 'AUTH_SERVICE_UNAVAILABLE'],
    ['invalid-response', 'AUTH_SERVICE_UNAVAILABLE'],
    ['invalid-request', 'AUTH_SERVICE_UNAVAILABLE'],
    ['exchange-invalid', 'AUTH_SERVICE_UNAVAILABLE']
  ] as const)('%s 오류를 %s로 분류한다', (code, notice) => {
    expect(verificationFailureNotice(new AuthHttpFailure(code))).toBe(notice)
  })

  it.each([
    ['일반 예외', new Error('Synthetic transport failure')],
    ['오류 코드가 있는 외부 객체', { code: 'authentication-required' }],
    ['오류 값 없음', null]
  ])('%s를 인증 상실로 추정하지 않는다', (_caseName, error) => {
    expect(verificationFailureNotice(error)).toBe('AUTH_SERVICE_UNAVAILABLE')
  })
})
