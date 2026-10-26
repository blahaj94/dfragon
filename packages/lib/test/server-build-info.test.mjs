import assert from 'node:assert/strict'
import test from 'node:test'
import { parseServerBuildInfo } from '@dfragon/lib'

const commit = '1234567890abcdef1234567890abcdef12345678'

test('API의 전체 커밋과 명시적인 미확정 커밋 null을 받는다', () => {
  assert.deepEqual(parseServerBuildInfo({ service: 'api', commit }, 'api'), {
    service: 'api',
    commit
  })
  assert.deepEqual(parseServerBuildInfo({ service: 'api', commit: null }, 'api'), {
    service: 'api',
    commit: null
  })
})

test('지운 서비스의 버전 응답은 커밋 확정 여부와 관계없이 거절한다', () => {
  for (const service of ['accounts', 'ocr']) {
    for (const revision of [commit, null]) {
      assert.equal(parseServerBuildInfo({ service, commit: revision }, 'api'), null, service)
    }
  }
})

test('누락된 필드와 추가 필드 및 잘못된 커밋은 유효한 버전 응답으로 받지 않는다', () => {
  const invalid = [
    ['응답 없음', undefined],
    ['객체 대신 null', null],
    ['객체 대신 배열', []],
    ['객체 대신 문자열', 'api'],
    ['빈 객체', {}],
    ['커밋 필드 누락', { service: 'api' }],
    ['서비스 필드 누락', { commit }],
    ['등록되지 않은 서비스', { service: 'desktop', commit }],
    ['추가 필드', { service: 'api', commit, branch: 'main' }],
    ['대문자 커밋', { service: 'api', commit: commit.toUpperCase() }],
    ['짧은 커밋', { service: 'api', commit: commit.slice(0, 7) }],
    ['16진수가 아닌 커밋', { service: 'api', commit: 'g'.repeat(40) }],
    ['긴 커밋', { service: 'api', commit: `${commit}0` }],
    ['끝의 줄바꿈', { service: 'api', commit: `${commit}\n` }],
    ['앞의 공백', { service: 'api', commit: ` ${commit}` }],
    ['빈 커밋', { service: 'api', commit: '' }],
    ['커밋의 undefined는 미확정 null과 다름', { service: 'api', commit: undefined }],
    ['boolean 커밋', { service: 'api', commit: false }],
    ['숫자 커밋', { service: 'api', commit: 123 }],
    ['상속된 필드', Object.create({ service: 'api', commit })]
  ]
  for (const [title, value] of invalid) {
    assert.equal(parseServerBuildInfo(value, 'api'), null, title)
  }
})
