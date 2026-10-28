import { parseReleaseTag, type ReleaseVersion } from '../../preload/common/update-notice'
import type { UpdateNotice } from '../../preload/common/types/update-notice'

const RELEASES_URL = 'https://github.com/blahaj94/dfragon/releases'
const RELEASE_PAGE_PREFIX = `${RELEASES_URL}/tag/`
const RELEASE_TAG_PREFIX = 'v'
export const RELEASE_FEED_URL = `${RELEASES_URL}.atom`

const ATOM_ROOT_PATTERN =
  /^\s*(?:<\?xml[^>]*\?>\s*)?<feed\b[^>]*\bxmlns="http:\/\/www\.w3\.org\/2005\/Atom"/
const ENTRY_PATTERN = /<entry\b[^>]*>([\s\S]*?)<\/entry>/g
const LINK_PATTERN = /<link\b[^>]*>/
const HREF_PATTERN = /\bhref="([^"]*)"/

type ReleaseTrack = 'stable' | 'beta' | 'alpha'

const ACCEPTED_TRACKS: Record<ReleaseTrack, readonly ReleaseTrack[]> = {
  stable: ['stable'],
  beta: ['beta', 'stable'],
  alpha: ['alpha', 'beta', 'stable']
}

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

  return { tag: best.tag }
}

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
