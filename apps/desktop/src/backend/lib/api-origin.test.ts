import { describe, expect, it } from 'vitest'
import { ApiOriginFailure, validateApiOrigin } from './api-origin'

describe('검색 API origin 검사', () => {
  it('정규 HTTPS origin만 그대로 돌려준다', () => {
    expect(validateApiOrigin('https://api.example.test')).toBe('https://api.example.test')
    expect(validateApiOrigin('https://localhost:3443')).toBe('https://localhost:3443')
  })

  it.each([
    'http://api.example.test',
    'https://api.example.test/',
    'https://api.example.test/path',
    'https://api.example.test?query=1',
    'https://api.example.test#fragment',
    'https://user@api.example.test',
    'https://user:secret@api.example.test',
    'https://API.example.test',
    ' https://api.example.test',
    'https://api.example.test\\',
    `https://${'a'.repeat(2_048)}.test`,
    'not a url'
  ])('%s는 거절한다', (origin) => {
    expect(() => validateApiOrigin(origin)).toThrow(ApiOriginFailure)
  })

  it('문자열이 아닌 값은 내부 접근 없이 거절한다', () => {
    const value = new Proxy(
      {},
      {
        get: () => {
          throw new Error('unexpected get')
        }
      }
    )

    expect(() => validateApiOrigin(value as unknown as string)).toThrow(ApiOriginFailure)
  })
})
