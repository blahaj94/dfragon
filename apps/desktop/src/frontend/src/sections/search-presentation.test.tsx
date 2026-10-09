// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import {
  type SearchCommandResult,
  type SearchErrorCode,
  type SearchSlot
} from '../../../preload/common/types/search'
import {
  CAPTURE_ID,
  REQUEST_ID,
  searchRow,
  searchSlot,
  searchSnapshot,
  withSearchSlot
} from '../../../preload/api/search-test-fixture'
import { createRendererFixture, media } from '../testing/fixtures/search-renderer-test-fixture'
import { SearchResults } from './SearchResults'

type Fixture = ReturnType<typeof createRendererFixture>
async function recognized(): Promise<Fixture> {
  const fixture = createRendererFixture()
  await fixture.mount()
  await fixture.start()
  const crop = document.createElement('canvas')
  media.crops.mockReturnValue([crop, crop, crop, crop])
  await fixture.cycle(2)

  return fixture
}
function region(fixture: Fixture, slot = 0): HTMLElement {
  const view = fixture.container.querySelector(`[aria-label="슬롯 ${slot + 1} 검색"]`)
  expect(view, `슬롯 ${slot + 1} 검색의 접근 가능한 영역`).not.toBeNull()

  return view as HTMLElement
}
async function emitSlot(fixture: Fixture, slot: SearchSlot): Promise<void> {
  await fixture.emit({ ...withSearchSlot(slot), revision: fixture.current().revision + 1 })
}

it('네 slot은 pending, 후보, 0건, 실패를 독립 표시하고 모든 후보 field와 서버 순서를 보존한다', async () => {
  const fixture = await recognized()
  const second = {
    ...searchRow,
    characterId: 'second-character',
    characterName: '두번째',
    serverId: 'unknown',
    serverName: null,
    fame: null
  }
  const slots: SearchSlot[] = [
    searchSlot({ slot: 0 }),
    searchSlot({ slot: 1, state: 'success', rows: [searchRow, second] }),
    searchSlot({ slot: 2, state: 'empty' }),
    searchSlot({
      slot: 3,
      state: 'failure',
      error: { code: 'SEARCH_RESPONSE_INVALID', retryAfterSeconds: null }
    })
  ]
  await fixture.emit({ ...fixture.current(), captureId: CAPTURE_ID, revision: 10, slots })
  expect(region(fixture, 0).textContent).toContain('검색 중')
  expect(region(fixture, 0).getAttribute('aria-busy')).toBe('true')
  expect(region(fixture, 0).querySelector('[role="status"]')).not.toBeNull()
  const candidates = region(fixture, 1)
  for (const field of [
    searchRow.characterId,
    searchRow.characterName,
    searchRow.serverId,
    searchRow.serverName
  ]) {
    expect(candidates.textContent).toContain(field)
  }
  expect(candidates.textContent).toContain('0')
  expect(candidates.textContent!.indexOf(searchRow.characterId)).toBeLessThan(
    candidates.textContent!.indexOf(second.characterId)
  )
  expect(candidates.querySelector('b')).toBeNull()
  expect(candidates.querySelector('[role="status"]')?.textContent).toBe('검색 결과 2명')
  expect([...candidates.querySelectorAll('details')].map((details) => details.open)).toEqual([
    false,
    false
  ])
  expect(candidates.querySelector('summary')?.getAttribute('aria-label')).toContain(
    searchRow.serverName
  )
  expect(candidates.textContent).not.toContain('undefined')
  expect(region(fixture, 2).textContent).toContain('검색 결과가 없습니다.')
  expect(region(fixture, 3).textContent).toContain(
    '검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.'
  )
  expect(region(fixture, 3).textContent).not.toContain('검색 결과가 없습니다.')
  expect(fixture.button('다시 시도', region(fixture, 3)).disabled).toBe(false)
})

it('검색 상태와 결과 수는 같은 status 영역에서 갱신하고 후보 목록은 밖에 표시한다', async () => {
  const fixture = await recognized()
  await emitSlot(fixture, searchSlot())
  const status = region(fixture).querySelector('[role="status"]')
  expect(status?.textContent).toBe('검색 중')

  for (const slot of [
    searchSlot({ state: 'success', rows: [searchRow] }),
    searchSlot(),
    searchSlot({ state: 'empty' })
  ]) {
    await emitSlot(fixture, slot)
    expect(region(fixture).querySelectorAll('[role="status"]')).toHaveLength(1)
    expect(region(fixture).querySelector('[role="status"]')).toBe(status)
    const statusExpectation = expect(status?.textContent)
    let expectedStatus = '검색 결과가 없습니다.'
    if (slot.state === 'success') {
      expectedStatus = '검색 결과 1명'
    } else if (slot.state === 'pending') {
      expectedStatus = '검색 중'
    }
    statusExpectation.toBe(expectedStatus)
    const candidates = region(fixture).querySelector('[aria-label="캐릭터 검색 후보"]')
    if (slot.state === 'success') {
      expect(candidates).not.toBeNull()
      expect(status?.contains(candidates)).toBe(false)
    } else {
      expect(candidates).toBeNull()
    }
  }
})

it('후보 명성은 숫자 구분을 돕되 0, 소수, 정보 없음을 구별한다', async () => {
  const fixture = await recognized()
  await emitSlot(
    fixture,
    searchSlot({
      state: 'success',
      rows: [125850, 0, -0.25, 0.00001, null].map((fame, index) => {
        const row = { ...searchRow }
        const characterId = `synthetic-${index}`

        return { ...row, characterId, fame }
      })
    })
  )
  const values = [...region(fixture).querySelectorAll('dt')]
    .filter((term) => term.textContent === '명성')
    .map((term) => term.nextElementSibling?.textContent)
  expect(values).toEqual(['125,850', '0', '-0.25', '0.00001', '정보 없음'])
})

// 오류 코드와 재시도 정책은 Rule을 따르고, 기존 화면의 고정 안내를 명시적 기대값으로 보존한다.
const failures = [
  { code: 'INVALID_SEARCH_QUERY', message: '검색 조건을 확인해 주세요.', retryable: false },
  {
    code: 'SEARCH_RATE_LIMITED',
    message: '검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true
  },
  {
    code: 'INTERNAL_SERVER_ERROR',
    message: '서버 오류로 검색을 처리하지 못했습니다.',
    retryable: true
  },
  { code: 'NEOPLE_API_ERROR', message: '캐릭터 검색 중 오류가 발생했습니다.', retryable: true },
  {
    code: 'NEOPLE_UNAVAILABLE',
    message: '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true
  },
  {
    code: 'NEOPLE_TIMEOUT',
    message: '캐릭터 검색 응답 시간이 초과됐습니다. 다시 시도해 주세요.',
    retryable: true
  },
  {
    code: 'SEARCH_TIMEOUT',
    message: '검색 시간이 초과됐습니다. 다시 시도해 주세요.',
    retryable: true
  },
  {
    code: 'SEARCH_NETWORK_ERROR',
    message: '검색 서버에 연결하지 못했습니다. 다시 시도해 주세요.',
    retryable: true
  },
  {
    code: 'SEARCH_RESPONSE_INVALID',
    message: '검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.',
    retryable: true
  }
] satisfies Array<{ code: SearchErrorCode; message: string; retryable: boolean }>
it.each(failures)(
  '$code는 고정 한국어 안내와 허용된 수동 재시도만 제공한다',
  async ({ code, message, retryable }) => {
    const fixture = await recognized()
    await emitSlot(
      fixture,
      searchSlot({ state: 'failure', error: { code, retryAfterSeconds: null } })
    )
    const view = region(fixture)
    expect(view.textContent).toContain(message)
    expect(view.textContent).not.toContain('검색 결과가 없습니다.')
    if (retryable) {
      const retry = fixture.button('다시 시도', view)
      expect(retry.disabled).toBe(false)
      await act(async () => retry.click())
      expect(fixture.search.controlCharacterSearch).toHaveBeenLastCalledWith({
        action: 'retry',
        captureId: CAPTURE_ID,
        slot: 0,
        requestId: REQUEST_ID
      })
    } else {
      expect(
        [...view.querySelectorAll('button')].some((button) => button.textContent === '다시 시도')
      ).toBe(false)
      expect(fixture.button('닉네임 수정', view).disabled).toBe(false)
    }
  }
)

it('429 유효 대기 동안 retry를 막고 같은 failure의 0초 event에서는 버튼만 활성화한다', async () => {
  const fixture = await recognized()
  const failure = searchSlot({
    state: 'failure',
    error: { code: 'SEARCH_RATE_LIMITED', retryAfterSeconds: 2 }
  })
  await emitSlot(fixture, failure)
  const before = fixture.search.controlCharacterSearch.mock.calls.length
  const retry = fixture.button('다시 시도', region(fixture))
  expect(retry.disabled).toBe(true)
  await act(async () => retry.click())
  expect(fixture.search.controlCharacterSearch.mock.calls.length).toBe(before)
  await emitSlot(fixture, {
    ...failure,
    error: { code: 'SEARCH_RATE_LIMITED', retryAfterSeconds: 0 }
  })
  expect(fixture.search.controlCharacterSearch.mock.calls.length).toBe(before)
  expect(fixture.button('다시 시도', region(fixture)).disabled).toBe(false)
  expect(region(fixture).textContent).toContain(
    '검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  )
  await act(async () => fixture.button('다시 시도', region(fixture)).click())
  expect(fixture.search.controlCharacterSearch).toHaveBeenLastCalledWith({
    action: 'retry',
    captureId: CAPTURE_ID,
    slot: 0,
    requestId: REQUEST_ID
  })
})

it('429 대기가 끝나도 진행 중인 재시도 응답을 기다리고 완료 후에만 다시 제출한다', async () => {
  const slot = searchSlot({
    state: 'failure',
    error: { code: 'SEARCH_RATE_LIMITED', retryAfterSeconds: 0 }
  })
  const retry = vi.fn<(slot: number) => void>()
  const container = document.createElement('div')
  const root = createRoot(container)
  document.body.append(container)
  const slots = [slot, ...searchSnapshot().slots.slice(1)]
  try {
    await act(async () =>
      root.render(
        <SearchResults
          view={{
            ready: true,
            slots,
            retryPending: [true, false, false, false],
            connectionFailed: false
          }}
          retry={retry}
        />
      )
    )
    const region = container.querySelector('[aria-label="슬롯 1 검색"]')!
    const button = region.querySelector('button')!
    expect(region.getAttribute('aria-busy')).toBe('true')
    expect(button.disabled).toBe(true)
    expect(region.textContent).toContain('검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.')
    expect(region.textContent).not.toContain('초 제한 대기')
    await act(async () => button.click())
    expect(retry).not.toHaveBeenCalled()

    await act(async () =>
      root.render(
        <SearchResults
          view={{
            ready: true,
            slots,
            retryPending: [false, false, false, false],
            connectionFailed: false
          }}
          retry={retry}
        />
      )
    )
    expect(region.getAttribute('aria-busy')).toBe('false')
    expect(button.disabled).toBe(false)
    await act(async () => button.click())
    expect(retry).toHaveBeenCalledExactlyOnceWith(0)
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})

it('retry 응답을 기다리는 동안 버튼을 비활성화하고 같은 요청을 중복 전송하지 않는다', async () => {
  const fixture = await recognized()
  await emitSlot(
    fixture,
    searchSlot({ state: 'failure', error: { code: 'SEARCH_TIMEOUT', retryAfterSeconds: null } })
  )
  const pending = Promise.withResolvers<SearchCommandResult>()
  fixture.search.controlCharacterSearch.mockReturnValueOnce(pending.promise)
  const before = fixture.search.controlCharacterSearch.mock.calls.length
  await act(async () => fixture.button('다시 시도', region(fixture)).click())
  expect(fixture.button('다시 시도', region(fixture)).disabled).toBe(true)
  await act(async () => fixture.button('다시 시도', region(fixture)).click())
  expect(fixture.search.controlCharacterSearch.mock.calls.length).toBe(before + 1)
  const next = searchSlot({ requestId: '00000000-0000-4000-8000-000000000099' })
  pending.resolve({ ok: true, snapshot: { ...withSearchSlot(next), revision: 30 } })
  await act(async () => undefined)
  expect(region(fixture).textContent).toContain('검색 중')
  expect(region(fixture).textContent).not.toContain('검색 시간이 초과됐습니다. 다시 시도해 주세요.')
})

it('retry 응답 유실은 read로 재동기화하고 retry를 자동 재전송하지 않는다', async () => {
  const fixture = await recognized()
  await emitSlot(
    fixture,
    searchSlot({ state: 'failure', error: { code: 'SEARCH_TIMEOUT', retryAfterSeconds: null } })
  )
  const next = withSearchSlot(searchSlot({ requestId: '00000000-0000-4000-8000-000000000099' }))
  fixture.search.controlCharacterSearch
    .mockRejectedValueOnce(new Error('Synthetic retry response loss'))
    .mockResolvedValueOnce({ ok: true, snapshot: { ...next, revision: 30 } })
  const before = fixture.search.controlCharacterSearch.mock.calls.length
  await act(async () => fixture.button('다시 시도', region(fixture)).click())
  expect(fixture.search.controlCharacterSearch.mock.calls.slice(before)).toEqual([
    [{ action: 'retry', captureId: CAPTURE_ID, slot: 0, requestId: REQUEST_ID }],
    [{ action: 'read' }]
  ])
  expect(region(fixture).textContent).toContain('검색 중')
})

it.each(['캡처 중지', '창 변경', '화면 종료'] as const)(
  '%s는 main 응답 없이 현재 후보를 즉시 지운다',
  async (transition) => {
    const fixture = await recognized()
    await emitSlot(fixture, searchSlot({ state: 'success', rows: [searchRow] }))
    expect(fixture.container.textContent).toContain(searchRow.characterId)
    fixture.search.controlCharacterSearch.mockReturnValue(new Promise(() => undefined))
    const isStop = transition === '캡처 중지'
    const isSource = transition === '창 변경'
    if (isStop) {
      await fixture.click('캡처 중지')
    } else if (isSource) {
      await fixture.select('next')
    } else {
      await fixture.unmount()
    }
    expect(fixture.container.textContent).not.toContain(searchRow.characterId)
  }
)

it('한 slot의 retry 응답 대기는 다른 slot의 사용자 retry를 막지 않는다', async () => {
  const fixture = await recognized()
  const secondId = '00000000-0000-4000-8000-000000000099'
  const error = { code: 'SEARCH_TIMEOUT' as const, retryAfterSeconds: null }
  const slots = fixture.current().slots.map((slot) => {
    const isFailure = slot.slot < 2
    const isFirst = slot.slot === 0

    if (isFailure) {
      const slotIndex = slot.slot
      const requestId = isFirst ? REQUEST_ID : secondId

      return searchSlot({ slot: slotIndex, state: 'failure', requestId, error })
    }

    return slot
  })
  await fixture.emit({ ...fixture.current(), captureId: CAPTURE_ID, revision: 10, slots })
  fixture.search.controlCharacterSearch.mockReturnValue(new Promise(() => undefined))
  const before = fixture.search.controlCharacterSearch.mock.calls.length
  await act(async () => fixture.button('다시 시도', region(fixture, 0)).click())
  expect(fixture.button('다시 시도', region(fixture, 0)).disabled).toBe(true)
  expect(fixture.button('다시 시도', region(fixture, 1)).disabled).toBe(false)
  await act(async () => fixture.button('다시 시도', region(fixture, 1)).click())
  expect(fixture.search.controlCharacterSearch.mock.calls.slice(before)).toEqual([
    [{ action: 'retry', captureId: CAPTURE_ID, slot: 0, requestId: REQUEST_ID }],
    [{ action: 'retry', captureId: CAPTURE_ID, slot: 1, requestId: secondId }]
  ])
})
