import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const LOCKFILE_PATH = 'pnpm-lock.yaml'
const DETECTOR_NAME = 'pnpm sbom'
const DETECTOR_URL = 'https://pnpm.io/cli/sbom'
const SOURCE_COMMIT_PATTERN = /^[0-9a-f]{40}$/
const NPM_PURL_PATTERN = /^pkg:npm\/\S+@\S+$/
const BRANCH_REF_PREFIX = 'refs/heads/'

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function requireString(value, name) {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`Expected ${name} to be a non-empty string`)
  }

  return value
}

function pnpmVersion(metadata) {
  const tools = metadata.tools?.components
  const pnpm = Array.isArray(tools) ? tools.find((tool) => tool?.name === 'pnpm') : undefined

  return requireString(pnpm?.version, 'the pnpm tool version')
}

function scannedAt(metadata) {
  const timestamp = requireString(metadata.timestamp, 'the SBOM timestamp')
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new Error('Expected the SBOM timestamp to be a date')
  }

  return timestamp
}

function componentsByReference(components) {
  if (!Array.isArray(components)) {
    throw new Error('Expected SBOM components to be an array')
  }
  const byReference = new Map()
  for (const component of components) {
    const reference = requireString(component?.['bom-ref'], 'a component bom-ref')
    const url = requireString(component.purl, `the purl of ${reference}`)
    if (!NPM_PURL_PATTERN.test(url)) {
      throw new Error(`Expected an npm purl for ${reference}`)
    }

    if (byReference.has(reference)) {
      throw new Error(`Duplicate SBOM component ${reference}`)
    }
    byReference.set(reference, { url, scope: component.scope })
  }

  return byReference
}

function childrenByReference(dependencies, knownReferences) {
  if (!Array.isArray(dependencies)) {
    throw new Error('Expected SBOM dependencies to be an array')
  }
  const byReference = new Map()
  for (const dependency of dependencies) {
    const reference = requireString(dependency?.ref, 'a dependency ref')
    const dependsOn = dependency.dependsOn ?? []
    if (!Array.isArray(dependsOn)) {
      throw new Error(`Expected dependsOn of ${reference} to be an array`)
    }
    for (const child of dependsOn) {
      if (!knownReferences.has(child)) {
        throw new Error(`Unknown SBOM dependency ${child} of ${reference}`)
      }
    }
    byReference.set(reference, dependsOn)
  }

  return byReference
}

/**
 * GitHub's static dependency graph reads only the first document of a pnpm 11 lockfile, which holds
 * the pnpm binary rather than the workspace. Submit the whole workspace from pnpm's own SBOM instead.
 */
export function createDependencySnapshot(sbom, { sha, ref, correlator, runId }) {
  if (typeof sha !== 'string' || !SOURCE_COMMIT_PATTERN.test(sha)) {
    throw new Error('Expected a lowercase 40-character commit SHA')
  }

  if (typeof ref !== 'string' || !ref.startsWith(BRANCH_REF_PREFIX)) {
    throw new Error('Expected a branch ref such as refs/heads/main')
  }

  if (!isRecord(sbom) || !isRecord(sbom.metadata)) {
    throw new Error('Expected a CycloneDX SBOM with metadata')
  }
  const rootReference = requireString(sbom.metadata.component?.['bom-ref'], 'the root bom-ref')
  const job = {
    correlator: requireString(correlator, 'the job correlator'),
    id: requireString(runId, 'the job id')
  }
  const detector = { name: DETECTOR_NAME, version: pnpmVersion(sbom.metadata), url: DETECTOR_URL }
  const scanned = scannedAt(sbom.metadata)
  const components = componentsByReference(sbom.components)
  const children = childrenByReference(sbom.dependencies, components)
  if (!children.has(rootReference)) {
    throw new Error('Expected the SBOM to list the workspace dependencies')
  }
  const directReferences = new Set(children.get(rootReference))
  const resolved = {}
  for (const [reference, { url, scope }] of components) {
    resolved[url] = {
      package_url: url,
      relationship: directReferences.has(reference) ? 'direct' : 'indirect',
      // pnpm marks packages reachable only through devDependencies as CycloneDX `excluded`.
      scope: scope === 'excluded' ? 'development' : 'runtime',
      dependencies: (children.get(reference) ?? []).map((child) => components.get(child).url)
    }
  }

  return {
    version: 0,
    sha,
    ref,
    job,
    detector,
    scanned,
    manifests: {
      [LOCKFILE_PATH]: { name: LOCKFILE_PATH, file: { source_location: LOCKFILE_PATH }, resolved }
    }
  }
}

function main() {
  const args = process.argv.slice(2)
  if (args.length !== 2) {
    throw new Error('Usage: dependency-snapshot.mjs <cyclonedx-sbom-file> <snapshot-file>')
  }
  const [sbomPath, snapshotPath] = args
  const workflow = requireString(process.env.GITHUB_WORKFLOW, 'GITHUB_WORKFLOW')
  const job = requireString(process.env.GITHUB_JOB, 'GITHUB_JOB')
  const snapshot = createDependencySnapshot(JSON.parse(readFileSync(sbomPath, 'utf8')), {
    sha: process.env.SNAPSHOT_SHA,
    ref: process.env.SNAPSHOT_REF,
    // GitHub uses only the latest snapshot for each correlator and detector name.
    correlator: `${workflow} ${job}`,
    runId: process.env.GITHUB_RUN_ID
  })
  writeFileSync(snapshotPath, JSON.stringify(snapshot) + '\n')
}

const entryPath = process.argv[1]
if (entryPath != null && import.meta.url === pathToFileURL(entryPath).href) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
