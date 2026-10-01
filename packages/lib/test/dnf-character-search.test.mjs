import assert from 'node:assert/strict'
import test from 'node:test'
import { matchesDNFSearchNicknamePolicy, DNF_SEARCH_NICKNAME_LIMITS } from '../dist/index.js'

test('search nickname policy counts 2–12 Unicode code points, not bytes or UTF-16 units', () => {
  assert.deepEqual(DNF_SEARCH_NICKNAME_LIMITS, { minimumCodePoints: 2, maximumCodePoints: 12 })
  for (const character of ['가', '漢', '𠀀', '😀', '♥']) {
    for (const [length, allowed] of [
      [1, false],
      [2, true],
      [12, true],
      [13, false]
    ]) {
      assert.equal(matchesDNFSearchNicknamePolicy(character.repeat(length)), allowed)
    }
  }
})

test('search policy preserves normalization and internal whitespace while rejecting outer padding', () => {
  assert.equal(matchesDNFSearchNicknamePolicy('가'.repeat(12).normalize('NFD')), false)
  assert.equal(matchesDNFSearchNicknamePolicy('가'), true)
  assert.equal(matchesDNFSearchNicknamePolicy('👩‍💻'.repeat(4)), true)
  assert.equal(matchesDNFSearchNicknamePolicy('👩‍💻'.repeat(5)), false)
  assert.equal(matchesDNFSearchNicknamePolicy('가 나'), true)
  for (const nickname of [' 가나', '가나 ', '\u00a0가나', '가나\u3000']) {
    assert.equal(matchesDNFSearchNicknamePolicy(nickname), false)
  }
})
