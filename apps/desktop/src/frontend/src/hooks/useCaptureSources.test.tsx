// @vitest-environment jsdom
import { act, StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCaptureSources } from './useCaptureSources'

type SourceState = ReturnType<typeof useCaptureSources>
const game = { id: 'game', name: '던전앤파이터' }
const other = { id: 'other', name: '테스트 창' }
let root: ReturnType<typeof createRoot>
let current: SourceState
const listCaptureSources = vi.fn<typeof window.api.listCaptureSources>()

function Harness(): null {
  const sources = useCaptureSources()
  useEffect(() => {
    current = sources
  }, [sources])

  return null
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(window, 'api', { configurable: true, value: { listCaptureSources } })
  listCaptureSources.mockResolvedValue([])
  root = createRoot(document.createElement('div'))
})

afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function mount(strict = false): Promise<void> {
  await act(async () =>
    root.render(
      strict ? (
        <StrictMode>
          <Harness />
        </StrictMode>
      ) : (
        <Harness />
      )
    )
  )
}

async function advance(milliseconds: number): Promise<void> {
  await act(async () => vi.advanceTimersByTimeAsync(milliseconds))
}

it('처음부터 실행 중인 던파를 즉시 목록에 표시하고 반복 조회를 예약하지 않는다', async () => {
  listCaptureSources.mockResolvedValue([other, game])
  await mount()

  expect(listCaptureSources).toHaveBeenCalledOnce()
  expect(current.sources).toEqual([other, game])
  expect(current.sourcesLoading).toBe(false)
  await advance(60_000)
  expect(listCaptureSources).toHaveBeenCalledOnce()
})

it('다른 창만 있으면 15초마다 찾고 던파 발견 뒤에는 반복 조회를 멈춘다', async () => {
  listCaptureSources
    .mockResolvedValueOnce([other])
    .mockResolvedValueOnce([other])
    .mockResolvedValueOnce([other, game])
  await mount()
  await advance(14_999)
  expect(listCaptureSources).toHaveBeenCalledOnce()
  await advance(1)
  expect(listCaptureSources).toHaveBeenCalledTimes(2)
  await advance(15_000)
  expect(listCaptureSources).toHaveBeenCalledTimes(3)
  expect(current.sources).toEqual([other, game])
  await advance(60_000)
  expect(listCaptureSources).toHaveBeenCalledTimes(3)
})

it('조회 실패도 재시도하고 성공하면 목록 오류 상태를 해제한다', async () => {
  listCaptureSources
    .mockRejectedValueOnce(new Error('synthetic internal error'))
    .mockRejectedValueOnce(new Error('synthetic retry error'))
    .mockResolvedValueOnce([game])
  await mount()
  expect(current.sourcesFailed).toBe(true)

  await advance(15_000)
  expect(current.sourcesFailed).toBe(true)
  await advance(15_000)
  expect(current.sources).toEqual([game])
  expect(current.sourcesFailed).toBe(false)
  expect(current.sourcesLoading).toBe(false)
})

it('느린 자동 조회가 끝나기 전에는 다음 자동 요청을 시작하지 않는다', async () => {
  const pending = Promise.withResolvers<Awaited<ReturnType<typeof listCaptureSources>>>()
  listCaptureSources.mockResolvedValueOnce([]).mockReturnValueOnce(pending.promise)
  await mount()
  await advance(15_000)
  expect(current.sourcesLoading).toBe(true)
  await advance(60_000)
  expect(listCaptureSources).toHaveBeenCalledTimes(2)
  await act(async () => pending.resolve([]))
  await advance(14_999)
  expect(listCaptureSources).toHaveBeenCalledTimes(2)
  await advance(1)
  expect(listCaptureSources).toHaveBeenCalledTimes(3)
})

it('수동 새로고침은 이전 타이머와 늦은 응답을 폐기한다', async () => {
  const pending = Promise.withResolvers<Awaited<ReturnType<typeof listCaptureSources>>>()
  listCaptureSources.mockResolvedValueOnce([]).mockReturnValueOnce(pending.promise)
  await mount()
  await advance(10_000)
  await act(async () => current.refreshSources())
  await advance(5_000)
  expect(listCaptureSources).toHaveBeenCalledTimes(2)

  listCaptureSources.mockResolvedValueOnce([game])
  await act(async () => current.refreshSources())
  await act(async () => pending.resolve([]))
  await advance(60_000)
  expect(current.sources).toEqual([game])
  expect(listCaptureSources).toHaveBeenCalledTimes(3)
})

it.each(['timer', 'request'] as const)(
  '%s 대기 중 화면을 닫으면 추가 조회를 예약하지 않는다',
  async (stage) => {
    const pending = Promise.withResolvers<Awaited<ReturnType<typeof listCaptureSources>>>()
    if (stage === 'request') {
      listCaptureSources.mockReturnValueOnce(pending.promise)
    }
    await mount()
    await act(async () => root.unmount())
    await act(async () => pending.resolve([]))
    await advance(60_000)
    expect(listCaptureSources).toHaveBeenCalledOnce()
  }
)

it('StrictMode에서 폐기한 초기 응답이 중복 타이머를 만들지 않는다', async () => {
  const first = Promise.withResolvers<Awaited<ReturnType<typeof listCaptureSources>>>()
  listCaptureSources.mockReturnValueOnce(first.promise).mockResolvedValueOnce([])
  await mount(true)
  await act(async () => first.resolve([]))
  await advance(15_000)
  expect(listCaptureSources).toHaveBeenCalledTimes(3)
})
