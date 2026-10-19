import { copyFile, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import scoreEngineConfig from '../score-engine.config.mjs'

const appRoot = fileURLToPath(new URL('../', import.meta.url))
const engineSource = join(
  dirname(fileURLToPath(import.meta.resolve('@dfragon/models/package.json'))),
  'score-engine'
)

/**
 * @typedef {{ destination: string, targets: Record<string, string> }} ScoreEngineConfig
 * @typedef {{ kind: 'skipped', reason: 'not-checked-out' | 'unsupported-target' } | { kind: 'installed', path: string }} ScoreEnginePreparation
 */

/**
 * score-engine submodule의 플랫폼별 엔진을 패키지 resources/score/에 둔다.
 * 비공개 submodule을 받지 않은 checkout(포크 PR, 권한 없는 로컬)은 엔진 없이 진행하도록 건너뛴다.
 * @param {{ config?: ScoreEngineConfig, target?: string, root?: string, source?: string }} [options]
 * @returns {Promise<ScoreEnginePreparation>}
 */
export async function prepareScoreEngine({
  config = scoreEngineConfig,
  target = `${process.platform}-${process.arch}`,
  root = appRoot,
  source = engineSource
} = {}) {
  const file = config.targets[target]
  if (file == null) {
    return { kind: 'skipped', reason: 'unsupported-target' }
  }

  const directory = resolve(root, config.destination)
  const path = join(directory, file)
  const temporary = `${path}.copy`
  await mkdir(directory, { recursive: true })
  // 복사한 바이너리가 Git에 들어가지 않도록 폴더 스스로 무시한다.
  await writeFile(join(directory, '.gitignore'), '*\n')
  try {
    await copyFile(join(source, file), temporary)
    await rename(temporary, path)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { kind: 'skipped', reason: 'not-checked-out' }
    }

    throw error
  } finally {
    await rm(temporary, { force: true })
  }

  return { kind: 'installed', path }
}

const REQUIRED_REASONS = {
  'not-checked-out': 'the packages/models/score-engine submodule is not checked out',
  'unsupported-target': 'no score engine library for this platform'
}

const SKIP_MESSAGES = {
  'not-checked-out':
    'The packages/models/score-engine submodule is not checked out. Building without the score engine.',
  'unsupported-target':
    'No score engine library for this platform. Building without the score engine.'
}

/**
 * Release 빌드는 엔진을 반드시 싣는다.
 * @param {ScoreEnginePreparation} result
 * @returns {void}
 */
export function assertScoreEngineIncluded(result) {
  if (result.kind === 'skipped') {
    throw new Error(`Release builds require the score engine: ${REQUIRED_REASONS[result.reason]}.`)
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
