import { randomInt } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

// GA4가 권장하는 client_id 형식인 `<난수>.<처음 실행한 Unix 초>`다.
const CLIENT_ID_PATTERN = /^\d{1,10}\.\d{1,12}$/
const MAX_RANDOM_PART = 2 ** 31

function readSavedClientId(path: string): string | null {
  try {
    const saved: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (
      typeof saved === 'object' &&
      saved !== null &&
      'clientId' in saved &&
      typeof saved.clientId === 'string' &&
      CLIENT_ID_PATTERN.test(saved.clientId)
    ) {
      return saved.clientId
    }
  } catch {
    // 파일이 없거나 깨졌으면 새 ID를 만든다.
  }

  return null
}

export function readOrCreateClientId(path: string, now: number): string {
  const saved = readSavedClientId(path)
  if (saved != null) {
    return saved
  }
  const clientId = `${randomInt(1, MAX_RANDOM_PART)}.${Math.floor(now / 1000)}`
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify({ clientId }))
  } catch {
    // 저장하지 못하면 다음 실행을 새 사용자로 셀 뿐이므로 앱 시작을 막지 않는다.
  }

  return clientId
}
