import { expect, it } from 'vitest'
import { MAX_IMAGE_DIMENSION } from './image-limits'
import { isCanonicalIsoTimestamp, isSafeInteger, isValidImageDimensions } from './validation'

it('narrows only numbers that are safe integers', () => {
  expect(isSafeInteger(0)).toBe(true)
  expect(isSafeInteger(Number.MAX_SAFE_INTEGER)).toBe(true)

  for (const value of [
    null,
    undefined,
    '1',
    NaN,
    Infinity,
    -Infinity,
    1.5,
    Number.MAX_SAFE_INTEGER + 1
  ]) {
    expect(isSafeInteger(value)).toBe(false)
  }
})

it('validates positive image dimensions within dimension and pixel limits', () => {
  expect(isValidImageDimensions(1920, 1080)).toBe(true)
  expect(isValidImageDimensions(MAX_IMAGE_DIMENSION, 4028)).toBe(true)

  for (const [width, height] of [
    [0, 1],
    [-1, 1],
    [1.5, 1],
    [NaN, 1],
    [Infinity, 1],
    [MAX_IMAGE_DIMENSION + 1, 1],
    [MAX_IMAGE_DIMENSION, 4029],
    ['1', 1],
    [1, null]
  ]) {
    expect(isValidImageDimensions(width, height)).toBe(false)
  }
})

it('accepts only canonical ISO timestamps', () => {
  expect(isCanonicalIsoTimestamp('2026-09-25T12:30:00.000Z')).toBe(true)

  for (const value of [
    '2026-09-25T12:30:00Z',
    '2026-09-25T12:30:00.000+00:00',
    '2026-02-30T12:30:00.000Z',
    'not-a-timestamp',
    1727267400000,
    null
  ]) {
    expect(isCanonicalIsoTimestamp(value)).toBe(false)
  }
})
