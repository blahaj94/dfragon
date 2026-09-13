import { join } from 'node:path/win32'
import { createHash } from 'node:crypto'
import type { ReadOnlySecurity } from './native'
import { MAX_RECORD_BYTES } from '../../src/backend/auth/credential-store/credential-record'

export type DiskObservation = {
  entries: Array<{
    name: string
    type: string
    protection: string
    bytes?: string
    sha256?: string
  }>
  content: string
  observation: string
}

export function observeDisk(security: ReadOnlySecurity, root: string): DiskObservation {
  const entries: DiskObservation['entries'] = []
  const visit = (path: string, name: string, depth: number): void => {
    const directory = security.inspect(path, 'directory')
    const isMissing = directory === 'missing'
    if (isMissing) {
      entries.push({ name, type: 'missing', protection: 'missing' })
      return
    }
    const isDirectory = directory === 'trusted'
    if (isDirectory) {
      entries.push({ name, type: 'directory', protection: 'trusted' })
      const isTooDeep = depth > 3
      if (isTooDeep) {
        throw new Error('Synthetic disk tree exceeds its depth bound.')
      }
      const children = security.list(path).sort()
      const hasTooManyChildren = children.length > 64
      if (hasTooManyChildren) {
        throw new Error('Synthetic disk tree exceeds its entry bound.')
      }
      for (const child of children) {
        const isKnownDirectory = child === 'profile' || child === 'auth' || child === 'synthetic'
        const isKnownRecord = child === 'credential.v1' || child === 'transition.v1'
        const isOwnedTemporary = /^\.(credential|transition)\.v1\.[0-9a-f-]{36}\.tmp$/.test(child)
        const isAllowed = isKnownDirectory || isKnownRecord || isOwnedTemporary
        if (!isAllowed) {
          throw new Error('Synthetic disk contains an unexpected entry.')
        }
        visit(join(path, child), `${name}/${child}`, depth + 1)
      }
      return
    }
    const file = security.inspect(path, 'file')
    const isTrustedFile = file === 'trusted'
    if (!isTrustedFile) {
      throw new Error('Original disk type or protection is unconfirmed.')
    }
    const handle = security.openRead(path)
    const bytes = Buffer.alloc(MAX_RECORD_BYTES + 1)
    let length: number
    let closed = false
    try {
      length = security.readFile(handle, bytes, bytes.length)
    } finally {
      closed = security.closeHandle(handle)
    }
    if (!closed) {
      throw new Error('Original disk read handle close failed.')
    }
    const isOversized = length > MAX_RECORD_BYTES
    if (isOversized) {
      throw new Error('Original synthetic record exceeds its bound.')
    }
    const content = bytes.subarray(0, length)
    entries.push({
      name,
      type: 'file',
      protection: 'trusted',
      bytes: content.toString('base64'),
      sha256: createHash('sha256').update(content).digest('hex')
    })
  }
  visit(root, '.', 0)
  return { entries, content: 'synthetic-only', observation: 'read-only-before-store-inspect' }
}
