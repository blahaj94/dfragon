// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ColorThemeProvider } from '../../components/ColorThemeProvider'
import { PartyPage } from './PartyPage'
import type { CardCharacter } from '../../types/cards'

let root: Root
let container: HTMLDivElement
const character: CardCharacter = {
  characterId: 'matched-id',
  name: '선택된이름',
  serverId: 'cain',
  adventure: '모험단',
  job: '직업',
  level: 115,
  fame: 0,
  equipment: [],
  oath: [],
  image: 'https://img-api.neople.co.kr/df/servers/cain/characters/matched-id?zoom=1'
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }))
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function render(props: ComponentProps<typeof PartyPage>): Promise<void> {
  await act(async () =>
    root.render(
      <ColorThemeProvider>
        <PartyPage {...props} settings={<span />} account={<span />} capture={<span />} />
      </ColorThemeProvider>
    )
  )
}

it('비동기 식별 성공은 OCR 첫 이름 대신 선택된 이름과 서버를 표시한다', async () => {
  await render({
    slots: ['pending', 'idle', 'idle', 'idle'],
    nicknames: ['OCR첫후보'],
    basicOnly: true
  })
  expect(container.querySelector('input')?.value).toBe('OCR첫후보')
  const detail = vi.fn()
  await render({
    slots: ['success', 'idle', 'idle', 'idle'],
    characters: [character],
    nicknames: ['OCR첫후보'],
    basicOnly: true,
    onDetail: detail
  })

  const slot = container.querySelector('article')!
  expect(slot.querySelector('input')?.value).toBe('선택된이름')
  expect(slot.textContent).toContain('카인')
  expect(slot.textContent).toContain('♙ 0')
  expect(slot.textContent).not.toContain('수정 중')
  expect(slot.querySelector('img')?.getAttribute('src')).toBe(character.image)
  expect(slot.querySelector('[aria-label*="다음 면"]')).toBeNull()
  const button = slot.querySelector<HTMLButtonElement>('[aria-label="1번 캐릭터 상세 열기"]')!
  expect(button.disabled).toBe(false)
  await act(async () => button.click())
  expect(detail).toHaveBeenCalledOnce()
})

it('네 슬롯의 서로 다른 선택과 대기 상태를 독립적으로 표시한다', async () => {
  await render({
    slots: ['success', 'success', 'waiting-portrait', 'waiting-policy'],
    characters: [
      character,
      { ...character, characterId: 'another-id', name: '다른이름', fame: null },
      null,
      null
    ],
    nicknames: [null, null, '얼굴대기', '기준대기'],
    basicOnly: true
  })
  const slots = container.querySelectorAll('article')
  expect(slots[0].querySelector('input')?.value).toBe('선택된이름')
  expect(slots[1].querySelector('input')?.value).toBe('다른이름')
  expect(slots[1].textContent).toContain('♙ —')
  expect(slots[2].textContent).toContain('얼굴 인식 대기')
  expect(slots[3].textContent).toContain('자동 식별 준비 중')
  expect(slots[2].querySelector('img')).toBeNull()
  expect(slots[3].querySelector('img')).toBeNull()
})

it('재시도 버튼은 제한 대기와 진행 중에는 잠기고 해당 슬롯만 요청한다', async () => {
  const retry = vi.fn()
  const props: ComponentProps<typeof PartyPage> = {
    slots: ['failure', 'idle', 'idle', 'idle'],
    basicOnly: true,
    onRetry: retry,
    slotNotices: ['12초 후 다시 시도할 수 있습니다.'],
    retryEnabled: [false]
  }
  await render(props)
  const findRetry = (): HTMLButtonElement =>
    [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('다시 시도')
    )!
  expect(findRetry().disabled).toBe(true)
  await act(async () => findRetry().click())
  expect(retry).not.toHaveBeenCalled()
  await render({
    ...props,
    retryEnabled: [true],
    slotNotices: ['검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.']
  })
  await act(async () => findRetry().click())
  expect(retry).toHaveBeenCalledExactlyOnceWith(0)
})
