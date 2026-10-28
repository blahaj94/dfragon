import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import scoreEngineConfig from '../score-engine.config.mjs'
import { SCORE_LIBRARY_FILE_NAMES } from '../src/backend/score/engine'
import { assertScoreEngineIncluded, prepareScoreEngine } from './prepare-score-engine.mjs'

const engineBytes = Buffer.from('synthetic engine library')
const config = { destination: 'resources/score', targets: { 'win32-x64': 'dnfscore.dll' } }

const roots = []
async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'dfragon-score-engine-'))
  roots.push(root)

  return root
}

async function checkedOutSource(bytes = engineBytes) {
  const source = await temporaryRoot()
  await writeFile(join(source, 'dnfscore.dll'), bytes)

  return source
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('점수 엔진 준비', () => {
  it('submodule의 엔진을 resources/score에 복사하고 폴더를 Git에서 제외한다', async () => {
    const root = await temporaryRoot()
    const source = await checkedOutSource()

    const result = await prepareScoreEngine({ config, target: 'win32-x64', root, source })

    const path = join(root, 'resources', 'score', 'dnfscore.dll')
    expect(result).toEqual({ kind: 'installed', path })
    expect(await readFile(path)).toEqual(engineBytes)
    expect(await readFile(join(root, 'resources', 'score', '.gitignore'), 'utf8')).toBe('*\n')
    expect((await readdir(join(root, 'resources', 'score'))).sort()).toEqual([
      '.gitignore',
      'dnfscore.dll'
    ])
  })

  it('이미 둔 엔진은 submodule의 파일로 바꾼다', async () => {
    const root = await temporaryRoot()
    const target = join(root, 'resources', 'score')
    await mkdir(target, { recursive: true })
    await writeFile(join(target, 'dnfscore.dll'), 'old engine')
    const source = await checkedOutSource(Buffer.from('new engine'))

    await prepareScoreEngine({ config, target: 'win32-x64', root, source })

    expect(await readFile(join(target, 'dnfscore.dll'), 'utf8')).toBe('new engine')
  })

  it('비공개 submodule을 받지 않았으면 엔진 없이 진행한다', async () => {
    const root = await temporaryRoot()
    const source = await temporaryRoot()

    const result = await prepareScoreEngine({ config, target: 'win32-x64', root, source })

    expect(result).toEqual({ kind: 'skipped', reason: 'not-checked-out' })
    expect(await readdir(join(root, 'resources', 'score'))).toEqual(['.gitignore'])
  })

  it('엔진이 없는 플랫폼은 건너뛴다', async () => {
    const root = await temporaryRoot()
    const source = await checkedOutSource()

    const result = await prepareScoreEngine({ config, target: 'linux-x64', root, source })

    expect(result).toEqual({ kind: 'skipped', reason: 'unsupported-target' })
    expect(await readdir(root)).toEqual([])
  })

  it('Release 빌드는 엔진을 두지 못하면 실패한다', () => {
    expect(() =>
      assertScoreEngineIncluded({ kind: 'installed', path: 'resources/score/dnfscore.dll' })
    ).not.toThrow()
    expect(() => assertScoreEngineIncluded({ kind: 'skipped', reason: 'not-checked-out' })).toThrow(
      'Release builds require the score engine: the packages/models/score-engine submodule is not checked out.'
    )
    expect(() =>
      assertScoreEngineIncluded({ kind: 'skipped', reason: 'unsupported-target' })
    ).toThrow('Release builds require the score engine: no score engine library for this platform.')
  })

  it('배치하는 파일 이름은 main이 찾는 플랫폼별 라이브러리 이름과 같다', () => {
    expect(Object.keys(scoreEngineConfig.targets)).toContain('win32-x64')
    for (const [target, file] of Object.entries(scoreEngineConfig.targets)) {
      const [platform] = target.split('-')
      expect(file).toBe(SCORE_LIBRARY_FILE_NAMES[platform])
    }
  })
})
