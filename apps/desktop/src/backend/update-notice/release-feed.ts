import { isOcrCollectionEnabled } from '../ocr-collection/policy'
import { parseReleaseTag, type ReleaseVersion } from '../../preload/common/update-notice'
import type { UpdateNotice } from '../../preload/common/types/update-notice'

const RELEASES_URL = 'https://github.com/blahaj94/dfragon/releases'
const RELEASE_PAGE_PREFIX = `${RELEASES_URL}/tag/`
// Release tag는 앱 버전 앞에 `v`를 붙인 형식이다.
const RELEASE_TAG_PREFIX = 'v'
export const RELEASE_FEED_URL = `${RELEASES_URL}.atom`

const ATOM_ROOT_PATTERN =
  /^\s*(?:<\?xml[^>]*\?>\s*)?<feed\b[^>]*\bxmlns="http:\/\/www\.w3\.org\/2005\/Atom"/
const ENTRY_PATTERN = /<entry\b[^>]*>([\s\S]*?)<\/entry>/g
const LINK_PATTERN = /<link\b[^>]*>/
const HREF_PATTERN = /\bhref="([^"]*)"/

type ReleaseTrack = 'stable' | 'beta' | 'alpha'

// 현재 버전의 track마다 알릴 수 있는 Release의 track.
const ACCEPTED_TRACKS: Record<ReleaseTrack, readonly ReleaseTrack[]> = {
  stable: ['stable'],
  beta: ['beta', 'stable'],
  alpha: ['alpha', 'beta', 'stable']
}

/**
 * GitHub Release Atom feed에서 항목마다 첫 link의 Release 페이지 주소로 tag를 읽는다.
 * Atom feed가 아니면 null이고, 정식, alpha, beta tag가 아닌 항목은 건너뛴다.
 */
export function readReleaseFeedTags(feed: string): string[] | null {
  if (!ATOM_ROOT_PATTERN.test(feed)) {
    return null
  }
  const tags: string[] = []
  for (const [, entry] of feed.matchAll(ENTRY_PATTERN)) {
    const link = LINK_PATTERN.exec(entry)?.[0]
    const href = link == null ? undefined : HREF_PATTERN.exec(link)?.[1]
    if (!href?.startsWith(RELEASE_PAGE_PREFIX)) {
      continue
    }
    const tag = href.slice(RELEASE_PAGE_PREFIX.length)
    if (parseReleaseTag(tag) != null) {
      tags.push(tag)
    }
  }

  return tags
}

/**
 * 현재 버전의 track이 받을 수 있는 Release 가운데 현재보다 높고 semver로 가장 높은 버전 하나를 고른다.
 * GitHub의 Pre-release 표시와 feed 게시 순서는 보지 않는다.
 */
export function selectUpdateNotice(
  currentVersion: string,
  tags: readonly string[]
): UpdateNotice | null {
  const current = parseReleaseTag(`${RELEASE_TAG_PREFIX}${currentVersion}`)
  if (current == null) {
    return null
  }
  const accepted = ACCEPTED_TRACKS[readTrack(current)]
  let best: Readonly<{ tag: string; version: ReleaseVersion }> | null = null
  for (const tag of tags) {
    const version = parseReleaseTag(tag)
    if (
      version == null ||
      !accepted.includes(readTrack(version)) ||
      compareReleaseVersions(version, current) <= 0
    ) {
      continue
    }

    if (best == null || compareReleaseVersions(version, best.version) > 0) {
      best = { tag, version }
    }
  }

  if (best == null) {
    return null
  }

  const releaseVersion = best.tag.slice(RELEASE_TAG_PREFIX.length)
  const endsOcrCollection =
    collectsOcrSamples(currentVersion) && !collectsOcrSamples(releaseVersion)

  return { tag: best.tag, endsOcrCollection }
}

/** 검증한 Release tag의 GitHub Release 페이지 주소만 만든다. */
export function releasePageUrl(tag: string): string | null {
  if (parseReleaseTag(tag) == null) {
    return null
  }

  return `${RELEASE_PAGE_PREFIX}${tag}`
}

function readTrack(version: ReleaseVersion): ReleaseTrack {
  const label = version.prerelease[0]
  if (label === 'alpha' || label === 'beta') {
    return label
  }

  return 'stable'
}

// 알림은 배포 채널 패키지에서만 확인하고, 알린 Release도 패키지 빌드다.
function collectsOcrSamples(version: string): boolean {
  return isOcrCollectionEnabled({ isPackaged: true, version })
}

/** semver 우선순위로 비교한다. 정식 버전은 같은 core의 prerelease보다 높다. */
function compareReleaseVersions(left: ReleaseVersion, right: ReleaseVersion): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = left.core[index] - right.core[index]
    if (difference !== 0) {
      return difference
    }
  }

  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    return right.prerelease.length - left.prerelease.length
  }

  const length = Math.max(left.prerelease.length, right.prerelease.length)
  for (let index = 0; index < length; index += 1) {
    if (index >= left.prerelease.length) {
      return -1
    }

    if (index >= right.prerelease.length) {
      return 1
    }
    const difference = compareIdentifiers(left.prerelease[index], right.prerelease[index])
    if (difference !== 0) {
      return difference
    }
  }

  return 0
}

function compareIdentifiers(left: number | string, right: number | string): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  if (typeof left === 'number') {
    return -1
  }

  if (typeof right === 'number') {
    return 1
  }

  if (left === right) {
    return 0
  }

  if (left < right) {
    return -1
  }

  return 1
}
