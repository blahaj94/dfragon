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

test('accounts for the observed client heights without assuming proportional UI scaling', () => {
  assert.equal(estimateDNFUIScale(0, 851), 1)
  assert.equal(estimateDNFUIScale(50, 900), 1.2)
  assert.equal(estimateDNFUIScale(50, 1080), 1.2857142857142858)
  assert.equal(estimateDNFUIScale(100, 1080), 1.8)
  for (const percent of [0, 50, 100]) {
    assert.equal(estimateDNFUIScale(percent, 600), 1)
  }
})

test('rejects client heights outside the measured model range or non-integer pixels', () => {
  for (const height of [599, 1081, 900.5, NaN, Infinity, -Infinity, '900', null]) {
    assert.throws(() => estimateDNFUIScale(50, height), RangeError)
  }
})

test('rejects invalid inputs rather than clamping or returning a non-finite scale', () => {
  for (const percent of [-0.01, 100.01, 225, NaN, Infinity, -Infinity, '50', null, undefined]) {
    assert.throws(() => estimateDNFUIScale(percent), RangeError)
  }
})
