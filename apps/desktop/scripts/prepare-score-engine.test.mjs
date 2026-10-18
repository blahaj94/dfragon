import { createHash } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import scoreEngineConfig from '../score-engine.config.mjs'
import { SCORE_LIBRARY_FILE_NAMES } from '../src/backend/score/engine'
import { assertScoreEngineIncluded, prepareScoreEngine } from './prepare-score-engine.mjs'

const REPOSITORY = 'synthetic-owner/synthetic-engine'
const TOKEN = 'synthetic-token'
const ASSET_URL = `https://api.github.com/repos/${REPOSITORY}/releases/assets/1`
const STORAGE_URL = 'https://objects.example.test/signed/dnfscore.dll'
const engineBytes = Buffer.from('synthetic engine library')
const config = {
  published: true,
  tag: 'v1.0.0',
  destination: 'resources/score',
  targets: {
    'win32-x64': {
      asset: 'dnfscore-win32-x64.dll',
      file: 'dnfscore.dll',
      sha256: createHash('sha256').update(engineBytes).digest('hex')
    }
  }
}
const env = { DFRAGON_SCORE_ENGINE_TOKEN: TOKEN, DFRAGON_SCORE_ENGINE_REPOSITORY: REPOSITORY }

function releaseTransport(bytes = engineBytes) {
  return vi.fn(async (url) => {
    if (url.endsWith('/releases/tags/v1.0.0')) {
      return Response.json({ assets: [{ name: 'dnfscore-win32-x64.dll', url: ASSET_URL }] })
    }

    if (url === ASSET_URL) {
      return new Response(null, { status: 302, headers: { location: STORAGE_URL } })
    }

    if (url === STORAGE_URL) {
      return new Response(bytes)
    }

    return new Response(null, { status: 404 })
  })
}

const roots = []
async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'dfragon-score-engine-'))
  roots.push(root)

  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('점수 엔진 자산 준비', () => {
  it('저장소 설정은 아직 미발행이라 토큰이 있어도 받지 않고 엔진 없이 빌드한다', async () => {
    const transport = releaseTransport()
    const root = await temporaryRoot()

    expect(scoreEngineConfig.published).toBe(false)
    expect(await prepareScoreEngine({ env, target: 'win32-x64', root, fetch: transport })).toEqual({
      kind: 'skipped',
      reason: 'unpublished'
    })
    expect(transport).not.toHaveBeenCalled()
    expect(await readdir(root)).toEqual([])
  })

  it.each([
    ['토큰 없음', {}, 'no-token'],
    ['빈 토큰', { DFRAGON_SCORE_ENGINE_TOKEN: '' }, 'no-token']
  ])('%s이면 Release를 조회하지 않고 건너뛴다', async (_name, environment, reason) => {
    const transport = releaseTransport()
    const root = await temporaryRoot()

    expect(
      await prepareScoreEngine({
        config,
        env: environment,
        target: 'win32-x64',
        root,
        fetch: transport
      })
    ).toEqual({ kind: 'skipped', reason })
    expect(transport).not.toHaveBeenCalled()
  })

  it('자산이 없는 플랫폼은 건너뛴다', async () => {
    const transport = releaseTransport()

    expect(
      await prepareScoreEngine({
        config,
        env,
        target: 'linux-arm64',
        root: await temporaryRoot(),
        fetch: transport
      })
    ).toEqual({ kind: 'skipped', reason: 'unsupported-target' })
    expect(transport).not.toHaveBeenCalled()
  })

  it('Release 자산을 받아 SHA256이 맞으면 resources/score에 두고 서명 주소에는 토큰을 보내지 않는다', async () => {
    const transport = releaseTransport()
    const root = await temporaryRoot()

    const result = await prepareScoreEngine({
      config,
      env,
      target: 'win32-x64',
      root,
      fetch: transport
    })

    const path = join(root, 'resources', 'score', 'dnfscore.dll')
    expect(result).toEqual({ kind: 'installed', path })
    expect(await readFile(path)).toEqual(engineBytes)
    expect(await readFile(join(root, 'resources', 'score', '.gitignore'), 'utf8')).toBe('*\n')
    const requests = transport.mock.calls.map(([url, init]) => ({
      url,
      authorization: init?.headers?.Authorization ?? null
    }))
    expect(requests).toEqual([
      {
        url: `https://api.github.com/repos/${REPOSITORY}/releases/tags/v1.0.0`,
        authorization: `Bearer ${TOKEN}`
      },
      { url: ASSET_URL, authorization: `Bearer ${TOKEN}` },
      { url: STORAGE_URL, authorization: null }
    ])
  })

  it('SHA256이 다르면 실패하고 라이브러리를 남기지 않는다', async () => {
    const root = await temporaryRoot()

    await expect(
      prepareScoreEngine({
        config,
        env,
        target: 'win32-x64',
        root,
        fetch: releaseTransport(Buffer.from('tampered'))
      })
    ).rejects.toThrow('checksum mismatch')
    expect(await readdir(root)).toEqual([])
  })

  it.each([
    [
      '저장소 이름 없음',
      { ...env, DFRAGON_SCORE_ENGINE_REPOSITORY: undefined },
      config,
      'DFRAGON_SCORE_ENGINE_REPOSITORY'
    ],
    [
      '자리표시자가 아닌 잘못된 SHA256',
      env,
      { ...config, targets: { 'win32-x64': { ...config.targets['win32-x64'], sha256: 'abc' } } },
      'lowercase SHA256'
    ],
    [
      'Release에 자산 없음',
      env,
      {
        ...config,
        targets: { 'win32-x64': { ...config.targets['win32-x64'], asset: 'other.dll' } }
      },
      'has no other.dll asset'
    ]
  ])(
    '토큰이 있는데 %s이면 엔진 없는 빌드로 넘어가지 않고 실패한다',
    async (_name, environment, selected, message) => {
      await expect(
        prepareScoreEngine({
          config: selected,
          env: environment,
          target: 'win32-x64',
          root: await temporaryRoot(),
          fetch: releaseTransport()
        })
      ).rejects.toThrow(message)
    }
  )

  it('서명 주소 redirect가 HTTPS가 아니면 받지 않고 실패한다', async () => {
    const transport = vi.fn(async (url) => {
      if (url === ASSET_URL) {
        return new Response(null, {
          status: 302,
          headers: { location: 'http://objects.example.test/x' }
        })
      }

      return Response.json({ assets: [{ name: 'dnfscore-win32-x64.dll', url: ASSET_URL }] })
    })

    await expect(
      prepareScoreEngine({
        config,
        env,
        target: 'win32-x64',
        root: await temporaryRoot(),
        fetch: transport
      })
    ).rejects.toThrow('not an HTTPS address')
    expect(transport).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['미발행', { kind: 'skipped', reason: 'unpublished' }, false],
    ['배치 완료', { kind: 'installed', path: '/synthetic/dnfscore.dll' }, false],
    ['토큰 없음', { kind: 'skipped', reason: 'no-token' }, true],
    ['자산 없는 플랫폼', { kind: 'skipped', reason: 'unsupported-target' }, true]
  ])('--require 빌드는 %s 결과에서 엔진이 빠졌을 때만 실패한다', (_name, result, fails) => {
    const check = () => assertScoreEngineIncluded(result)

    if (fails) {
      expect(check).toThrow('Building without the score engine')
    } else {
      expect(check).not.toThrow()
    }
  })

  it('배치하는 파일 이름은 main이 찾는 플랫폼별 라이브러리 이름과 같다', () => {
    for (const [target, { file }] of Object.entries(scoreEngineConfig.targets)) {
      const [platform] = target.split('-')
      expect(file).toBe(SCORE_LIBRARY_FILE_NAMES[platform])
    }
  })
})
