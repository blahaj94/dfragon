import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createDependencySnapshot } from '../dependency-snapshot.mjs'

const script = fileURLToPath(new URL('../dependency-snapshot.mjs', import.meta.url))
const sha = 'a'.repeat(40)
const context = { sha, ref: 'refs/heads/main', correlator: 'Dependency Review submit', runId: '42' }

// pnpm sbom --sbom-format cyclonedx --lockfile-only의 형태를 줄인 workspace다.
function pnpmSbom() {
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.7',
    metadata: {
      timestamp: '2026-10-08T16:04:38.763Z',
      tools: { components: [{ type: 'application', name: 'pnpm', version: '11.23.0' }] },
      component: { name: '@dfragon', purl: 'pkg:npm/%40dfragon@1.0.0', 'bom-ref': 'root' }
    },
    components: [
      { 'bom-ref': 'nest', purl: 'pkg:npm/%40nestjs/core@12.0.1', scope: null },
      { 'bom-ref': 'multer', purl: 'pkg:npm/multer@2.4.0' },
      { 'bom-ref': 'vitest', purl: 'pkg:npm/vitest@4.1.11', scope: 'excluded' },
      { 'bom-ref': 'undici', purl: 'pkg:npm/undici@8.10.2', scope: 'excluded' }
    ],
    dependencies: [
      { ref: 'root', dependsOn: ['nest', 'vitest'] },
      { ref: 'nest', dependsOn: ['multer'] },
      { ref: 'multer' },
      { ref: 'vitest', dependsOn: ['undici'] },
      { ref: 'undici', dependsOn: [] }
    ]
  }
}

test('pnpm SBOM의 전이 의존성까지 pnpm-lock.yaml snapshot 하나로 옮긴다', () => {
  assert.deepEqual(createDependencySnapshot(pnpmSbom(), context), {
    version: 0,
    sha,
    ref: 'refs/heads/main',
    job: { correlator: 'Dependency Review submit', id: '42' },
    detector: { name: 'pnpm sbom', version: '11.23.0', url: 'https://pnpm.io/cli/sbom' },
    scanned: '2026-10-08T16:04:38.763Z',
    manifests: {
      'pnpm-lock.yaml': {
        name: 'pnpm-lock.yaml',
        file: { source_location: 'pnpm-lock.yaml' },
        resolved: {
          'pkg:npm/%40nestjs/core@12.0.1': {
            package_url: 'pkg:npm/%40nestjs/core@12.0.1',
            relationship: 'direct',
            scope: 'runtime',
            dependencies: ['pkg:npm/multer@2.4.0']
          },
          'pkg:npm/multer@2.4.0': {
            package_url: 'pkg:npm/multer@2.4.0',
            relationship: 'indirect',
            scope: 'runtime',
            dependencies: []
          },
          'pkg:npm/vitest@4.1.11': {
            package_url: 'pkg:npm/vitest@4.1.11',
            relationship: 'direct',
            scope: 'development',
            dependencies: ['pkg:npm/undici@8.10.2']
          },
          'pkg:npm/undici@8.10.2': {
            package_url: 'pkg:npm/undici@8.10.2',
            relationship: 'indirect',
            scope: 'development',
            dependencies: []
          }
        }
      }
    }
  })
})

test('PR merge ref나 축약 SHA로는 snapshot을 만들지 않는다', () => {
  const invalidSha = { message: 'Expected a lowercase 40-character commit SHA' }
  const invalidRef = { message: 'Expected a branch ref such as refs/heads/main' }
  for (const [override, expected] of [
    [{ sha: 'a'.repeat(7) }, invalidSha],
    [{ sha: 'A'.repeat(40) }, invalidSha],
    [{ ref: 'refs/pull/1/merge' }, invalidRef],
    [{ ref: 'main' }, invalidRef]
  ]) {
    assert.throws(() => createDependencySnapshot(pnpmSbom(), { ...context, ...override }), expected)
  }
})

test('SBOM 그래프가 불완전하거나 pnpm 형식이 아니면 snapshot을 만들지 않는다', () => {
  const cases = [
    [
      (sbom) => sbom.dependencies[1].dependsOn.push('missing'),
      'Unknown SBOM dependency missing of nest'
    ],
    [(sbom) => sbom.dependencies.shift(), 'Expected the SBOM to list the workspace dependencies'],
    [
      (sbom) => {
        sbom.components[0].purl = 'pkg:github/blahaj94/dfragon@main'
      },
      'Expected an npm purl for nest'
    ],
    [(sbom) => sbom.components.push({ ...sbom.components[0] }), 'Duplicate SBOM component nest'],
    [
      (sbom) => {
        sbom.metadata.tools.components = []
      },
      'Expected the pnpm tool version to be a non-empty string'
    ]
  ]
  for (const [corrupt, message] of cases) {
    const sbom = pnpmSbom()
    corrupt(sbom)
    assert.throws(() => createDependencySnapshot(sbom, context), { message })
  }
})

test('CLI는 workflow 환경값으로 snapshot을 쓰고, 값이 없으면 파일을 만들지 않는다', (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'dfragon-dependency-snapshot-'))
  t.after(() => rmSync(folder, { recursive: true, force: true }))
  const sbomPath = join(folder, 'pnpm.cdx.json')
  const snapshotPath = join(folder, 'snapshot.json')
  writeFileSync(sbomPath, JSON.stringify(pnpmSbom()))
  const env = {
    PATH: process.env.PATH,
    SNAPSHOT_SHA: sha,
    SNAPSHOT_REF: 'refs/heads/repo-605-add-dependency-review',
    GITHUB_WORKFLOW: 'Dependency Review',
    GITHUB_JOB: 'submit',
    GITHUB_RUN_ID: '7'
  }

  const missingSha = spawnSync(process.execPath, [script, sbomPath, snapshotPath], {
    env: { ...env, SNAPSHOT_SHA: '' }
  })
  assert.equal(missingSha.status, 1)
  assert.equal(existsSync(snapshotPath), false)

  const result = spawnSync(process.execPath, [script, sbomPath, snapshotPath], { env })
  assert.equal(result.status, 0, result.stderr.toString())
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'))
  assert.equal(snapshot.sha, sha)
  assert.equal(snapshot.ref, 'refs/heads/repo-605-add-dependency-review')
  assert.deepEqual(snapshot.job, { correlator: 'Dependency Review submit', id: '7' })
})
