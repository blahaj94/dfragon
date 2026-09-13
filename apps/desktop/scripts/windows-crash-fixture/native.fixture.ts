import { it, expect } from 'vitest'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join } from 'node:path/win32'
import { createWindowsCredentialNative } from '../../src/backend/auth/credential-store/windows-credential-native'
import { createWindowsSecurityNative } from '../../src/backend/auth/windows-security-native'
import { createObserver } from './observer'
import { fileExchange, publishEvidence } from './transport'
import { runScenarios } from './scenarios'

type Settings = {
  runId: string
  caseId: string
  root: string
  evidence: string
  mode: 'normal' | 'recover'
  originManifest?: string
}

async function readSettings(): Promise<Settings> {
  const isWindows = process.platform === 'win32'
  if (!isWindows) {
    throw new Error('Windows crash fixture requires Windows.')
  }
  const configuration = process.env.LDB_CRASH_CONFIG
  const hasConfiguration = configuration != null
  if (!hasConfiguration) {
    throw new Error('LDB_CRASH_CONFIG is required.')
  }
  const settings = JSON.parse(await readFile(configuration, 'utf8')) as Settings
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
  let path = dirname(settings.root)
  while (true) {
    const inspection = security.inspect(path, 'directory', 'ancestor')
    const isTrusted = inspection === 'trusted'
    if (!isTrusted) {
      throw new Error('Synthetic fixture ancestor protection is unconfirmed.')
    }
    const parent = dirname(path)
    const isVolume = parent === path
    if (isVolume) {
      break
    }
    path = parent
  }
  const evidenceInfo = await lstat(settings.evidence)
  const isEvidenceDirectory = evidenceInfo.isDirectory() && !evidenceInfo.isSymbolicLink()
  const isEvidenceEmpty = (await readdir(settings.evidence)).length === 0
  if (!isEvidenceDirectory || !isEvidenceEmpty) {
    throw new Error('Evidence directory must be a new empty plain directory.')
  }
  const isNormal = settings.mode === 'normal'
  if (isNormal) {
    const rootStatus = security.inspect(settings.root, 'directory')
    const isMissing = rootStatus === 'missing'
    if (!isMissing) {
      throw new Error('Normal control refuses to reuse a fixture root.')
    }
  } else {
    const hasManifest = typeof settings.originManifest === 'string'
    if (!hasManifest) {
      throw new Error('Recovery requires the original manifest.')
    }
    const manifest = JSON.parse(await readFile(settings.originManifest!, 'utf8'))
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

async function runFixture(): Promise<void> {
  const settings = await readSettings()
  expect(createWindowsCredentialNative().capabilities).toEqual({
    profileProtection: 'unknown',
    fileMutation: 'unknown',
    namespaceMutation: 'unknown'
  })
  await publishEvidence(join(settings.evidence, 'manifest.json'), {
    kind: 'ldb-synthetic-windows-crash-v1',
    runId: settings.runId,
    caseId: settings.caseId,
    mode: settings.mode,
    rootName: basename(settings.root),
    capability: 'harness-only-confirmed',
    productCapability: 'unchanged-unknown',
    observerScope: 'external-host-ack-required',
    namespaceDurability: 'unverified',
    unsupportedCutpoints: [
      'inside-synchronous-native-method',
      'FileDispositionInfo-to-CloseHandle',
      'physical-power-loss'
    ]
  })
  const observer = createObserver({
    ...settings,
    timeoutMs: 30_000,
    exchange: fileExchange(settings.evidence)
  })
  let failure = true
  try {
    const result = await runScenarios({ ...settings, observer })
    await observer.observe({
      cutpoint: 'run',
      phase: 'terminal',
      outcome: settings.mode === 'normal' ? 'completed' : 'observed-unverified',
      detail: result
    })
    await publishEvidence(join(settings.evidence, 'result.json'), {
      runId: settings.runId,
      caseId: settings.caseId,
      status: settings.mode === 'normal' ? 'passed' : 'observed-unverified',
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
        artifactsPreserved: true,
        cleanup: 'not-performed'
      })
    }
  }
  expect(failure).toBe(false)
}

it('runs synthetic native normal controls with host ACK and preserves evidence', async () => {
  try {
    await runFixture()
  } catch {
    throw new Error('Synthetic Windows fixture failed; preserve guest and host evidence.')
  }
})
