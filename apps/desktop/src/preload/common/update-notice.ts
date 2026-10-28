import type { UpdateNotice, UpdateNoticeSnapshot } from './types/update-notice'

const RELEASE_TAG_PATTERN =
  /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:alpha|beta)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$/
const NUMERIC_IDENTIFIER_PATTERN = /^(?:0|[1-9]\d*)$/

export type ReleaseVersion = Readonly<{
  core: readonly [number, number, number]
  prerelease: readonly (number | string)[]
}>

export function parseReleaseTag(tag: string): ReleaseVersion | null {
  const match = RELEASE_TAG_PATTERN.exec(tag)
  if (match == null) {
    return null
  }
  const core = [Number(match[1]), Number(match[2]), Number(match[3])] as const
  const prerelease = match[4] != null ? match[4].split('.').map(readIdentifier) : []
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

function hasExactFields<Field extends string>(
  value: unknown,
  fields: readonly Field[]
): value is Record<Field, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Reflect.ownKeys(value).length === fields.length &&
    fields.every((field) => field in value)
  )
}

function isRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isUpdateNotice(value: unknown): value is UpdateNotice {
  return hasExactFields(value, ['tag']) && isReleaseTag(value.tag)
}

export function parseUpdateNoticeSnapshot(value: unknown): UpdateNoticeSnapshot | null {
  if (!hasExactFields(value, ['revision', 'notice'])) {
    return null
  }
  const { revision, notice } = value
  if (!isRevision(revision)) {
    return null
  }

  if (notice === null) {
    return { revision, notice: null }
  }

  if (!isUpdateNotice(notice)) {
    return null
  }

  return { revision, notice: { tag: notice.tag } }
}
