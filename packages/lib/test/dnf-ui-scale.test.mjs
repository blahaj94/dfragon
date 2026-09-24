import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estimateDNFUIScale } from '@dfragon/lib'

test('predicts the five supplied capture settings relative to UI 0%', () => {
  for (const [percent, expected] of [
    [0, 1],
    [25, 1.125],
    [50, 1.2857142857142858],
    [75, 1.5],
    [100, 1.8]
  ]) {
    assert.equal(estimateDNFUIScale(percent), expected)
  }
})

test('preserves fractional model input without snapping to an observed setting', () => {
  assert.equal(estimateDNFUIScale(37.5), 1.2)
})

test('rejects invalid inputs rather than clamping or returning a non-finite scale', () => {
  for (const percent of [-0.01, 100.01, 225, NaN, Infinity, -Infinity, '50', null, undefined]) {
    assert.throws(() => estimateDNFUIScale(percent), RangeError)
  }
})
