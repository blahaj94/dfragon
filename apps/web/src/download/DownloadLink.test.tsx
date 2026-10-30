// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DownloadLink } from './DownloadLink'

const RELEASE_PAGE = 'https://github.com/dungeon-and-dragon/dfragon/releases/latest'
const PORTABLE_URL =
  'https://github.com/dungeon-and-dragon/dfragon/releases/download/v0.1.0/DFragon-0.1.0-x64-portable.exe'

// 2026-10-31 v0.1.0 releases/latest 응답에서 화면이 읽는 필드만 남겼다.
const latestRelease = {
  assets: [
    { name: 'DFragon-0.1.0-x64-portable.exe', browser_download_url: PORTABLE_URL },
    {
      name: 'DFragon-0.1.0-x64-portable.exe.sha256',
      browser_download_url: `${PORTABLE_URL}.sha256`
    }
  ]
}

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function renderWithResponse(respond: () => Promise<Response>): Promise<HTMLAnchorElement> {
  vi.stubGlobal('fetch', vi.fn(respond))
  await act(async () => root.render(<DownloadLink />))

  return container.querySelector('a')!
}

it('최신 Release의 포터블 exe를 받는 버튼만 보이고 버전 줄은 두지 않는다', async () => {
  const link = await renderWithResponse(async () => Response.json(latestRelease))

  expect(link.href).toBe(PORTABLE_URL)
  expect(container.textContent).toBe('Windows용 내려받기')
})

it('최신 Release를 읽지 못하면 버튼이 Release 페이지로 보낸다', async () => {
  const link = await renderWithResponse(() => Promise.reject(new TypeError('Failed to fetch')))

  expect(link.href).toBe(RELEASE_PAGE)
  expect(container.textContent).toBe('Windows용 내려받기')
})
