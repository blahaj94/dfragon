import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { encodeCredentialRecord } from '../../src/backend/auth/credential-store/credential-record'
import type { Observation } from './observer'
import type { DiskObservation } from './disk'
import { judgeRecovery, validateHold, type HoldEvidence, type RecoveryObservation } from './oracle'

const context = {
  environment: 'synthetic',
  apiOrigin: 'https://credential.example.test',
  clientId: 'desktop'
} as const
const identity = { runId: 'original-run', caseId: 'normal-control' } as const
const held = { cutpoint: 'adapter.flush', phase: 'before', outcome: 'not-called' }
const token = (generation: 'R0' | 'R1'): string =>
  Buffer.alloc(32, generation === 'R0' ? 31 : 32).toString('base64url')
const event = (
  cutpoint: string,
  outcome: string,
  scenario = 'replace.prepare'
): Omit<Observation, 'runId' | 'caseId' | 'sequence'> => ({
  cutpoint,
  phase: 'protocol-return',
  outcome,
  detail: { scenario }
})
const start = (
  cutpoint: string,
  scenario: string
): Omit<Observation, 'runId' | 'caseId' | 'sequence'> => ({
  cutpoint,
  phase: 'protocol-start',
  outcome: 'not-called',
  detail: { scenario }
})
function hold(points: Array<Omit<Observation, 'runId' | 'caseId' | 'sequence'>>): HoldEvidence {
  const manifest = {
    cutpoint: 'run-manifest',
    phase: 'initial',
    outcome: 'recorded',
    detail: {
      kind: 'ldb-synthetic-windows-crash-v1',
      ...identity,
      mode: 'normal',
      rootName: 'ldb-crash-11111111-1111-4111-8111-111111111111',
      invocationOwner: 'synthetic-owner'
    }
  }
  const observations = [manifest, ...points, held].map((point, index) => ({
    ...identity,
    sequence: index + 1,
    ...point
  }))
  return {
    kind: 'ldb-synthetic-windows-hold-v1',
    invocationOwner: 'synthetic-owner',
    rawRecords: observations.map((record) =>
      Buffer.from(JSON.stringify(record)).toString('base64')
    ),
    selection: { ...identity, sequence: observations.length, ...held },
    observations
  }
}
function disk(
  generation: 'R0' | 'R1' | 'corrupt' | 'missing',
  marker = false,
  temporary = false
): DiskObservation {
  const entries: DiskObservation['entries'] = [
    '.',
    './profile',
    './profile/auth',
    './profile/auth/synthetic'
  ].map((name) => ({ name, type: 'directory', protection: 'trusted' }))
  const add = (name: string, bytes: Buffer): void => {
    entries.push({
      name: `./profile/auth/synthetic/${name}`,
      type: 'file',
      protection: 'trusted',
      bytes: bytes.toString('base64'),
      sha256: createHash('sha256').update(bytes).digest('hex')
    })
  }
  if (generation !== 'missing') {
    const bytes =
      generation === 'corrupt'
        ? Buffer.from('broken')
        : encodeCredentialRecord(
            context,
            Buffer.from(
              `synthetic-only:${JSON.stringify({ version: 1, ...context, refreshToken: token(generation) })}`
            )
          )
    add('credential.v1', bytes)
  }
  if (marker) {
    add(
      'transition.v1',
      Buffer.from(
        JSON.stringify({
          version: 1,
          operationId: '11111111-1111-4111-8111-111111111111',
          kind: 'refresh'
        })
      )
    )
  }
  if (temporary) {
    add('.credential.v1.11111111-1111-4111-8111-111111111111.tmp', Buffer.from('incomplete'))
  }
  return { entries, content: 'synthetic-only', observation: 'read-only-before-store-inspect' }
}
const blocked = {
  automaticRefreshes: 0,
  publishes: 0,
  state: 'recovery-required',
  generation: 'none',
  decryptionsBeforeRecovery: 0,
  recoveryPerformed: true,
  finalState: 'empty'
}
const ready = (generation: 'R0' | 'R1'): RecoveryObservation => ({
  automaticRefreshes: 0,
  publishes: 0,
  state: 'ready',
  generation,
  decryptionsBeforeRecovery: 1,
  recoveryPerformed: false,
  finalState: 'ready'
})
const markerEstablished = event('store.establishTransition', 'confirmed')
const r1Committed = event('store.commitCredential', 'confirmed', 'replace.commit-r1')

it('requires an exactly reached adapter selection and contiguous original run evidence', () => {
  const valid = hold([markerEstablished])
  expect(validateHold(valid).observations).toHaveLength(3)
  for (const invalid of [
    { ...valid, observations: [] },
    { ...valid, selection: { ...valid.selection, sequence: 4 } },
    { ...valid, selection: { ...valid.selection, runId: 'another-run' } },
    { ...valid, selection: { ...valid.selection, cutpoint: 'FileDispositionInfo-to-CloseHandle' } },
    { ...valid, observations: [{ ...valid.observations[0], sequence: 9 }, valid.observations[1]] }
  ]) {
    expect(() => validateHold(invalid)).toThrow()
  }
})
it('does not infer marker success from an adapter after/returned observation', () => {
  const evidence = hold([{ cutpoint: 'adapter.rename', phase: 'after', outcome: 'returned' }])
  const result = judgeRecovery({ hold: evidence, original: disk('R0'), recovery: ready('R0') })
  expect(result.status).toBe('observed-consistent')
  expect(result.durabilityFindings).toEqual([])
})
it('distinguishes missing reported marker and uncertain R0 restoration', () => {
  const result = judgeRecovery({
    hold: hold([markerEstablished]),
    original: disk('R0'),
    recovery: ready('R0')
  })
  expect(result.durabilityFindings).toContain('reported-marker-missing')
  expect(result.recoveryFindings).toContain('uncertain-r0-restored')
})
it.each(['R0', 'R1'] as const)(
  'requires zero credential decryptions when a marker blocks %s',
  (generation) => {
    const evidence = hold([markerEstablished])
    expect(
      judgeRecovery({ hold: evidence, original: disk(generation, true), recovery: blocked }).status
    ).toBe('observed-consistent')
    const result = judgeRecovery({
      hold: evidence,
      original: disk(generation, true),
      recovery: { ...blocked, decryptionsBeforeRecovery: 1 }
    })
    expect(result.recoveryFindings).toContain('blocked-credential-decrypted')
  }
)
it.each(['R0', 'missing', 'corrupt'] as const)(
  'detects loss of confirmed R1 as %s before recovery clears it',
  (generation) => {
    const result = judgeRecovery({
      hold: hold([markerEstablished, r1Committed]),
      original: disk(generation, true),
      recovery: blocked
    })
    expect(result.durabilityFindings).toContain('reported-r1-not-preserved')
  }
)
it('allows R1 restore while marker removal outcome is unknown', () => {
  const evidence = hold([
    markerEstablished,
    r1Committed,
    start('store.removeTransition', 'replace.finalize')
  ])
  const result = judgeRecovery({ hold: evidence, original: disk('R1'), recovery: ready('R1') })
  expect(result.status).toBe('observed-consistent')
  expect(result.durabilityFindings).toEqual([])
  expect(result.recoveryFindings).toEqual([])
})
it('classifies conservative marker reappearance without a security finding', () => {
  const evidence = hold([
    markerEstablished,
    r1Committed,
    event('store.removeTransition', 'confirmed', 'replace.finalize')
  ])
  const result = judgeRecovery({ hold: evidence, original: disk('R1', true), recovery: blocked })
  expect(result.durabilityFindings).toContain('reported-marker-removal-not-preserved')
  expect(result.recoveryFindings).toEqual([])
})
it('does not permit an owned temporary file to become a recovery credential', () => {
  const result = judgeRecovery({
    hold: hold([]),
    original: disk('R0', false, true),
    recovery: ready('R0')
  })
  expect(result.recoveryFindings).toContain('blocked-record-restored')
})
it('checks confirmed clear deletion independently of subsequent marker removal', () => {
  const evidence = hold([markerEstablished, event('store.clearCredential', 'confirmed', 'clear')])
  const result = judgeRecovery({
    hold: evidence,
    original: disk('R1', true, true),
    recovery: blocked
  })
  expect(result.durabilityFindings).toContain('reported-deletion-not-preserved')
})
it('requires completed recovery and a final empty observation', () => {
  const result = judgeRecovery({
    hold: hold([markerEstablished]),
    original: disk('R1', true),
    recovery: { ...blocked, finalState: 'recovery-required' }
  })
  expect(result.recoveryFindings).toContain('recovery-not-clean')
})
it('rejects missing disk and corrupted byte/hash evidence instead of assuming empty', () => {
  const original = disk('R1')
  original.entries[4].sha256 = '0'.repeat(64)
  for (const invalid of [null, { entries: [] }, original]) {
    expect(() =>
      judgeRecovery({ hold: hold([]), original: invalid, recovery: ready('R1') })
    ).toThrow()
  }
})

it('allows partial creation before preparation success but detects missing prepared paths afterward', () => {
  const original = {
    entries: [{ name: '.', type: 'missing', protection: 'missing' }],
    content: 'synthetic-only',
    observation: 'read-only-before-store-inspect'
  }
  const recovery = {
    automaticRefreshes: 0,
    publishes: 0,
    state: 'empty',
    generation: 'none',
    decryptionsBeforeRecovery: 0,
    recoveryPerformed: false,
    finalState: 'empty'
  }
  expect(judgeRecovery({ hold: hold([]), original, recovery }).durabilityFindings).toEqual([])
  expect(
    judgeRecovery({ hold: hold([event('store.inspect', 'empty', 'prepare')]), original, recovery })
      .durabilityFindings
  ).toContain('reported-preparation-not-preserved')
})
it('allows in-progress replacement and clear to change a previously committed generation', () => {
  const replacement = hold([
    event('store.commitCredential', 'confirmed', 'create.commit-r0'),
    markerEstablished,
    start('store.commitCredential', 'replace.commit-r1')
  ])
  expect(
    judgeRecovery({ hold: replacement, original: disk('R1', true), recovery: blocked })
      .durabilityFindings
  ).toEqual([])
  const deletion = hold([markerEstablished, r1Committed, start('store.clearCredential', 'clear')])
  expect(
    judgeRecovery({ hold: deletion, original: disk('missing', true), recovery: blocked })
      .durabilityFindings
  ).toEqual([])
})
it('rejects host bytes that disagree with the parsed history and unrelated root ownership', () => {
  const valid = hold([])
  expect(() => validateHold({ ...valid, rawRecords: [] })).toThrow()
  const changed = {
    ...valid,
    observations: valid.observations.map((point) => ({ ...point, caseId: 'recovery' }))
  }
  expect(() => validateHold(changed)).toThrow()
  expect(() => validateHold({ ...valid, invocationOwner: 'another-owner' })).toThrow()
})

it('rejects missing recovery action evidence and detects automatic credential use', () => {
  const evidence = hold([markerEstablished])
  const recovery = { ...blocked, automaticRefreshes: 1 }
  expect(
    judgeRecovery({ hold: evidence, original: disk('R1', true), recovery }).recoveryFindings
  ).toContain('automatic-credential-use')
  expect(() =>
    judgeRecovery({
      hold: evidence,
      original: disk('R1', true),
      recovery: { ...blocked, publishes: undefined }
    })
  ).toThrow()
})

it.each([
  { state: 'empty', generation: 'none', recoveryPerformed: false, finalState: 'empty' },
  { state: 'recovery-required', generation: 'none', recoveryPerformed: true, finalState: 'empty' }
])(
  'detects inspection or unsolicited recovery that discards an intact ready record',
  (observed) => {
    const evidence = hold([
      markerEstablished,
      r1Committed,
      event('store.removeTransition', 'confirmed', 'replace.finalize')
    ])
    const recovery = { ...ready('R1'), ...observed }
    expect(
      judgeRecovery({ hold: evidence, original: disk('R1'), recovery }).recoveryFindings
    ).toContain('inspection-state-mismatch')
  }
)
it('rejects superseded R0 restoration even after reported marker removal', () => {
  const evidence = hold([
    markerEstablished,
    r1Committed,
    event('store.removeTransition', 'confirmed', 'replace.finalize')
  ])
  expect(
    judgeRecovery({ hold: evidence, original: disk('R0'), recovery: ready('R0') }).recoveryFindings
  ).toContain('superseded-r0-restored')
})
