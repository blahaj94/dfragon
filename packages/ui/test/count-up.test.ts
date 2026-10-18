import { describe, expect, it } from 'vitest'
import { parseDuration, parseEasing } from '../src/count-up'

describe('NumericText가 읽는 숫자 증가 시간', () => {
  it.each([
    { value: '400ms', expected: 400 },
    { value: '0.4s', expected: 400 },
    { value: ' 400ms ', expected: 400 },
    // 동작 줄이기 설정에서 tokens.css가 0으로 둔 값과, 토큰을 읽지 못한 경우는 바로 최종값을 보인다.
    { value: '0ms', expected: 0 },
    { value: '', expected: 0 },
    { value: '-100ms', expected: 0 },
    { value: 'fast', expected: 0 }
  ])('$value: $expected ms', ({ value, expected }) => {
    expect(parseDuration(value)).toBe(expected)
  })
})

describe('NumericText가 읽는 감속 곡선', () => {
  it('토큰 곡선은 시작과 끝을 지나며 앞쪽에서 빨리 올라간다', () => {
    const ease = parseEasing('cubic-bezier(0.2, 0, 0, 1)')

    expect(ease(0)).toBeCloseTo(0, 3)
    expect(ease(1)).toBeCloseTo(1, 3)
    expect(ease(0.5)).toBeGreaterThan(0.8)
    const samples = [0.1, 0.3, 0.5, 0.7, 0.9].map(ease)
    expect(samples).toEqual([...samples].sort((first, second) => first - second))
  })

  it('곡선을 읽을 수 없으면 직선으로 둔다', () => {
    const ease = parseEasing('ease-out')

    expect(ease(0.25)).toBe(0.25)
  })
})
