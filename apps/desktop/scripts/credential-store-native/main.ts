import { app, safeStorage } from 'electron'
import { readdir } from 'node:fs/promises'
import { basename, isAbsolute, join } from 'node:path'
import * as fs from 'node:fs'
import { strict as assert } from 'node:assert'
import { createMacOsCredentialStore } from '../../src/backend/auth/credential-store/macos-credential-store'
import { createWindowsCredentialStore } from '../../src/backend/auth/credential-store/windows-credential-store'
import { createWindowsCredentialNative } from '../../src/backend/auth/credential-store/windows-credential-native'
import { createWindowsProfileSecurity } from '../../src/backend/auth/windows-profile-native'
import { applyAuthRuntimeProfile } from '../../src/backend/auth/runtime-config'
import { clearCredential } from '../../src/backend/auth/credential-operations'
import type { CredentialTransitionKind } from '../../src/backend/auth/types'

const appName = process.env.LDB_CREDENTIAL_NATIVE_NAME ?? ''
const profile = process.env.LDB_CREDENTIAL_NATIVE_PROFILE ?? ''
const phase = process.env.LDB_CREDENTIAL_NATIVE_PHASE ?? ''
const hasTestName = /^LDB-Credential-Test-[0-9a-f-]{36}$/.test(appName)
const hasAbsoluteProfile = isAbsolute(profile)
const hasValidInput = hasTestName && hasAbsoluteProfile
if (!hasValidInput) {
  app.exit(1)
}

const context = {
  environment: 'test',
  apiOrigin: 'https://credential-native.example.test',
  clientId: 'desktop'
} as const
const refresh0 = Buffer.alloc(32, 41).toString('base64url')
const refresh1 = Buffer.alloc(32, 42).toString('base64url')
let decryptCalls = 0
let encryptionAvailabilityCalls = 0
let stage = 'profile'

async function run(): Promise<void> {
  const isWindows = process.platform === 'win32'
  assert.ok(isWindows || process.platform === 'darwin')
  if (isWindows) {
    assert.equal(basename(profile), appName)
    const security = createWindowsProfileSecurity()
    assert.deepEqual(security.capabilities, {
      profileProtection: 'unknown',
      namespaceMutation: 'unknown'
    })
    applyAuthRuntimeProfile(
      app,
      {
        ...context,
        returnTarget: 'ldb-credential-test://auth/callback',
        providers: ['google'],
        appIdentity: appName,
        userDataPath: profile
      },
      {
        ...fs,
        realpathSync: fs.realpathSync.native,
        windows: {
          ...security,
          // Observation only: no product capability or durability claim is changed.
          capabilities: { profileProtection: 'confirmed', namespaceMutation: 'confirmed' }
        }
      }
    )
  } else {
    // Fix the test identity before Electron initializes its Keychain service.
    app.setName(appName)
    app.setPath('userData', profile)
  }
  app.disableHardwareAcceleration()
  stage = 'runtime'
  await app.whenReady()
  assert.equal(process.versions.electron, '39.8.10')
  assert.equal(process.versions.node, '22.22.1')
  assert.equal(process.versions.uv, '1.51.0')
  const observedSafeStorage = {
    isEncryptionAvailable: () => {
      encryptionAvailabilityCalls += 1
      return safeStorage.isEncryptionAvailable()
    },
    encryptString: (plaintext: string) => safeStorage.encryptString(plaintext),
    decryptString: (ciphertext: Buffer) => {
      decryptCalls += 1
      return safeStorage.decryptString(ciphertext)
    }
  }
  const options = { userDataPath: profile, context, safeStorage: observedSafeStorage }
  const native = isWindows ? createWindowsCredentialNative() : null
  if (native != null) {
    assert.deepEqual(native.capabilities, {
      profileProtection: 'unknown',
      fileMutation: 'unknown',
      namespaceMutation: 'unknown'
    })
  }
  const store =
    native == null
      ? createMacOsCredentialStore(options)
      : createWindowsCredentialStore({
          ...options,
          native: {
            ...native,
            // Exercise the existing file protocol; successful calls are not power-loss evidence.
            capabilities: {
              profileProtection: 'confirmed',
              fileMutation: 'confirmed',
              namespaceMutation: 'confirmed'
            }
          }
        })
  stage = phase

  async function persist(refreshToken: string, kind: CredentialTransitionKind): Promise<void> {
    assert.equal(await store.establishTransition(kind), 'confirmed')
    assert.equal(await store.commitCredential(refreshToken), 'confirmed')
    assert.equal(await store.removeTransition(), 'confirmed')
  }

  switch (phase) {
    case 'write':
      assert.deepEqual(await store.inspect(), { status: 'empty' })
      await persist(refresh0, 'exchange')
      break
    case 'restart':
      assert.deepEqual(await store.inspect(), { status: 'ready', refreshToken: refresh0 })
      await persist(refresh1, 'refresh')
      assert.deepEqual(await store.inspect(), { status: 'ready', refreshToken: refresh1 })
      assert.deepEqual(await readdir(join(profile, 'auth', 'test')), ['credential.v1'])
      break
    case 'mark':
      assert.deepEqual(await store.inspect(), { status: 'ready', refreshToken: refresh1 })
      assert.equal(await store.establishTransition('refresh'), 'confirmed')
      break
    case 'recover':
      assert.deepEqual(await store.inspect(), { status: 'recovery-required' })
      assert.equal(decryptCalls, 0)
      assert.equal(encryptionAvailabilityCalls, 0)
      assert.equal(await clearCredential(store), 'cleared')
      assert.deepEqual(await readdir(join(profile, 'auth', 'test')), [])
      break
    default:
      throw new Error('Unknown native credential test phase.')
  }
}

void run().then(
  () => {
    const result = { phase, ok: true, decryptCalls, encryptionAvailabilityCalls }
    process.stdout.write(`LDB_CREDENTIAL_NATIVE:${JSON.stringify(result)}\n`, () => app.exit(0))
  },
  () => {
    // Native/OS 오류 원문·plaintext·ciphertext·profile은 출력하지 않는다.
    process.stdout.write(
      `LDB_CREDENTIAL_NATIVE:${JSON.stringify({ phase, ok: false, stage })}\n`,
      () => app.exit(1)
    )
  }
)
