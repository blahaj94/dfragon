import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { createServerBuildInfo } from '../server-build-info.mjs'
import { createServerBuildInfoFixture as fixture } from './fixtures/task-tools/server-build-info.mjs'

const commit = 'a'.repeat(40)

test('이미지 빌더는 환경변수 대신 선택한 정확한 서비스와 source commit을 기록한다', (t) => {
  const { output, run } = fixture(t)
  for (const service of ['api', 'accounts', 'ocr']) {
    const result = run([service, commit, output], {
      env: { ...process.env, GITHUB_SHA: 'b'.repeat(40), SOURCE_COMMIT: 'c'.repeat(40) }
    })
    assert.equal(result.status, 0, result.stderr.toString())
    assert.equal(result.stdout.toString(), '')
    assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), { service, commit })
  }
})

test('로컬 이미지의 빈 source commit은 명시적인 null로 기록한다', () => {
  assert.deepEqual(createServerBuildInfo('api', ''), { service: 'api', commit: null })
})

test('잘못된 source revision·서비스는 기존 메타데이터를 덮어쓰기 전에 실패한다', (t) => {
  const { output, run } = fixture(t)
  const original = JSON.stringify({ service: 'api', commit })
  writeFileSync(output, original)
  for (const [service, invalidCommit] of [
    ['api', 'main'],
    ['api', 'a'.repeat(7)],
    ['api', 'A'.repeat(40)],
    ['api', commit + '\n'],
    ['api', 'g'.repeat(40)],
    ['desktop', commit]
  ]) {
    const result = run([service, invalidCommit, output])
    assert.equal(result.status, 1)
    assert.equal(result.stdout.toString(), '')
    assert.equal(readFileSync(output, 'utf8'), original)
  }
})

test('문자열이 아닌 source commit은 coercion 없이 입력 오류로 거절한다', () => {
  for (const value of [undefined, null, 0, [], {}, Symbol('commit')]) {
    assert.throws(() => createServerBuildInfo('api', value), {
      message: 'Source commit must be a full lowercase Git SHA.'
    })
  }
})

test('CLI는 상대 경로·공백 경로에 로컬 빌드의 null commit JSON을 기록한다', (t) => {
  const { folder, run } = fixture(t)
  const result = run(['api', '', 'build info.json'], {
    cwd: folder,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_SHA: commit, SOURCE_COMMIT: commit }
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '')
  assert.equal(
    readFileSync(join(folder, 'build info.json'), 'utf8'),
    '{"service":"api","commit":null}\n'
  )
})

test('CLI의 누락·추가 인자는 사용법 오류로 실패하고 기존 출력 파일을 보존한다', (t) => {
  const { output, run } = fixture(t)
  writeFileSync(output, 'existing metadata\n')

  for (const args of [[], ['api'], ['api', commit], ['api', commit, output, 'unexpected']]) {
    const result = run(args, { encoding: 'utf8' })

    assert.equal(result.status, 1, JSON.stringify(args))
    assert.equal(result.stdout, '')
    assert.match(result.stderr, /Usage: server-build-info\.mjs/)
    assert.equal(readFileSync(output, 'utf8'), 'existing metadata\n')
  }
})

test('출력 쓰기 실패는 성공으로 처리하지 않고 기존 디렉터리와 다른 파일을 보존한다', (t) => {
  const { folder, run } = fixture(t)
  const directoryOutput = join(folder, 'build-info.json')
  const absentParent = join(folder, 'absent')
  mkdirSync(directoryOutput)
  writeFileSync(join(directoryOutput, 'keep.txt'), 'keep directory content\n')

  for (const [output, errorCode] of [
    [directoryOutput, 'EISDIR'],
    [join(absentParent, 'build-info.json'), 'ENOENT']
  ]) {
    const result = run(['api', commit, output], {
      encoding: 'utf8'
    })

    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.match(result.stderr, new RegExp(errorCode))
    assert.equal(
      readFileSync(join(directoryOutput, 'keep.txt'), 'utf8'),
      'keep directory content\n'
    )
    assert.equal(existsSync(absentParent), false)
  }
})
