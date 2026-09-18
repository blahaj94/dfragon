// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { CharacterCard } from '../sections/CharacterCard'
import { previewCharacter } from '../fixture/mvp/fixture'
import { ServerSelect } from './ServerSelect'

let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }))
  )
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

it('서버 변경은 해당 카드의 수정 상태만 바꾸고 카드 전환·상세 열기를 실행하지 않는다', async () => {
  const onDetail = vi.fn()
  await act(async () =>
    root.render(
      <>
        <CharacterCard
          slot={1}
          state="success"
          character={previewCharacter}
          inputEnabled
          onDetail={onDetail}
        />
        <CharacterCard
          slot={2}
          state="success"
          character={previewCharacter}
          inputEnabled
          onDetail={onDetail}
        />
      </>
    )
  )
  const trigger = document.querySelector<HTMLButtonElement>('[aria-label="1번 서버"]')!
  await act(async () => trigger.click())
  const selected = document.querySelector('[role="option"][aria-selected="true"]')!
  expect(selected.textContent).toContain('시로코')
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (item) => item.textContent === '카인'
  )!
  await act(async () => option.click())
  expect(trigger.textContent).toContain('카인')
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  const cards = document.querySelectorAll('article')
  expect(cards[0].textContent).toContain('이름·서버 수정 중')
  expect(cards[1].textContent).not.toContain('이름·서버 수정 중')
  expect(cards[1].querySelector('[aria-label="2번 서버"]')!.textContent).toContain('시로코')
  expect(cards[0].querySelector('[aria-label="1번 캐릭터 이름"]')).not.toBeNull()
  expect(onDetail).not.toHaveBeenCalled()
})

it('전달된 서버만 제공하고 Escape로 선택 변경 없이 닫는다', async () => {
  const onValueChange = vi.fn()
  await act(async () =>
    root.render(
      <ServerSelect
        label="서버"
        value="cain"
        options={[
          { id: 'cain', label: '카인' },
          { id: 'siroco', label: '시로코' }
        ]}
        onValueChange={onValueChange}
      />
    )
  )
  const trigger = document.querySelector<HTMLButtonElement>('[role="combobox"]')!
  await act(async () => trigger.click())
  expect([...document.querySelectorAll('[role="option"]')].map((item) => item.textContent)).toEqual(
    ['카인', '시로코']
  )
  await act(async () =>
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
  )
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  expect(trigger.textContent).toContain('카인')
  expect(onValueChange).not.toHaveBeenCalled()
})

it('제품의 입력 미연결 상태에서는 서버 선택도 비활성으로 유지한다', async () => {
  await act(async () =>
    root.render(<CharacterCard slot={1} state="success" character={previewCharacter} />)
  )
  const trigger = document.querySelector<HTMLButtonElement>('[aria-label="1번 서버"]')!
  expect(trigger.disabled).toBe(true)
  await act(async () => trigger.click())
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
})
