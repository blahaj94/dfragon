import { createHash } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import scoreEngineConfig from '../score-engine.config.mjs'

const appRoot = fileURLToPath(new URL('../', import.meta.url))
const GITHUB_API_ORIGIN = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const MAX_ASSET_BYTES = 64 * 1024 * 1024
const ASSET_TOO_LARGE_MESSAGE = 'Score engine asset is larger than the allowed size.'

/**
 * @typedef {{ asset: string, file: string, sha256: string }} ScoreEngineTarget
 * @typedef {{ published: boolean, tag: string, destination: string, targets: Record<string, ScoreEngineTarget> }} ScoreEngineConfig
 * @typedef {{ kind: 'skipped', reason: 'unpublished' | 'no-token' | 'unsupported-target' } | { kind: 'installed', path: string }} ScoreEnginePreparation
 */

/**
 * @param {Response} response
 * @returns {Promise<Buffer>}
 */
async function readAsset(response) {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_ASSET_BYTES) {
    throw new Error(ASSET_TOO_LARGE_MESSAGE)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > MAX_ASSET_BYTES) {
    throw new Error(ASSET_TOO_LARGE_MESSAGE)
  }

  return bytes
}

/**
 * 비공개 Release의 엔진 자산을 받아 SHA256을 대조하고 패키지 resources/score/에 둔다.
 * 미발행 설정이나 토큰이 없는 빌드(포크 PR, 로컬)는 엔진 없이 진행하도록 건너뛴다.
 * @param {{ config?: ScoreEngineConfig, env?: Record<string, string | undefined>, target?: string, root?: string, fetch?: typeof fetch }} [options]
 * @returns {Promise<ScoreEnginePreparation>}
 */
export async function prepareScoreEngine({
  config = scoreEngineConfig,
  env = process.env,
  target = `${process.platform}-${process.arch}`,
  root = appRoot,
  fetch: transport = fetch
} = {}) {
  if (!config.published) {
    return { kind: 'skipped', reason: 'unpublished' }
  }
  const token = env.DFRAGON_SCORE_ENGINE_TOKEN
  if (token == null || token === '') {
    return { kind: 'skipped', reason: 'no-token' }
  }
  const entry = config.targets[target]
  if (entry == null) {
    return { kind: 'skipped', reason: 'unsupported-target' }
  }
  const repository = env.DFRAGON_SCORE_ENGINE_REPOSITORY ?? ''
  if (!REPOSITORY_PATTERN.test(repository)) {
    throw new Error(
      'Set DFRAGON_SCORE_ENGINE_REPOSITORY to <owner>/<name> with the score engine token.'
    )
  }

  if (!SHA256_PATTERN.test(entry.sha256)) {
    throw new Error('Set a lowercase SHA256 for the score engine asset in score-engine.config.mjs.')
  }
  const authorization = {
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': GITHUB_API_VERSION
  }
  const releaseUrl = `${GITHUB_API_ORIGIN}/repos/${repository}/releases/tags/${encodeURIComponent(config.tag)}`
  const release = await transport(releaseUrl, {
    headers: { ...authorization, Accept: 'application/vnd.github+json' },
    redirect: 'error'
  })
  if (!release.ok) {
    throw new Error(`Could not read score engine release ${config.tag} (HTTP ${release.status}).`)
  }
  const { assets } = await release.json()
  const asset = Array.isArray(assets) ? assets.find(({ name }) => name === entry.asset) : undefined
  const assetPrefix = `${GITHUB_API_ORIGIN}/repos/${repository}/releases/assets/`
  if (asset == null || typeof asset.url !== 'string' || !asset.url.startsWith(assetPrefix)) {
    throw new Error(`Score engine release ${config.tag} has no ${entry.asset} asset.`)
  }
  // GitHub은 자산을 서명한 저장소 주소로 redirect한다. 토큰을 그 주소로 넘기지 않게 직접 따라간다.
  let response = await transport(asset.url, {
    headers: { ...authorization, Accept: 'application/octet-stream' },
    redirect: 'manual'
  })
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (location == null || new URL(location).protocol !== 'https:') {
      throw new Error('Score engine asset redirect is not an HTTPS address.')
    }
    response = await transport(location, { redirect: 'error' })
  }

  if (!response.ok) {
    throw new Error(
      `Could not download score engine asset ${entry.asset} (HTTP ${response.status}).`
    )
  }
  const bytes = await readAsset(response)
  if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
    throw new Error('Score engine asset checksum mismatch.')
  }
  const directory = resolve(root, config.destination)
  await mkdir(directory, { recursive: true })
  // 받은 바이너리가 Git에 들어가지 않도록 폴더 스스로 무시한다.
  await writeFile(join(directory, '.gitignore'), '*\n')
  const path = join(directory, entry.file)
  const temporary = `${path}.download`
  try {
    await writeFile(temporary, bytes)
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true })
  }

  return { kind: 'installed', path }
}

const SKIP_MESSAGES = {
  unpublished: 'Score engine release is not published yet. Building without the score engine.',
  'no-token': 'DFRAGON_SCORE_ENGINE_TOKEN is not set. Building without the score engine.',
  'unsupported-target':
    'No score engine asset for this platform. Building without the score engine.'
}

/**
 * Release 빌드는 발행된 엔진을 반드시 싣는다. 미발행 동안에는 엔진 없이 빌드한다.
 * @param {ScoreEnginePreparation} result
 * @returns {void}
 */
export function assertScoreEngineIncluded(result) {
  if (result.kind === 'skipped' && result.reason !== 'unpublished') {
    throw new Error(SKIP_MESSAGES[result.reason])
  }
}

const invokedPath = process.argv[1]
if (
  invokedPath != null &&
  invokedPath !== '' &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  const result = await prepareScoreEngine()
  if (process.argv.includes('--require')) {
    assertScoreEngineIncluded(result)
  }

  if (result.kind === 'skipped') {
    console.log(SKIP_MESSAGES[result.reason])
  } else {
    console.log('Placed the score engine in resources/score.')
  }
}
