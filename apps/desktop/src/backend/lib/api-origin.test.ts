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
    'https://api.example.test?',
    'https://api.example.test#fragment',
    'https://api.example.test#',
    'https://user@api.example.test',
    'https://user:secret@api.example.test',
    'https://@api.example.test',
    'https://API.example.test',
    'https://api.example.test:443',
    ' https://api.example.test',
    'https://api.example.test ',
    'https://api.\texample.test',
    'https://api.example.test\n',
    'https://api.example.test\u007f',
    'https://api.example.test\\',
    'https://例.test',
    `https://${'a'.repeat(2_048)}.test`,
    '',
    'not a url'
  ])('%j는 거절한다', (origin) => {
    expect(() => validateApiOrigin(origin)).toThrow(ApiOriginFailure)
  })
})
