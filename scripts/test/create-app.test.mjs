import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { createAppFixture } from './fixtures/create-app/repository.mjs'

test('실행 위치와 무관하게 스크립트의 저장소에 정확한 workspace를 생성한다', (t) => {
  const { root, cwd, run } = createAppFixture(t)
  const result = run(['--name', '@dfragon/party-api'])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /생성 완료: apps\/party-api/)
  const app = join(root, 'apps/party-api')
  assert.deepEqual(JSON.parse(readFileSync(join(app, 'package.json'), 'utf8')), {
    name: '@dfragon/party-api',
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts: { dev: '', build: '', test: '', typecheck: 'tsc --noEmit', lint: 'eslint .' }
  })
  assert.deepEqual(readdirSync(app).sort(), ['package.json', 'src'])
  assert.deepEqual(readdirSync(join(app, 'src')), [])
  assert.deepEqual(readdirSync(cwd), [])
})

test('축약 옵션으로 만든 앱을 다시 요청하면 기존 파일을 보존하고 실패한다', (t) => {
  const { root, run } = createAppFixture(t)
  assert.equal(run(['-n', '@dfragon/party-api']).status, 0)
  const source = join(root, 'apps/party-api/src/keep.txt')
  writeFileSync(source, '수작업 코드')
  const before = readFileSync(join(root, 'apps/party-api/package.json'), 'utf8')
  const result = run(['-n', '@dfragon/party-api'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /이미 존재하는 앱/)
  assert.equal(readFileSync(source, 'utf8'), '수작업 코드')
  assert.equal(readFileSync(join(root, 'apps/party-api/package.json'), 'utf8'), before)
})

for (const [name, args] of [
  ['옵션 누락', []],
  ['옵션 값 누락', ['--name']],
  ['알 수 없는 옵션', ['--unknown', '@dfragon/api']],
  ['위치 인자', ['@dfragon/api']],
  ['다른 scope', ['--name', '@other/api']],
  ['상위 경로 이동', ['--name', '@dfragon/../outside']],
  ['중첩 경로', ['--name', '@dfragon/api/child']],
  ['대문자', ['--name', '@dfragon/API']],
  ['연속 하이픈', ['--name', '@dfragon/api--one']]
]) {
  test(`${name} 입력은 디렉터리를 만들기 전에 실패한다`, (t) => {
    const { root, cwd, run } = createAppFixture(t)
    const result = run(args)
    assert.equal(result.status, 1, result.stderr)
    assert.equal(result.signal, null)
    assert.notEqual(result.stderr, '')
    assert.equal(existsSync(join(root, 'apps')), false)
    assert.deepEqual(readdirSync(cwd), [])
  })
}

test('기존 파일과 끊어진 심볼릭 링크를 앱 경로로 덮어쓰지 않는다', (t) => {
  const { root, run } = createAppFixture(t)
  mkdirSync(join(root, 'apps'))
  writeFileSync(join(root, 'apps/file'), '보존할 파일')
  symlinkSync(join(root, 'missing-target'), join(root, 'apps/link'), 'dir')
  for (const name of ['file', 'link']) {
    const result = run(['--name', `@dfragon/${name}`])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /이미 존재하는 앱/)
  }
  assert.equal(readFileSync(join(root, 'apps/file'), 'utf8'), '보존할 파일')
  assert.equal(readlinkSync(join(root, 'apps/link')), join(root, 'missing-target'))
  assert.equal(existsSync(join(root, 'missing-target')), false)
  assert.deepEqual(readdirSync(join(root, 'apps')).sort(), ['file', 'link'])
})
