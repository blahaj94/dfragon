// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NeopleApiLogo } from './NeopleApiLogo'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it('로고는 86×24로 Neople 오픈 API 이름의 링크이고 새 창 요청으로 공식 주소를 연다', async () => {
  await act(async () => root.render(<NeopleApiLogo />))

  const link = container.querySelector<HTMLAnchorElement>('a[href]')!
  expect(link.getAttribute('href')).toBe('https://developers.neople.co.kr')
  expect(link.target).toBe('_blank')
  expect(link.rel).toBe('noopener noreferrer')
  const image = link.querySelector('img')!
  expect(image.getAttribute('alt')).toBe('Neople 오픈 API')
  expect([image.width, image.height]).toEqual([86, 24])
})
