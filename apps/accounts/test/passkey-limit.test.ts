import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto'
import { isoCBOR } from '@simplewebauthn/server/helpers'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import { managementFixture } from './login-service.fixtures.js'

test('nineteen passkeys allow options while twenty reject options and final verification', async () => {
  const available = managementFixture(19)
  await available.invoke('options', { operation: 'add' })
  assert.equal(available.row.operation, 'add')
  assert.equal(typeof available.row.webauthnChallenge, 'string')
  assert.equal(available.events.at(-1), 'commit')

  const full = managementFixture(20)
  await assert.rejects(full.invoke('options', { operation: 'add' }), { code: 'PASSKEY_LIMIT' })
  assert.equal(full.row.webauthnChallenge, null)
  assert.equal(full.events.includes('request-save'), false)

  full.row.operation = 'add'
  full.row.webauthnChallenge = 'fixture-challenge'
  full.row.pendingUserId = full.row.verifiedUserId
  await assert.rejects(full.invoke('verify', { response: {} }), { code: 'PASSKEY_LIMIT' })
  assert.equal(full.events.includes('request-update'), false)
  assert.equal(full.keys.length, 20)
})

test('final verification rechecks a limit reached after registration options were issued', async () => {
  const fixture = managementFixture(19)
  await fixture.invoke('options', { operation: 'add' })
  fixture.keys.push({ ...fixture.keys[0]!, id: 'concurrent-registration' })
  fixture.events.length = 0

  await assert.rejects(fixture.invoke('verify', { response: {} }), { code: 'PASSKEY_LIMIT' })
  assert.deepEqual(fixture.events, [
    'begin',
    'request-lock',
    'time',
    'user-lock',
    'credential-lock',
    'time',
    'credential-count',
    'rollback'
  ])
  assert.equal(fixture.keys.length, 20)
  assert.equal(fixture.row.status, 'managing')
})

test('a verified registration at nineteen keys commits the twentieth key', async () => {
  const fixture = managementFixture(19)
  await fixture.invoke('options', { operation: 'add' })
  const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const jwk = publicKey.export({ format: 'jwk' })
  const coseKey = isoCBOR.encode(
    new Map<number, number | Uint8Array>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(jwk.x!, 'base64url')],
      [-3, Buffer.from(jwk.y!, 'base64url')]
    ])
  )
  const credentialId = randomBytes(32)
  const id = credentialId.toString('base64url')
  const credentialLength = Buffer.alloc(2)
  credentialLength.writeUInt16BE(credentialId.length)
  const rpIdHash = createHash('sha256').update(fixture.configuration.rpId).digest()
  // None-attestation fixture: user present, user verified, and attested credential data.
  const authData = Buffer.concat([
    rpIdHash,
    Buffer.from([0x45]),
    Buffer.alloc(4),
    Buffer.alloc(16),
    credentialLength,
    credentialId,
    coseKey
  ])
  const encoded = isoCBOR.encode(
    new Map<string, string | Uint8Array | Map<string, never>>([
      ['fmt', 'none'],
      ['authData', authData],
      ['attStmt', new Map<string, never>()]
    ])
  )
  const clientDataJSON = Buffer.from(
    JSON.stringify({
      type: 'webauthn.create',
      challenge: fixture.row.webauthnChallenge,
      origin: fixture.configuration.apiOrigin,
      crossOrigin: false
    })
  ).toString('base64url')
  const attestationObject = Buffer.from(encoded).toString('base64url')
  const response: RegistrationResponseJSON = {
    id,
    rawId: id,
    type: 'public-key',
    clientExtensionResults: {},
    response: { clientDataJSON, attestationObject, transports: ['internal'] }
  }

  assert.deepEqual(await fixture.invoke('verify', { response }), { managed: true })
  assert.equal(fixture.keys.length, 20)
  assert.equal(fixture.keys.at(-1)!.id, id)
  assert.equal(fixture.row.webauthnChallenge, null)
  assert.equal(fixture.row.operation, null)
  assert.equal(fixture.events.at(-1), 'commit')
})
