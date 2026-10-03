import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasColorMatch, normalizeNickname, runSerialLoop, updateSlotStability } from './recognition'

afterEach(() => vi.useRealTimers())

describe('파티 인식과 OCR 반복 수명', () => {
  it('허용 오차 안의 색상만 인정한다', () => {
    expect(hasColorMatch([[101, 149, 201]], [100, 150, 200], 1)).toBe(true)
    expect(hasColorMatch([[103, 150, 200]], [100, 150, 200], 1)).toBe(false)
  })

  it('한글, 영문, 숫자 nickname 문자만 남긴다', () => {
    expect(normalizeNickname(' 테-스_트! ABC 123 ')).toBe('테스트ABC123')
  })

  it('연속된 두 번의 일치한 읽기 뒤에만 nickname을 내보낸다', () => {
    const first = updateSlotStability(null, '테스트123')
    const stable = updateSlotStability(first, '테스트123')
    const changed = updateSlotStability(stable, '다른닉네임')

    expect(first.stableNickname).toBeNull()
    expect(stable.stableNickname).toBe('테스트123')
    expect(changed.stableNickname).toBeNull()
  })

  it('존재 판정에 실패하면 slot을 초기화한다', () => {
    const stable = updateSlotStability(
      { candidate: '테스트123', consecutiveCount: 1, stableNickname: null },
      '테스트123'
    )

    expect(updateSlotStability(stable, null)).toEqual({
      candidate: null,
      consecutiveCount: 0,
      stableNickname: null
    })
  })

  it('cycle이 끝난 뒤 다음 cycle을 예약한다', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    let activeCycles = 0
    let maximumActiveCycles = 0
    let completedCycles = 0

    const loop = runSerialLoop({
      signal: controller.signal,
      getIntervalMs: () => 1000,
      runCycle: async () => {
        activeCycles += 1
        maximumActiveCycles = Math.max(maximumActiveCycles, activeCycles)
        await new Promise<void>((resolve) => setTimeout(resolve, 100))
        activeCycles -= 1
        completedCycles += 1
        const shouldStop = completedCycles === 2
        if (shouldStop) {
          controller.abort()
        }
      }
    })

    await vi.advanceTimersByTimeAsync(1200)
    await loop

    expect(completedCycles).toBe(2)
    expect(maximumActiveCycles).toBe(1)
  })
})

it('다음 OCR 주기를 기다리던 중 취소하면 타이머를 해제하고 다시 실행하지 않는다', async () => {
  vi.useFakeTimers()
  const controller = new AbortController()
  const cycle = vi.fn(async () => undefined)
  const loop = runSerialLoop({
    signal: controller.signal,
    getIntervalMs: () => 3000,
    runCycle: cycle
  })
  await vi.advanceTimersByTimeAsync(0)
  expect(cycle).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(1)

  controller.abort()
  await loop
  await vi.advanceTimersByTimeAsync(3000)

  expect(cycle).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})

it('처리 중 취소하면 현재 OCR 완료 뒤 다음 주기를 예약하지 않는다', async () => {
  vi.useFakeTimers()
  const controller = new AbortController()
  const pending = Promise.withResolvers<void>()
  const cycle = vi.fn(() => pending.promise)
  const interval = vi.fn(() => 3000)
  const loop = runSerialLoop({
    signal: controller.signal,
    getIntervalMs: interval,
    runCycle: cycle
  })
  controller.abort()
  pending.resolve()
  await loop

  expect(cycle).toHaveBeenCalledOnce()
  expect(interval).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

it('OCR 실패는 호출자에 전달하고 타이머나 후속 주기를 만들지 않는다', async () => {
  vi.useFakeTimers()
  const controller = new AbortController()
  const failure = new Error('synthetic recognition failure')
  const cycle = vi.fn(async () => {
    throw failure
  })
  const loop = runSerialLoop({
    signal: controller.signal,
    getIntervalMs: () => 3000,
    runCycle: cycle
  })

  await expect(loop).rejects.toBe(failure)
  await vi.advanceTimersByTimeAsync(3000)
  expect(cycle).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
  controller.abort()
})
