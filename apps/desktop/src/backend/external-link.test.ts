import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ openExternal: vi.fn() }))

vi.mock('electron', () => ({ shell: { openExternal: mocks.openExternal } }))

import { openExternalLink } from './external-link'

beforeEach(() => {
  mocks.openExternal.mockReset()
  mocks.openExternal.mockResolvedValue(undefined)
})

it('Neople 오픈 API 주소는 화면 링크와 같은 표기로도 기본 브라우저로 연다', () => {
  openExternalLink('https://developers.neople.co.kr')

  expect(mocks.openExternal).toHaveBeenCalledExactlyOnceWith('https://developers.neople.co.kr')
})

it.each([
  'https://developers.neople.co.kr.example.com/',
  'https://developers.neople.co.kr/contents/bi',
  'http://developers.neople.co.kr/',
  'file:///C:/Windows/System32/calc.exe',
  'not a url'
])('허용 목록에 없는 주소 %s는 열지 않는다', (url) => {
  openExternalLink(url)

  expect(mocks.openExternal).not.toHaveBeenCalled()
})
