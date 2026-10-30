import { afterEach, expect, it, vi } from 'vitest'
import { fetchPortableUrl } from './latest-release'

const PORTABLE_URL =
  'https://github.com/dungeon-and-dragon/dfragon/releases/download/v0.1.0/DFragon-0.1.0-x64-portable.exe'
const portableAsset = {
  name: 'DFragon-0.1.0-x64-portable.exe',
  browser_download_url: PORTABLE_URL
}
const checksumAsset = {
  name: 'DFragon-0.1.0-x64-portable.exe.sha256',
  browser_download_url: `${PORTABLE_URL}.sha256`
}

afterEach(() => vi.unstubAllGlobals())

function fetchWith(respond: () => Promise<Response>): ReturnType<typeof fetchPortableUrl> {
  vi.stubGlobal('fetch', vi.fn(respond))

  return fetchPortableUrl(new AbortController().signal)
}

it('Release 첨부 중 포터블 exe의 주소를 고른다', async () => {
  const portableUrl = await fetchWith(async () =>
    Response.json({ assets: [checksumAsset, portableAsset] })
  )

  expect(portableUrl).toBe(PORTABLE_URL)
})

it.each([
  ['요청이 실패하면', () => Promise.reject(new TypeError('Failed to fetch'))],
  ['사용량 제한에 걸리면', async () => Response.json({ assets: [portableAsset] }, { status: 403 })],
  ['응답이 JSON이 아니면', async () => new Response('<html>')],
  ['포터블 exe가 아직 붙지 않았으면', async () => Response.json({ assets: [checksumAsset] })],
  [
    '포터블 exe 주소가 GitHub 밖이면',
    async () =>
      Response.json({
        assets: [{ ...portableAsset, browser_download_url: 'https://example.com/a.exe' }]
      })
  ]
])('%s 고를 Release가 없다', async (_case, respond) => {
  expect(await fetchWith(respond)).toBeNull()
})
