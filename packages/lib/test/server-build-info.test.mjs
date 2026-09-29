import assert from 'node:assert/strict'
import test from 'node:test'
import { parseServerBuildInfo } from '../dist/index.js'

const commit = '1234567890abcdef1234567890abcdef12345678'

test('server build info accepts exact service revisions and explicit unknown revisions', () => {
  for (const service of ['api', 'accounts', 'ocr']) {
    assert.deepEqual(parseServerBuildInfo({ service, commit }, service), { service, commit })
    assert.deepEqual(parseServerBuildInfo({ service, commit: null }, service), {
      service,
      commit: null
    })
  }
})

test('server build info rejects another service, extra fields and malformed revisions', () => {
  const invalid = [
    undefined,
    null,
    [],
    'api',
    {},
    { service: 'api' },
    { commit },
    { service: 'accounts', commit },
    { service: 'api', commit, branch: 'main' },
    { service: 'api', commit: commit.toUpperCase() },
    { service: 'api', commit: commit.slice(0, 7) },
    { service: 'api', commit: `${commit}\n` },
    { service: 'api', commit: ` ${commit}` },
    { service: 'api', commit: '' },
    { service: 'api', commit: false },
    { service: 'api', commit: 123 },
    Object.create({ service: 'api', commit })
  ]
  for (const value of invalid) {
    assert.equal(parseServerBuildInfo(value, 'api'), null)
  }
})
