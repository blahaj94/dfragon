import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { LOGIN_ERRORS } from '../../constants/login.js'
import { LoginFailure } from '../../errors/login.js'

export function decodeOpaque(value: unknown): Buffer {
  const isValueString = typeof value === 'string'
  if (!isValueString) {
    throw new LoginFailure(LOGIN_ERRORS.INVALID_REQUEST)
  }
  const hasOpaqueFormat = /^[A-Za-z0-9_-]{43}$/.test(value)
  if (!hasOpaqueFormat) {
    throw new LoginFailure(LOGIN_ERRORS.INVALID_REQUEST)
  }

  const bytes = Buffer.from(value, 'base64url')
  // Decode가 성공해도 같은 32 bytes의 canonical 표현인지 다시 확인한다.
  const hasExpectedByteLength = bytes.length === 32
  if (!hasExpectedByteLength) {
    throw new LoginFailure(LOGIN_ERRORS.INVALID_REQUEST)
  }
  const isCanonicalEncoding = bytes.toString('base64url') === value
  if (!isCanonicalEncoding) {
    throw new LoginFailure(LOGIN_ERRORS.INVALID_REQUEST)
  }
  return bytes
}

export function opaqueHash(value: string): Buffer {
  // Ticket·state·code는 인코딩된 문자열이 아닌 원래 random bytes를 hash한다.
  return createHash('sha256').update(decodeOpaque(value)).digest()
}

export function newOpaque(): string {
  try {
    return randomBytes(32).toString('base64url')
  } catch {
    throw new LoginFailure(LOGIN_ERRORS.INTERNAL)
  }
}

export function challenge(verifier: string): string {
  decodeOpaque(verifier)
  // PKCE S256은 opaqueHash와 달리 verifier의 ASCII 문자열을 hash한다.
  return createHash('sha256').update(verifier, 'ascii').digest('base64url')
}

export function equalHash(storedHash: Buffer | null, candidateHash: Buffer): boolean {
  const hasStoredHash = storedHash !== null
  if (!hasStoredHash) {
    return false
  }
  const hasSameLength = storedHash.length === candidateHash.length
  if (!hasSameLength) {
    return false
  }
  const isHashEqual = timingSafeEqual(storedHash, candidateHash)
  return isHashEqual
}
