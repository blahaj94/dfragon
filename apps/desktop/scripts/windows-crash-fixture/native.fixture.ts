import { it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join } from 'node:path/win32'
import { createWindowsSecurityNative } from '../../src/backend/auth/windows-security-native'
import { createObserver } from './observer'
import { validateHold, type HoldEvidence } from './oracle'
import { fileExchange, publishEvidence } from './transport'
import { runScenarios } from './scenarios'
import { assertFixtureAncestors } from './isolation'
import { createStageDiagnostic, type StageDiagnostic } from './diagnostics'

type Settings = {
  runId: string
  caseId: string
  root: string
  evidence: string
  mode: 'normal' | 'recover'
  originManifest?: string
  originHostHold?: string
  originHostHoldSha256?: string
  originHold?: HoldEvidence
  ackTimeoutMs?: number
}

async function readSettings(diagnostic: StageDiagnostic): Promise<Settings> {
  const isWindows = process.platform === 'win32'
  if (!isWindows) {
    throw new Error('Windows crash fixture requires Windows.')
  }
  const configuration = process.env.LDB_CRASH_CONFIG
  const hasConfiguration = configuration != null
  if (!hasConfiguration) {
    throw new Error('LDB_CRASH_CONFIG is required.')
  }
  const contents = await readFile(configuration, 'utf8')
  diagnostic.enter('config-parse')
  const settings = JSON.parse(contents) as Settings
  diagnostic.enter('config-shape')
  const hasRun = typeof settings.runId === 'string' && /^[a-z0-9-]{1,80}$/.test(settings.runId)
  const hasCase = settings.caseId === 'normal-control' || settings.caseId === 'recovery'
  const hasRoot = typeof settings.root === 'string' && isAbsolute(settings.root)
  const hasEvidence = typeof settings.evidence === 'string' && isAbsolute(settings.evidence)
  const hasMode = settings.mode === 'normal' || settings.mode === 'recover'
  const isMatchingMode =
    (settings.mode === 'normal' && settings.caseId === 'normal-control') ||
    (settings.mode === 'recover' && settings.caseId === 'recovery')
  const isValid = hasRun && hasCase && hasRoot && hasEvidence && hasMode && isMatchingMode
  if (!isValid) {
    throw new Error('Synthetic fixture settings are invalid.')
  }
  const ackTimeoutMs = settings.ackTimeoutMs ?? 30_000
  const isTimeoutValid =
    Number.isInteger(ackTimeoutMs) && ackTimeoutMs >= 30_000 && ackTimeoutMs <= 900_000
  if (!isTimeoutValid) {
    throw new Error('Fixture ACK timeout is invalid.')
  }
  settings.ackTimeoutMs = ackTimeoutMs
  diagnostic.enter('isolation')
  const hasOwnedName =
    /^ldb-crash-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      basename(settings.root)
    )
  const isEvidenceSibling = dirname(settings.evidence) === dirname(settings.root)
  const hasEvidenceName =
    basename(settings.evidence) === `${basename(settings.root)}-${settings.runId}-evidence`
  const isIsolated = hasOwnedName && isEvidenceSibling && hasEvidenceName
  if (!isIsolated) {
    throw new Error('Synthetic root and evidence are not isolated siblings.')
  }
  const security = createWindowsSecurityNative()
  diagnostic.enter('ancestor-inspection')
  await assertFixtureAncestors({ root: settings.root, security })
  diagnostic.enter('evidence-inspection')
  const evidenceInfo = await lstat(settings.evidence)
  const isEvidenceDirectory = evidenceInfo.isDirectory() && !evidenceInfo.isSymbolicLink()
  const isEvidenceEmpty = (await readdir(settings.evidence)).length === 0
  if (!isEvidenceDirectory || !isEvidenceEmpty) {
    throw new Error('Evidence directory must be a new empty plain directory.')
  }
  const isNormal = settings.mode === 'normal'
  if (isNormal) {
    diagnostic.enter('root-inspection')
    const rootStatus = security.inspect(settings.root, 'directory')
    const isMissing = rootStatus === 'missing'
    if (!isMissing) {
      throw new Error('Normal control refuses to reuse a fixture root.')
    }
  } else {
    diagnostic.enter('recovery-manifest')
    const hasManifest = typeof settings.originManifest === 'string'
    if (!hasManifest) {
      throw new Error('Recovery requires the original manifest.')
    }
    const manifest = JSON.parse(await readFile(settings.originManifest!, 'utf8'))
    const hasHostHold = typeof settings.originHostHold === 'string'
    if (!hasHostHold) {
      throw new Error('Recovery requires original host-held evidence.')
    }
    const holdInfo = await lstat(settings.originHostHold!)
    const isBoundedPlainFile =
      holdInfo.isFile() && !holdInfo.isSymbolicLink() && holdInfo.size <= 16_777_216
    if (!isBoundedPlainFile) {
      throw new Error('Original host hold is not a bounded plain file.')
    }
    const heldBytes = await readFile(settings.originHostHold!)
    const expectedHash = settings.originHostHoldSha256
    const isHashShape = typeof expectedHash === 'string' && /^[0-9a-f]{64}$/.test(expectedHash)
    const hasMatchingHash = createHash('sha256').update(heldBytes).digest('hex') === expectedHash
    if (!isHashShape || !hasMatchingHash) {
      throw new Error('Original host hold transfer hash mismatch.')
    }
    settings.originHold = validateHold(JSON.parse(heldBytes.toString('utf8')))
    const hostManifest = settings.originHold.observations[0].detail as Record<string, unknown>
    const isSameHostRoot = hostManifest.rootName === basename(settings.root)
    const isSameOriginalRun =
      hostManifest.runId === manifest.runId && hostManifest.caseId === manifest.caseId
    const isSameOwner = hostManifest.invocationOwner === manifest.invocationOwner
    const isNewRecoveryRun = settings.runId !== manifest.runId
    if (!isSameHostRoot || !isSameOriginalRun || !isSameOwner || !isNewRecoveryRun) {
      throw new Error('Recovery host/origin identity mismatch.')
    }
    const hasMatchingRoot = manifest.rootName === basename(settings.root)
    const hasMatchingParent = dirname(dirname(settings.originManifest!)) === dirname(settings.root)
    const hasOriginalEvidenceName =
      basename(dirname(settings.originManifest!)) ===
      `${manifest.rootName}-${manifest.runId}-evidence`
    const hasManifestName = basename(settings.originManifest!) === 'manifest.json'
    const isSynthetic = manifest.kind === 'ldb-synthetic-windows-crash-v1'
    const isOriginal = manifest.mode === 'normal'
    if (
      !hasMatchingRoot ||
      !hasMatchingParent ||
      !hasOriginalEvidenceName ||
      !hasManifestName ||
      !isSynthetic ||
      !isOriginal
    ) {
      throw new Error('Recovery manifest does not own this synthetic root.')
    }
  }
  return settings
}

async function runFixture(diagnostic: StageDiagnostic): Promise<void> {
  const settings = await readSettings(diagnostic)
  diagnostic.enter('manifest-publication')
  const manifest = {
    kind: 'ldb-synthetic-windows-crash-v1',
    invocationOwner: process.env.LDB_CRASH_OWNER ?? 'standalone',
    runId: settings.runId,
    caseId: settings.caseId,
    mode: settings.mode,
    rootName: basename(settings.root),
    observerScope: 'external-host-ack-required',
    namespaceDurability: 'unverified',
    unsupportedCutpoints: [
      'inside-synchronous-native-method',
      'FileDispositionInfo-to-CloseHandle',
      'physical-power-loss'
    ]
  }
  await publishEvidence(join(settings.evidence, 'manifest.json'), manifest)
  const observer = createObserver({
    ...settings,
    timeoutMs: settings.ackTimeoutMs!,
    exchange: fileExchange(settings.evidence)
  })
  let failure = true
  try {
    await observer.observe({
      cutpoint: 'run-manifest',
      phase: 'initial',
      outcome: 'recorded',
      detail: manifest
    })
    diagnostic.enter('scenario')
    const result = await runScenarios({ ...settings, observer })
    diagnostic.enter('terminal-publication')
    await observer.observe({
      cutpoint: 'run',
      phase: 'terminal',
      outcome: settings.mode === 'normal' ? 'completed' : result.verdict!.status,
      detail: result
    })
    diagnostic.enter('result-publication')
    await publishEvidence(join(settings.evidence, 'result.json'), {
      runId: settings.runId,
      caseId: settings.caseId,
      status: settings.mode === 'normal' ? 'passed' : result.verdict!.status,
      ...result,
      namespaceDurability: 'unverified'
    })
    failure = false
  } catch {
    // Do not forward native errors or configured absolute paths to Vitest output.
    failure = true
  } finally {
    if (failure) {
      await publishEvidence(join(settings.evidence, 'failure.json'), {
        runId: settings.runId,
        caseId: settings.caseId,
        status: 'failed',
        stage: diagnostic.current(),
        artifactsPreserved: true,
        cleanup: 'not-performed'
      })
    }
  }
  expect(failure).toBe(false)
}

it('runs synthetic native normal controls with host ACK and preserves evidence', async () => {
  const diagnostic = createStageDiagnostic()
  await diagnostic.run(() => runFixture(diagnostic))
})
