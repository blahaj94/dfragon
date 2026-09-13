import { join } from 'node:path/win32'
import { createWindowsCredentialStore } from '../../src/backend/auth/credential-store/windows-credential-store'
import {
  clearCredential,
  prepareCredentialTransition,
  finalizeCredentialTransition
} from '../../src/backend/auth/credential-operations'
import type { CredentialInspection, CredentialStore } from '../../src/backend/auth/types'
import { assertPrivateRoot } from './isolation'
import { observeDisk } from './disk'
import { createObservedNative } from './native'
import { observeBeforeRecovery, type Observer } from './observer'

const context = {
  environment: 'synthetic',
  apiOrigin: 'https://credential.example.test',
  clientId: 'desktop'
} as const
const R0 = Buffer.alloc(32, 31).toString('base64url')
const R1 = Buffer.alloc(32, 32).toString('base64url')

export async function runScenarios({
  root,
  observer,
  mode
}: {
  root: string
  observer: Observer
  mode: 'normal' | 'recover'
}): Promise<{
  state: string
  recoveryPerformed: boolean
  decryptions: number
  markerDecryptions?: number
}> {
  const observed = createObservedNative(observer, root)
  let decryptions = 0
  const safeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (plaintext: string) => Buffer.from(`synthetic-only:${plaintext}`),
    decryptString: (bytes: Buffer) => {
      decryptions += 1
      const text = bytes.toString()
      const isSynthetic = text.startsWith('synthetic-only:')
      if (!isSynthetic) {
        throw new Error('Only synthetic ciphertext is accepted.')
      }
      return text.slice('synthetic-only:'.length)
    }
  }
  const createStore = (): CredentialStore =>
    createWindowsCredentialStore({
      userDataPath: join(root, 'profile'),
      context,
      safeStorage,
      native: observed.native
    })
  const original = async (): Promise<ReturnType<typeof observeDisk>> => {
    const disk = observeDisk(observed.security, root)
    observed.discardReadReturns()
    return disk
  }
  const check = async (
    cutpoint: string,
    operation: () => Promise<string>,
    expected: string
  ): Promise<void> => {
    observer.assertActive()
    const outcome = await operation()
    await observer.observe({ cutpoint, phase: 'protocol-return', outcome })
    const isExpected = outcome === expected
    if (!isExpected) {
      throw new Error('Synthetic protocol result did not match its normal control.')
    }
  }
  const inspectOriginal = async (store: CredentialStore): Promise<CredentialInspection> =>
    observeBeforeRecovery({ observer, snapshot: original, inspect: store.inspect })
  const requireStatus = (actual: string, expected: string): void => {
    const isExpected = actual === expected
    if (!isExpected) {
      throw new Error('Synthetic restart state did not match its normal control.')
    }
  }
  const requireReady = async (store: CredentialStore, expected: string): Promise<void> => {
    const state = await inspectOriginal(store)
    const isReady = state.status === 'ready'
    if (!isReady) {
      throw new Error('Synthetic credential is not ready.')
    }
    const hasExpectedToken = state.refreshToken === expected
    if (!hasExpectedToken) {
      throw new Error('Synthetic credential generation mismatch.')
    }
  }
  const isRecovery = mode === 'recover'
  if (isRecovery) {
    const store = createStore()
    const before = decryptions
    const state = await inspectOriginal(store)
    const isUnavailable = state.status === 'unavailable'
    if (isUnavailable) {
      throw new Error('Original store inspection is unavailable.')
    }
    const needsRecovery = state.status === 'recovery-required'
    if (needsRecovery) {
      requireStatus(String(decryptions - before), '0')
      await check('recovery.clear', () => clearCredential(store), 'cleared')
      requireStatus((await inspectOriginal(createStore())).status, 'empty')
    }
    return { state: state.status, recoveryPerformed: needsRecovery, decryptions }
  }

  const rootCreation = await observeBeforeRecovery({
    observer,
    snapshot: original,
    inspect: async () => observed.native.createDirectory(root)
  })
  requireStatus(rootCreation, 'created')
  assertPrivateRoot({ root, security: observed.security })
  const store = createStore()
  requireStatus((await store.inspect()).status, 'empty')
  await check('create.prepare', () => prepareCredentialTransition(store, 'exchange'), 'established')
  await check('create.commit-r0', () => store.commitCredential(R0), 'confirmed')
  await check('create.finalize', () => finalizeCredentialTransition(store, 'exchange'), 'committed')
  await requireReady(createStore(), R0)

  await check('replace.prepare', () => prepareCredentialTransition(store, 'refresh'), 'established')
  const beforeMarkerInspect = decryptions
  requireStatus((await inspectOriginal(createStore())).status, 'recovery-required')
  requireStatus(String(decryptions - beforeMarkerInspect), '0')
  await check('replace.commit-r1', () => store.commitCredential(R1), 'confirmed')
  await check('replace.finalize', () => finalizeCredentialTransition(store, 'refresh'), 'committed')
  await requireReady(createStore(), R1)
  await check('clear', () => clearCredential(store), 'cleared')
  requireStatus((await inspectOriginal(createStore())).status, 'empty')

  await check(
    'recovery.prepare',
    () => prepareCredentialTransition(store, 'exchange'),
    'established'
  )
  await check('recovery.commit-r1', () => store.commitCredential(R1), 'confirmed')
  const restarted = createStore()
  const beforeRecovery = decryptions
  requireStatus((await inspectOriginal(restarted)).status, 'recovery-required')
  requireStatus(String(decryptions - beforeRecovery), '0')
  await check('recovery.clear', () => clearCredential(restarted), 'cleared')
  requireStatus((await inspectOriginal(createStore())).status, 'empty')
  return { state: 'empty', recoveryPerformed: true, decryptions, markerDecryptions: 0 }
}
