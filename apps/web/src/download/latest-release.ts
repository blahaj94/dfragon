import * as z from 'zod/mini'

export const LATEST_RELEASE_PAGE = 'https://github.com/dungeon-and-dragon/dfragon/releases/latest'
const LATEST_RELEASE_API = 'https://api.github.com/repos/dungeon-and-dragon/dfragon/releases/latest'
const PORTABLE_ASSET_PATTERN = /^DFragon-[^/]+-x64-portable\.exe$/
const DOWNLOAD_ORIGIN = 'https://github.com/'

export type PortableRelease = { version: string; url: string; size: number }

const releaseSchema = z.object({
  tag_name: z.string().check(z.minLength(1)),
  assets: z.array(
    z.object({
      name: z.string(),
      size: z.int().check(z.positive()),
      browser_download_url: z.string()
    })
  )
})

export function toPortableRelease(body: unknown): PortableRelease | null {
  const release = releaseSchema.safeParse(body)
  if (!release.success) {
    return null
  }
  const asset = release.data.assets.find(
    ({ name, browser_download_url: url }) =>
      PORTABLE_ASSET_PATTERN.test(name) && url.startsWith(DOWNLOAD_ORIGIN)
  )
  if (asset === undefined) {
    return null
  }

  return {
    version: release.data.tag_name,
    url: asset.browser_download_url,
    size: asset.size
  }
}

export async function fetchPortableRelease(signal: AbortSignal): Promise<PortableRelease | null> {
  try {
    const response = await fetch(LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal
    })
    if (!response.ok) {
      return null
    }

    return toPortableRelease(await response.json())
  } catch {
    // 네트워크 오류, 사용량 제한, 응답 형식 오류는 모두 Release 페이지로 보내는 같은 경로로 처리한다.
    return null
  }
}

const megabytes = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 })

export function formatSize(bytes: number): string {
  return `${megabytes.format(bytes / 1024 / 1024)}MB`
}
