import { app, safeStorage } from 'electron'
import { readdir } from 'node:fs/promises'
import { basename, isAbsolute, join } from 'node:path'
import { strict as assert } from 'node:assert'
import { createMacOsCredentialStore } from '../../src/backend/auth/credential-store/macos-credential-store'
import { createWindowsCredentialStore } from '../../src/backend/auth/credential-store/windows-credential-store'
import { applyAuthRuntimeProfile } from '../../src/backend/auth/runtime-config'
import { clearCredential } from '../../src/backend/auth/credential-operations'
import type { CredentialTransitionKind } from '../../src/backend/auth/types'

const appName = process.env.DFRAGON_CREDENTIAL_NATIVE_NAME ?? ''
const profile = process.env.DFRAGON_CREDENTIAL_NATIVE_PROFILE ?? ''
const phase = process.env.DFRAGON_CREDENTIAL_NATIVE_PHASE ?? ''
const hasTestName = /^DFRAGON-Credential-Test-[0-9a-f-]{36}$/.test(appName)
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
    applyAuthRuntimeProfile(app, {
      ...context,
      returnTarget: 'dfragon-credential-test://auth/callback',
      providers: ['passkey'],
      appIdentity: appName,
      userDataPath: profile
    })
  } else {
    // Fix the test identity before Electron initializes its Keychain service.
    app.setName(appName)
    app.setPath('userData', profile)
  }
  app.disableHardwareAcceleration()
  stage = 'runtime'
  await app.whenReady()
  stage = 'session-profile'
  assert.equal(app.getPath('sessionData'), profile)
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
  const store = isWindows
    ? createWindowsCredentialStore(options)
    : createMacOsCredentialStore(options)
  stage = phase

  async function persist(refreshToken: string, kind: CredentialTransitionKind): Promise<void> {
    stage = `${phase}:establish`
    assert.equal(await store.establishTransition(kind), 'confirmed')
    stage = `${phase}:commit`
    assert.equal(await store.commitCredential(refreshToken), 'confirmed')
    stage = `${phase}:remove-transition`
    assert.equal(await store.removeTransition(), 'confirmed')
  }

  switch (phase) {
    case 'write':
      assert.deepEqual(await store.inspect(), { status: 'empty' })
      await persist(refresh0, 'exchange')
      break
    case 'restart':
      {
        const restored = await store.inspect()
        stage = `restart:inspect:${restored.status}`
        assert.deepEqual(restored, { status: 'ready', refreshToken: refresh0 })
      }
      await persist(refresh1, 'refresh')
      stage = 'restart:inspect-refreshed'
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
    // Let Electron finish startup and persist Local State before the next process.
    // An immediate app.exit() during early startup can bypass that shutdown work.
    process.stdout.write(`DFRAGON_CREDENTIAL_NATIVE:${JSON.stringify(result)}\n`, () => app.quit())
  },
  () => {
    // Native/OS 오류 원문·plaintext·ciphertext·profile은 출력하지 않는다.
    process.stdout.write(
      `DFRAGON_CREDENTIAL_NATIVE:${JSON.stringify({ phase, ok: false, stage, decryptCalls, encryptionAvailabilityCalls })}\n`,
      () => app.exit(1)
    )
  }
)
