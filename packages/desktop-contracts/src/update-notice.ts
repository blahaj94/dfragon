import type { UpdateNoticeSnapshot } from './types/update-notice'

// 정식과 alpha, beta tag만 받는다. 숫자 식별자의 앞자리 0은 semver처럼 허용하지 않는다.
const RELEASE_TAG_PATTERN =
  /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:alpha|beta)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$/
const NUMERIC_IDENTIFIER_PATTERN = /^(?:0|[1-9]\d*)$/

export type ReleaseVersion = Readonly<{
  core: readonly [number, number, number]
  prerelease: readonly (number | string)[]
}>

/** `v<semver>` 형식의 정식, alpha, beta tag를 비교할 수 있는 값으로 해석한다. */
export function parseReleaseTag(tag: string): ReleaseVersion | null {
  const match = RELEASE_TAG_PATTERN.exec(tag)
  if (match == null) {
    return null
  }
  const core = [Number(match[1]), Number(match[2]), Number(match[3])] as const
  const prerelease = match[4] == null ? [] : match[4].split('.').map(readIdentifier)
  const numbers = [...core, ...prerelease.filter((value) => typeof value === 'number')]
  if (!numbers.every(Number.isSafeInteger)) {
    return null
  }

  return { core, prerelease }
}

function readIdentifier(identifier: string): number | string {
  if (NUMERIC_IDENTIFIER_PATTERN.test(identifier)) {
    return Number(identifier)
  }

  return identifier
}

export function isReleaseTag(value: unknown): value is string {
  return typeof value === 'string' && parseReleaseTag(value) != null
}

export function parseUpdateNoticeSnapshot(value: unknown): UpdateNoticeSnapshot | null {
  if (
    value == null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Reflect.ownKeys(value).length !== 2 ||
    !('revision' in value) ||
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    !('notice' in value)
  ) {
    return null
  }

  if (value.notice === null) {
    return { revision: value.revision, notice: null }
  }

  const notice: unknown = value.notice
  if (
    notice == null ||
    typeof notice !== 'object' ||
    Array.isArray(notice) ||
    Reflect.ownKeys(notice).length !== 2 ||
    !('tag' in notice) ||
    !isReleaseTag(notice.tag) ||
    !('endsOcrCollection' in notice) ||
    typeof notice.endsOcrCollection !== 'boolean'
  ) {
    return null
  }

  return {
    revision: value.revision,
    notice: { tag: notice.tag, endsOcrCollection: notice.endsOcrCollection }
  }
}
