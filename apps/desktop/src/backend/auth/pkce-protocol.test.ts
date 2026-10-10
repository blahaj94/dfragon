import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { createPkce, isCanonicalOpaque } from './pkce'
import {
  AuthProtocolFailure,
  parseReturnUrl,
  validateApiOrigin,
  validateBrowserLaunchUrl,
  validateLoopbackReturnUrl
} from './protocol'
import { API_ORIGIN, CODE, RETURN_TARGET } from './auth-test-fixtures'

describe('Desktop auth PKCE와 URL 경계', () => {
  it.each([
    {
      name: 'API origin',
      validate: () => validateApiOrigin('https://example.test/'),
      laterGetter: 'pathname'
    }
  ])(
    '$name: username 실패 뒤 password를 건너뛰고 이후 getter를 평가한다',
    ({ validate, laterGetter }) => {
      const access: string[] = []
      class ObservedUrl {
        protocol = 'https:'
        username = 'user'
        get password(): string {
          access.push('password')
          throw new Error('password must be skipped')
        }
        get pathname(): string {
          access.push('pathname')
          throw new Error('sentinel later getter')
        }
        search = ''
        hash = ''
        origin = 'https://example.test'
      }
      vi.stubGlobal('URL', ObservedUrl)

      try {
        expect(validate).toThrow('sentinel later getter')
        expect(access).toEqual([laterGetter])
      } finally {
        vi.unstubAllGlobals()
      }
    }
  )

  it('non-string Proxy는 URL 내부 접근 없이 AuthProtocolFailure로 거절한다', () => {
    const value = new Proxy(
      {},
      {
        get: () => {
          throw new Error('unexpected get')
        },
        has: () => {
          throw new Error('unexpected has')
        }
      }
    )

    expect(() => validateApiOrigin(value as unknown as string)).toThrow(AuthProtocolFailure)
  })

  it.each([null, undefined, 42, true, {}, new String('A'.repeat(43))])(
    '문자열이 아닌 PKCE 입력 %p를 정규식과 coercion 없이 거절한다',
    (value) => {
      expect(isCanonicalOpaque(value)).toBe(false)
    }
  )

  it('문자열이 아닌 Proxy 입력은 내부 접근 없이 거절한다', () => {
    const value = new Proxy(
      {},
      {
        get: () => {
          throw new Error('unexpected get')
        },
        has: () => {
          throw new Error('unexpected has')
        }
      }
    )

    expect(isCanonicalOpaque(value)).toBe(false)
  })

  it('로그인마다 독립된 32-byte verifier와 ASCII S256 challenge를 만든다', () => {
    const firstBytes = Buffer.alloc(32, 1)
    const secondBytes = Buffer.alloc(32, 2)
    const bytes = vi.fn().mockReturnValueOnce(firstBytes).mockReturnValueOnce(secondBytes)

    const first = createPkce(bytes)
    const second = createPkce(bytes)

    expect(first.verifier).toBe(firstBytes.toString('base64url'))
    expect(first.verifier).toHaveLength(43)
    expect(first.challenge).toBe(
      createHash('sha256').update(first.verifier, 'ascii').digest('base64url')
    )
    expect(second.verifier).not.toBe(first.verifier)
    expect(bytes).toHaveBeenNthCalledWith(1, 32)
    expect(bytes).toHaveBeenNthCalledWith(2, 32)
  })

  it('정확한 API origin, path와 canonical ticket인 browser URL만 허용한다', () => {
    const ticket = Buffer.alloc(32, 8).toString('base64url')
    const valid = `${API_ORIGIN}/auth/login/authorize?ticket=${ticket}`

    expect(validateBrowserLaunchUrl(valid, API_ORIGIN)).toBe(valid)
    expect(() => validateBrowserLaunchUrl(`${valid}&next=/capture`, API_ORIGIN)).toThrow()
    expect(() =>
      validateBrowserLaunchUrl(valid.replace('api.', 'api.attacker.'), API_ORIGIN)
    ).toThrow()
    expect(() => validateBrowserLaunchUrl(valid.replace('https:', 'http:'), API_ORIGIN)).toThrow()
    expect(() =>
      validateBrowserLaunchUrl(valid.replace(ticket, `${ticket}=`), API_ORIGIN)
    ).toThrow()
    expect(() => validateBrowserLaunchUrl(`${valid}&ticket=${ticket}`, API_ORIGIN)).toThrow(
      'Authentication URL is invalid.'
    )
  })

  it('등록 target의 code 하나인 canonical 복귀 URL만 반환한다', () => {
    const valid = `${RETURN_TARGET}?code=${CODE}`

    expect(parseReturnUrl(valid, RETURN_TARGET)).toEqual({ code: CODE })
    expect(() => parseReturnUrl(`${valid}&state=leaked`, RETURN_TARGET)).toThrow()
    expect(() =>
      parseReturnUrl(`${RETURN_TARGET}?code=${CODE}&code=${CODE}`, RETURN_TARGET)
    ).toThrow()
    expect(() => parseReturnUrl(valid.replace('callback', 'other'), RETURN_TARGET)).toThrow()
    expect(() => parseReturnUrl(`${valid}#fragment`, RETURN_TARGET)).toThrow()
    expect(() => parseReturnUrl(`${valid} `, RETURN_TARGET)).toThrow()
    expect(() =>
      parseReturnUrl(`${RETURN_TARGET}?code=${CODE.slice(0, -1)}`, RETURN_TARGET)
    ).toThrow()
    expect(() => parseReturnUrl(`${valid.replace(CODE, `${CODE}=`)}`, RETURN_TARGET)).toThrow(
      'Authentication URL is invalid.'
    )
  })

  it('기대 복귀 주소를 생략하면 입력 URL의 port를 신뢰하지 않고 거절한다', () => {
    expect(() =>
      Reflect.apply(parseReturnUrl, undefined, [`${RETURN_TARGET}?code=${CODE}`])
    ).toThrow(AuthProtocolFailure)
  })

  it.each([
    'http://127.0.0.1:1024/auth/callback',
    'http://127.0.0.1:65535/auth/callback',
    RETURN_TARGET
  ])('임시 포트의 정확한 loopback target %s만 허용한다', (target) => {
    expect(validateLoopbackReturnUrl(target)).toBe(target)
    expect(parseReturnUrl(`${target}?code=${CODE}`, target)).toEqual({ code: CODE })
  })

  it.each([
    'http://127.0.0.1/auth/callback',
    'http://127.0.0.1:1023/auth/callback',
    'http://127.0.0.1:65536/auth/callback',
    'http://127.0.0.1:049152/auth/callback',
    'https://127.0.0.1:49152/auth/callback',
    'http://localhost:49152/auth/callback',
    'http://[::1]:49152/auth/callback',
    'http://127.1:49152/auth/callback',
    'http://2130706433:49152/auth/callback',
    'http://0.0.0.0:49152/auth/callback',
    'http://user@127.0.0.1:49152/auth/callback',
    'http://127.0.0.1:49152/auth/../auth/callback',
    'http://127.0.0.1:49152/auth/%63allback',
    'http://127.0.0.1:49152/auth/callback/',
    'dfragon://auth/callback',
    `${RETURN_TARGET}?`,
    `${RETURN_TARGET}#`,
    `${RETURN_TARGET} `
  ])('alias나 범위를 벗어난 target %s를 거절한다', (target) => {
    expect(() => validateLoopbackReturnUrl(target)).toThrow(AuthProtocolFailure)
    expect(() => parseReturnUrl(`${target}?code=${CODE}`, target)).toThrow(AuthProtocolFailure)
  })

  it.each([
    `http://127.0.0.1:49153/auth/callback?code=${CODE}`,
    `${RETURN_TARGET}?%63ode=${CODE}`,
    `${RETURN_TARGET}?code=${CODE}&state=extra`,
    `${RETURN_TARGET}?code=${CODE}&code=${CODE}`,
    `${RETURN_TARGET}?code=%41${CODE.slice(1)}`,
    `${RETURN_TARGET}?code=${CODE}#`,
    `${RETURN_TARGET}?code=${CODE}\n`,
    `${RETURN_TARGET.replace('/auth/', '/auth\\')}?code=${CODE}`
  ])('다른 포트, query alias, 구분자를 보정하지 않는다: %s', (raw) => {
    expect(() => parseReturnUrl(raw, RETURN_TARGET)).toThrow(AuthProtocolFailure)
  })
})
