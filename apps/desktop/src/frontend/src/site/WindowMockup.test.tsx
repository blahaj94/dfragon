// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { WindowMockup } from './WindowMockup'

let root: Root
let container: HTMLDivElement

beforeEach(async () => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<WindowMockup />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function advance(ms: number): Promise<void> {
  await act(async () => vi.advanceTimersByTime(ms))
}

async function click(element: Element): Promise<void> {
  await act(async () => (element as HTMLElement).click())
}

function button(name: string | RegExp): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((candidate) => {
    const label = candidate.getAttribute('aria-label') ?? candidate.textContent ?? ''
    if (typeof name === 'string') {
      return label === name
    }

    return name.test(label)
  })
  if (found === undefined) {
    throw new Error(`${name} 버튼이 없습니다`)
  }

  return found
}

function cardNames(): string[] {
  return [...container.querySelectorAll('article')].map(
    (card) => card.querySelector('input')?.value ?? ''
  )
}

it('처음 열면 빈 카드로 시작해 자동 캡처로 파티 카드 네 장을 채운다', async () => {
  expect(cardNames()).toEqual(['', '', '', ''])
  await advance(1000 + 350 * 4)
  expect(cardNames()).toEqual(['캐릭터1', '캐릭터2', '캐릭터3', '캐릭터4'])
  expect(container.textContent).toContain('인식 완료')
})

it('후보 칩을 눌러 연 후보 창에서 같은 후보를 두 번 고르면 1번 카드가 그 서버의 캐릭터로 바뀐다', async () => {
  await advance(2400)
  expect(container.querySelector('[role="group"][aria-label="1번 후보 고르기"]')).toBeNull()
  await click(button('후보 4'))
  expect(container.querySelector('[role="group"][aria-label="1번 후보 고르기"]')).not.toBeNull()

  await click(button(/^카인, 명성 98,420/))
  await click(button(/^카인, 명성 98,420/))

  const first = container.querySelector('article')!
  expect(first.textContent).toContain('모험단14')
  expect(first.textContent).toContain('98,420')
  expect(container.querySelector('[role="group"][aria-label="1번 후보 고르기"]')).toBeNull()
})

it('스냅샷을 켠 뒤 다시 캡처하면 3번 자리에만 스냅샷에 없는 모험단 표시가 붙는다', async () => {
  await advance(2400)
  await click(button('파티 모험단 순번 스냅샷'))
  expect(container.querySelector('[aria-label="스냅샷에 없는 모험단"]')).toBeNull()

  await click(button('파티 캡처, 단축키 Alt R'))
  await advance(350 * 4)

  const absent = [...container.querySelectorAll('article')].map(
    (card) => card.querySelector('[aria-label="스냅샷에 없는 모험단"]') !== null
  )
  expect(absent).toEqual([false, false, true, false])
})

it('첫 자동 캡처 전에 공대로 바꿔 캡처하면 자동 캡처가 공대 캡처를 끊지 않는다', async () => {
  await click(button(/검색/))
  await click(
    container.ownerDocument.querySelector('[role="menuitemradio"]:not([aria-checked="true"])')!
  )
  await click(button('공대 캡처, 단축키 Alt R'))
  await advance(150 * 12)

  expect(cardNames()).toHaveLength(12)
  expect(cardNames().every((name) => name.length > 0)).toBe(true)
})

function clipboardAnnouncement(): string | null | undefined {
  return container.querySelector('[data-clipboard-announcer]')?.textContent
}

it('복사를 누르면 채운 파티 카드를 클립보드에 쓰고 복사 완료 상태를 잠시 보인다', async () => {
  const writeText = vi.fn(async () => {})
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  await advance(2400)

  await click(button('클립보드로 복사'))

  expect(writeText).toHaveBeenCalledWith(
    '[캐릭터1, 시로코, 모험단1], [캐릭터2, 카인, 모험단2], [캐릭터3, 시로코, 모험단3], [캐릭터4, 시로코, 모험단4]'
  )
  expect(clipboardAnnouncement()).toBe('클립보드로 복사했습니다.')
  await advance(1500)
  expect(clipboardAnnouncement()).toBe('')
})

it('브라우저가 클립보드 쓰기를 거절하면 복사 실패를 보인다', async () => {
  vi.stubGlobal('navigator', {
    clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) }
  })

  await click(button('클립보드로 복사'))

  expect(clipboardAnnouncement()).toBe('클립보드에 복사하지 못했습니다.')
})

it('보안 컨텍스트가 아니라 navigator.clipboard가 없으면 복사 실패를 보인다', async () => {
  vi.stubGlobal('navigator', {})

  await click(button('클립보드로 복사'))

  expect(clipboardAnnouncement()).toBe('클립보드에 복사하지 못했습니다.')
})

it('공대에서 복사하면 파티마다 한 줄씩 쓴다', async () => {
  const writeText = vi.fn(async () => {})
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  await click(button(/검색/))
  await click(
    container.ownerDocument.querySelector('[role="menuitemradio"]:not([aria-checked="true"])')!
  )
  await click(button('공대 캡처, 단축키 Alt R'))
  await advance(150 * 12)

  await click(button('클립보드로 복사'))

  expect(writeText).toHaveBeenCalledWith(
    [
      '[캐릭터1, 시로코, 모험단1], [캐릭터2, 카인, 모험단2], [캐릭터3, 시로코, 모험단3], [캐릭터4, 시로코, 모험단4]',
      '[캐릭터5, 시로코, 모험단5], [캐릭터6, 시로코, 모험단6], [캐릭터7, 시로코, 모험단7], [캐릭터8, 시로코, 모험단8]',
      '[캐릭터9, 시로코, 모험단9], [캐릭터10, 시로코, 모험단10], [캐릭터11, 시로코, 모험단11], [캐릭터12, 시로코, 모험단12]'
    ].join(',\n')
  )
})
