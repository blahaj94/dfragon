import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estimateDNFUIScale } from '@dfragon/lib'

test('제공된 다섯 UI 단계의 기준 배율 후보를 반환한다', () => {
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

test('소수 UI 입력을 관측된 단계로 반올림하지 않는다', () => {
  assert.equal(estimateDNFUIScale(37.5), 1.2)
})

test('관측한 client 높이에 따라 배율 후보를 계산한다', () => {
  assert.equal(estimateDNFUIScale(0, 851), 1)
  assert.equal(estimateDNFUIScale(50, 900), 1.2)
  assert.equal(estimateDNFUIScale(50, 1080), 1.2857142857142858)
  assert.equal(estimateDNFUIScale(100, 1080), 1.8)
  for (const percent of [0, 50, 100]) {
    assert.equal(estimateDNFUIScale(percent, 600), 1)
  }
})

test('모델 범위 밖이거나 정수 픽셀이 아닌 client 높이를 거절한다', () => {
  for (const height of [599, 1081, 900.5, NaN, Infinity, -Infinity, '900', null]) {
    assert.throws(() => estimateDNFUIScale(50, height), RangeError)
  }
})

test('잘못된 UI 입력은 보정 없이 RangeError로 거절한다', () => {
  for (const percent of [-0.01, 100.01, 225, NaN, Infinity, -Infinity, '50', null, undefined]) {
    assert.throws(() => estimateDNFUIScale(percent), RangeError)
  }
})

test('제한된 높이와 UI 입력 조합에서 배율 범위와 증가 방향을 유지한다', () => {
  // 공개 모델의 범위·증가 관계를 확인하며 제품 산식을 기대값으로 복제하지 않는다.
  const heights = [600, 601, 851, 900, 1079, 1080]
  const percents = [0, 0.5, 25, 37.5, 50, 75, 99.5, 100]
  for (const height of heights) {
    let previous = 1
    for (const percent of percents) {
      const scale = estimateDNFUIScale(percent, height)
      assert.ok(Number.isFinite(scale) && scale >= 1 && scale <= 1.8, `${height}px / ${percent}%`)
      assert.ok(scale >= previous, `${height}px에서 UI ${percent}%까지 증가`)
      if (height === 600 || percent === 0) {
        assert.equal(scale, 1)
      }
      previous = scale
    }
  }
  for (const percent of percents) {
    const scales = heights.map((height) => estimateDNFUIScale(percent, height))
    for (let index = 1; index < scales.length; index += 1) {
      assert.ok(scales[index] >= scales[index - 1], `UI ${percent}%에서 client 높이 증가`)
    }
  }
  assert.equal(estimateDNFUIScale(100, 900), 1.5)
})
