import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  readCiphertext,
  readRefreshToken
} from '../../src/backend/auth/credential-store/credential-record'
import type { Observation } from './observer'

const context = {
  environment: 'synthetic',
  apiOrigin: 'https://credential.example.test',
  clientId: 'desktop'
} as const
const observationSchema = z.object({
  runId: z.string().regex(/^[a-z0-9-]{1,80}$/),
  caseId: z.enum(['normal-control', 'recovery']),
  sequence: z.number().int().min(1).max(999999),
  cutpoint: z.string(),
  phase: z.string(),
  outcome: z.string(),
  detail: z.unknown().optional()
})
const holdSchema = z.object({
  kind: z.literal('dfragon-synthetic-windows-hold-v1'),
  invocationOwner: z.string().min(1),
  rawRecords: z.array(z.string()).min(1).max(10000),
  selection: observationSchema,
  observations: z.array(observationSchema).min(1).max(10000)
})
const diskSchema = z.object({
  entries: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['file', 'directory', 'missing']),
        protection: z.enum(['trusted', 'missing']),
        bytes: z.string().optional(),
        sha256: z.string().optional()
      })
    )
    .min(1)
    .max(256),
  content: z.literal('synthetic-only'),
  observation: z.literal('read-only-before-store-inspect')
})
const recoverySchema = z.object({
  automaticRefreshes: z.number().int().min(0),
  publishes: z.number().int().min(0),
  state: z.enum(['empty', 'ready', 'recovery-required', 'unavailable']),
  generation: z.enum(['R0', 'R1', 'none', 'unexpected']),
  decryptionsBeforeRecovery: z.number().int().min(0),
  recoveryPerformed: z.boolean(),
  finalState: z.enum(['empty', 'ready', 'recovery-required', 'unavailable'])
})
const adapters = new Set([
  'adapter.create-directory',
  'adapter.create-exclusive',
  'adapter.write',
  'adapter.flush',
  'adapter.rename',
  'adapter.remove',
  'adapter.sync-directory',
  'adapter.close'
])
export type HoldEvidence = z.infer<typeof holdSchema>
export type RecoveryObservation = z.infer<typeof recoverySchema>

export function validateHold(input: unknown): HoldEvidence {
  const parsed = holdSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error('Original host hold evidence is invalid.')
  }
  const hold = parsed.data
  const selection = hold.selection
  const hasAllBytes = hold.rawRecords.length === hold.observations.length
  if (!hasAllBytes) {
    throw new Error('Original host raw records are incomplete.')
  }
  for (let index = 0; index < hold.rawRecords.length; index += 1) {
    try {
      const raw = hold.rawRecords[index]
      const bytes = Buffer.from(raw, 'base64')
      const isCanonical = bytes.toString('base64') === raw
      const parsedEvent = observationSchema.parse(JSON.parse(bytes.toString('utf8')))
      const isMatching = JSON.stringify(parsedEvent) === JSON.stringify(hold.observations[index])
      if (!isCanonical || !isMatching) {
        throw new Error('mismatch')
      }
    } catch {
      throw new Error('Original host raw record does not match its observation.')
    }
  }
  const first = hold.observations[0]
  const manifestSchema = z.object({
    kind: z.literal('dfragon-synthetic-windows-crash-v1'),
    runId: z.string(),
    caseId: z.literal('normal-control'),
    mode: z.literal('normal'),
    rootName: z
      .string()
      .regex(/^dfragon-crash-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
    invocationOwner: z.string()
  })
  const manifest = manifestSchema.safeParse(first.detail)
  if (!manifest.success) {
    throw new Error('Original host manifest is invalid.')
  }
  const isManifestEvent =
    first.cutpoint === 'run-manifest' && first.phase === 'initial' && first.outcome === 'recorded'
  const isManifestRun =
    manifest.data.runId === selection.runId && manifest.data.caseId === selection.caseId
  const isSameOwner = manifest.data.invocationOwner === hold.invocationOwner
  if (!isManifestEvent || !isManifestRun || !isSameOwner) {
    throw new Error('Original host manifest identity mismatch.')
  }
  const isAdapter = adapters.has(selection.cutpoint)
  const isBefore = selection.phase === 'before' && selection.outcome === 'not-called'
  const isAfter =
    selection.phase === 'after' &&
    (selection.outcome === 'returned' || selection.outcome === 'threw')
  const isSupported = isAdapter && (isBefore || isAfter)
  if (!isSupported) {
    throw new Error('Selected boundary is unsupported.')
  }
  for (let index = 0; index < hold.observations.length; index += 1) {
    const event = hold.observations[index]
    const isSameRun = event.runId === selection.runId
    const isSameCase = event.caseId === selection.caseId
    const isNext = event.sequence === index + 1
    const isContiguous = isSameRun && isSameCase && isNext
    if (!isContiguous) {
      throw new Error('Original host history is not contiguous.')
    }
  }
  const reached = hold.observations[hold.observations.length - 1]
  const isSameSequence = reached.sequence === selection.sequence
  const isSameCutpoint = reached.cutpoint === selection.cutpoint
  const isSamePhase = reached.phase === selection.phase
  const isSameOutcome = reached.outcome === selection.outcome
  const isReached = isSameSequence && isSameCutpoint && isSamePhase && isSameOutcome
  if (!isReached) {
    throw new Error('Selected boundary was not reached.')
  }
  return hold
}

export function syntheticGeneration(refreshToken: string): 'R0' | 'R1' | 'unexpected' {
  const isR0 = refreshToken === Buffer.alloc(32, 31).toString('base64url')
  if (isR0) {
    return 'R0'
  }
  const isR1 = refreshToken === Buffer.alloc(32, 32).toString('base64url')
  return isR1 ? 'R1' : 'unexpected'
}

export type OriginalSummary = {
  generation: string
  marker: boolean
  temporary: boolean
  directories: string[]
}
export type ReportedState = {
  marker: 'present' | 'absent' | 'unknown'
  generation: 'R0' | 'R1' | 'missing' | 'unknown'
  established: boolean
  replacementEstablished: boolean
  supersededR0: boolean
  prepared: boolean
}
export type RecoveryVerdict = {
  status: string
  original: OriginalSummary
  reported: ReportedState
  durabilityFindings: string[]
  recoveryFindings: string[]
  namespaceDurability: string
  interruption: string
}

function summarizeDisk(input: unknown): OriginalSummary {
  const parsed = diskSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error('Original disk observation is invalid.')
  }
  const directories = new Set<string>()
  const names = new Set<string>()
  let generation: string = 'missing'
  let marker = false
  let temporary = false
  for (const entry of parsed.data.entries) {
    const isDuplicate = names.has(entry.name)
    if (isDuplicate) {
      throw new Error('Original disk contains duplicate entries.')
    }
    names.add(entry.name)
    const isDirectoryName = [
      '.',
      './profile',
      './profile/auth',
      './profile/auth/synthetic'
    ].includes(entry.name)
    const isDirectory = entry.type === 'directory' && entry.protection === 'trusted'
    if (isDirectoryName && isDirectory) {
      directories.add(entry.name)
      continue
    }
    const isMissing = entry.type === 'missing' && entry.protection === 'missing' && isDirectoryName
    if (isMissing) {
      continue
    }
    const isFile = entry.type === 'file' && entry.protection === 'trusted'
    const hasBytes = typeof entry.bytes === 'string' && typeof entry.sha256 === 'string'
    if (!isFile || !hasBytes) {
      throw new Error('Original file protection or bytes are unconfirmed.')
    }
    const bytes = Buffer.from(entry.bytes!, 'base64')
    const isCanonical = bytes.toString('base64') === entry.bytes
    const isMatchingHash = createHash('sha256').update(bytes).digest('hex') === entry.sha256
    const isIntact = isCanonical && isMatchingHash
    if (!isIntact) {
      throw new Error('Original disk byte evidence does not match its hash.')
    }
    const isMarker = entry.name === './profile/auth/synthetic/transition.v1'
    if (isMarker) {
      marker = true
      continue
    }
    const isTemporary =
      /^\.\/profile\/auth\/synthetic\/\.(credential|transition)\.v1\.[0-9a-f-]{36}\.tmp$/.test(
        entry.name
      )
    if (isTemporary) {
      temporary = true
      continue
    }
    const isCredential = entry.name === './profile/auth/synthetic/credential.v1'
    if (!isCredential) {
      throw new Error('Original disk contains an unsupported entry.')
    }
    const ciphertext = readCiphertext(bytes, context)
    const hasCiphertext = ciphertext != null
    if (!hasCiphertext) {
      generation = 'corrupt'
      continue
    }
    const text = ciphertext.toString('utf8')
    const isSynthetic = text.startsWith('synthetic-only:')
    if (!isSynthetic) {
      throw new Error('Original record is not synthetic.')
    }
    const token = readRefreshToken(text.slice('synthetic-only:'.length), context)
    const hasToken = token != null
    generation = hasToken ? syntheticGeneration(token) : 'corrupt'
  }
  for (const name of names) {
    const isRoot = name === '.'
    if (isRoot) {
      continue
    }
    const parent = name.slice(0, name.lastIndexOf('/'))
    const hasObservedParent = directories.has(parent)
    if (!hasObservedParent) {
      throw new Error('Original disk parent observation is missing.')
    }
  }
  const hasRoot = names.has('.')
  if (!hasRoot) {
    throw new Error('Original disk root observation is missing.')
  }
  return { generation, marker, temporary, directories: [...directories] }
}

function reportedState(events: Observation[]): ReportedState {
  let marker: 'present' | 'absent' | 'unknown' = 'unknown'
  let generation: 'R0' | 'R1' | 'missing' | 'unknown' = 'unknown'
  let established = false
  let replacementEstablished = false
  let supersededR0 = false
  let prepared = false
  for (const event of events) {
    const isStart = event.phase === 'protocol-start'
    const isRemoving = event.cutpoint === 'store.removeTransition'
    const isWriting =
      event.cutpoint === 'store.commitCredential' || event.cutpoint === 'store.clearCredential'
    if (isStart && isWriting) {
      generation = 'unknown'
    }
    const isStartingMarker =
      event.cutpoint === 'store.establishTransition' ||
      event.cutpoint === 'store.reestablishTransition'
    if (isStart && isStartingMarker) {
      marker = 'unknown'
    }
    if (isStart && isRemoving) {
      marker = 'unknown'
    }
    const isReported = event.phase === 'protocol-return'
    if (!isReported) {
      continue
    }
    const isConfirmed = event.outcome === 'confirmed'
    const isEstablishing =
      event.cutpoint === 'store.establishTransition' ||
      event.cutpoint === 'store.reestablishTransition'
    if (isConfirmed && isEstablishing) {
      marker = 'present'
      established = true
      const detail = z.object({ scenario: z.string() }).safeParse(event.detail)
      if (!detail.success) {
        throw new Error('Reported marker scenario is missing.')
      }
      const isReplacement = detail.data.scenario === 'replace.prepare'
      if (isReplacement) {
        replacementEstablished = true
      }
    }
    if (isConfirmed && isRemoving) {
      marker = 'absent'
    }
    const isClearing = event.cutpoint === 'store.clearCredential'
    if (isConfirmed && isClearing) {
      generation = 'missing'
    }
    const isCommit = event.cutpoint === 'store.commitCredential'
    if (isConfirmed && isCommit) {
      const detail = z.object({ scenario: z.string() }).safeParse(event.detail)
      if (!detail.success) {
        throw new Error('Reported commit scenario is missing.')
      }
      const isR0 = detail.data.scenario === 'create.commit-r0'
      const isR1 = ['replace.commit-r1', 'recovery.commit-r1'].includes(detail.data.scenario)
      if (!isR0 && !isR1) {
        throw new Error('Reported generation is unsupported.')
      }
      generation = isR0 ? 'R0' : 'R1'
      if (isR1) {
        supersededR0 = true
      }
    }
    const isPreparedInspection =
      event.cutpoint === 'store.inspect' &&
      ['empty', 'ready', 'recovery-required'].includes(event.outcome)
    if (isPreparedInspection) {
      prepared = true
    }
  }
  return { marker, generation, established, replacementEstablished, prepared, supersededR0 }
}

export function judgeRecovery(input: {
  hold: unknown
  original: unknown
  recovery: unknown
}): RecoveryVerdict {
  const hold = validateHold(input.hold)
  const original = summarizeDisk(input.original)
  const parsedRecovery = recoverySchema.safeParse(input.recovery)
  if (!parsedRecovery.success) {
    throw new Error('Recovery observation is missing or invalid.')
  }
  const recovery = parsedRecovery.data
  const reported = reportedState(hold.observations)
  const durabilityFindings: string[] = []
  const recoveryFindings: string[] = []
  const hasLostMarker = reported.marker === 'present' && !original.marker
  if (hasLostMarker) {
    durabilityFindings.push('reported-marker-missing')
  }
  const hasReappearedMarker = reported.marker === 'absent' && original.marker
  if (hasReappearedMarker) {
    durabilityFindings.push('reported-marker-removal-not-preserved')
  }
  const hasLostR1 = reported.generation === 'R1' && original.generation !== 'R1'
  if (hasLostR1) {
    durabilityFindings.push('reported-r1-not-preserved')
  }
  const hasLostR0 = reported.generation === 'R0' && original.generation !== 'R0'
  if (hasLostR0) {
    durabilityFindings.push('reported-r0-not-preserved')
  }
  const hasResurrectedFiles =
    reported.generation === 'missing' && (original.generation !== 'missing' || original.temporary)
  if (hasResurrectedFiles) {
    durabilityFindings.push('reported-deletion-not-preserved')
  }
  const hasLostDirectories = reported.prepared && original.directories.length !== 4
  if (hasLostDirectories) {
    durabilityFindings.push('reported-preparation-not-preserved')
  }
  const isBlockedRecord = original.marker || original.temporary
  const isReady = recovery.state === 'ready'
  if (isBlockedRecord && isReady) {
    recoveryFindings.push('blocked-record-restored')
  }
  const hasBlockedDecryption = isBlockedRecord && recovery.decryptionsBeforeRecovery !== 0
  if (hasBlockedDecryption) {
    recoveryFindings.push('blocked-credential-decrypted')
  }
  const needsClear = isBlockedRecord || original.generation === 'corrupt'
  const hasRecord = original.generation !== 'missing'
  const expectedState = needsClear ? 'recovery-required' : hasRecord ? 'ready' : 'empty'
  const isExpectedState = recovery.state === expectedState
  if (!isExpectedState) {
    recoveryFindings.push('inspection-state-mismatch')
  }
  const isUnexpectedRecovery =
    !needsClear && (recovery.recoveryPerformed || recovery.finalState !== expectedState)
  if (isUnexpectedRecovery) {
    recoveryFindings.push('unexpected-recovery-action')
  }
  const isSupersededR0 = reported.supersededR0 && isReady && recovery.generation === 'R0'
  if (isSupersededR0) {
    recoveryFindings.push('superseded-r0-restored')
  }
  const isCleanRecovery = recovery.recoveryPerformed && recovery.finalState === 'empty'
  if (needsClear && !isCleanRecovery) {
    recoveryFindings.push('recovery-not-clean')
  }
  const hasUncertainR0 =
    reported.replacementEstablished &&
    reported.marker !== 'absent' &&
    isReady &&
    recovery.generation === 'R0'
  if (hasUncertainR0) {
    recoveryFindings.push('uncertain-r0-restored')
  }
  const isWrongGeneration = isReady && recovery.generation !== original.generation
  if (isWrongGeneration) {
    recoveryFindings.push('restored-generation-mismatch')
  }
  const isUnavailable = recovery.state === 'unavailable' || recovery.finalState === 'unavailable'
  if (isUnavailable) {
    recoveryFindings.push('recovery-unavailable')
  }
  const hasAutomaticUse = recovery.automaticRefreshes !== 0 || recovery.publishes !== 0
  if (hasAutomaticUse) {
    recoveryFindings.push('automatic-credential-use')
  }
  const hasFindings = durabilityFindings.length > 0 || recoveryFindings.length > 0
  return {
    status: hasFindings ? 'findings' : 'observed-consistent',
    original,
    reported,
    durabilityFindings,
    recoveryFindings,
    namespaceDurability: 'unverified',
    interruption: 'external-evidence-required'
  }
}
