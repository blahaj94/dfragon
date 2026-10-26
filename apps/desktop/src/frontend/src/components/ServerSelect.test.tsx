// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { CharacterCard } from '../sections/CharacterCard'
import { RaidCard } from '../sections/RaidCard'
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

it('서버 변경은 해당 카드만 조회한다', async () => {
  const onLookup = vi.fn()
  await act(async () =>
    root.render(
      <>
        <CharacterCard
          card={{ state: 'success', character: previewCharacter }}
          slot={1}
          inputEnabled
          onLookup={onLookup}
        />
        <CharacterCard
          card={{ state: 'success', character: previewCharacter }}
          slot={2}
          inputEnabled
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
  expect(onLookup).toHaveBeenCalledExactlyOnceWith(previewCharacter.name, 'cain')
  expect(trigger.textContent).toContain('카인')
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  const cards = document.querySelectorAll('article')
  expect(cards[0].textContent).toContain('Enter로 조회')
  expect(cards[1].textContent).not.toContain('Enter로 조회')
  expect(cards[1].querySelector('[aria-label="2번 서버"]')!.textContent).toContain('시로코')
  expect(cards[0].querySelector('[aria-label="1번 캐릭터 이름"]')).not.toBeNull()
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
  const listbox = document.querySelector('[role="listbox"]')!
  expect(listbox.getAttribute('aria-label')).toBe('서버')
  expect([...listbox.querySelectorAll('[role="option"]')].map((item) => item.textContent)).toEqual([
    '카인',
    '시로코'
  ])
  expect(listbox.textContent).toBe('카인시로코')
  await act(async () =>
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
  )
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  expect(trigger.textContent).toContain('카인')
  expect(onValueChange).not.toHaveBeenCalled()
})

it('서버를 고르지 않으면 트리거에 서버를 표시하고 선택된 항목을 두지 않는다', async () => {
  await act(async () =>
    root.render(
      <ServerSelect
        label="1번 서버"
        value=""
        options={[
          { id: 'cain', label: '카인' },
          { id: 'siroco', label: '시로코' }
        ]}
        onValueChange={vi.fn()}
      />
    )
  )
  const trigger = document.querySelector<HTMLButtonElement>('[role="combobox"]')!
  expect(trigger.textContent).toBe('서버')
  await act(async () => trigger.click())
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  const options = [...document.querySelectorAll('[role="listbox"] [role="option"]')]
  expect(options.map((item) => item.textContent)).toEqual(['카인', '시로코'])
  expect(options.filter((item) => item.getAttribute('aria-selected') === 'true')).toEqual([])
})

it('카드 위 칩과 목록을 카드 면으로 그리고 키보드로 열어 고른다', async () => {
  const onValueChange = vi.fn()
  await act(async () =>
    root.render(
      <ServerSelect
        label="1번 서버"
        value="siroco"
        options={[
          { id: 'cain', label: '카인' },
          { id: 'diregie', label: '디레지에' },
          { id: 'siroco', label: '시로코' }
        ]}
        onValueChange={onValueChange}
      />
    )
  )
  const trigger = document.querySelector<HTMLButtonElement>('[aria-label="1번 서버"]')!
  expect(trigger.dataset.surface).toBe('card')
  trigger.focus()
  await act(async () =>
    trigger.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    )
  )
  const listbox = await vi.waitFor(() => document.querySelector('[role="listbox"]')!)
  const options = [...listbox.querySelectorAll<HTMLElement>('[role="option"]')]
  expect(options.map((option) => option.dataset.surface)).toEqual(['card', 'card', 'card'])
  const current = options.find((option) => option.textContent === '시로코')!
  await vi.waitFor(() => expect(document.activeElement).toBe(current))
  await act(async () =>
    current.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })
    )
  )
  const previous = options.find((option) => option.textContent === '디레지에')!
  await vi.waitFor(() => expect(document.activeElement).toBe(previous))
  await act(async () =>
    previous.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    )
  )
  expect(onValueChange).toHaveBeenCalledExactlyOnceWith('diregie')
  await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
})

it('제품의 입력 미연결 상태에서는 서버 선택도 비활성으로 유지한다', async () => {
  await act(async () =>
    root.render(<CharacterCard card={{ state: 'success', character: previewCharacter }} slot={1} />)
  )
  const trigger = document.querySelector<HTMLButtonElement>('[aria-label="1번 서버"]')!
  expect(trigger.disabled).toBe(true)
  await act(async () => trigger.click())
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
})

it('파티 카드의 서버 목록은 카인, 디레지에, 시로코, 프레이, 카시야스, 힐더, 안톤, 바칼 순서다', async () => {
  await act(async () =>
    root.render(
      <CharacterCard
        card={{ state: 'success', character: previewCharacter }}
        slot={1}
        inputEnabled
      />
    )
  )
  const trigger = document.querySelector<HTMLButtonElement>('[aria-label="1번 서버"]')!
  await act(async () => trigger.click())

  const labels = [...document.querySelectorAll('[role="listbox"] [role="option"]')].map(
    (option) => option.textContent
  )
  expect(labels).toEqual([
    '카인',
    '디레지에',
    '시로코',
    '프레이',
    '카시야스',
    '힐더',
    '안톤',
    '바칼'
  ])
})

it('이름 칸 안 칩은 서버 8개를 4열 목록으로 열고, 카드 머리 칩은 한 줄 목록으로 연다', async () => {
  const options = [
    { id: 'anton', label: '안톤' },
    { id: 'bakal', label: '바칼' },
    { id: 'cain', label: '카인' },
    { id: 'casillas', label: '카시야스' },
    { id: 'diregie', label: '디레지에' },
    { id: 'hilder', label: '힐더' },
    { id: 'prey', label: '프레이' },
    { id: 'siroco', label: '시로코' }
  ]
  await act(async () =>
    root.render(
      <>
        <ServerSelect
          variant="field"
          label="칸 안 서버"
          value="siroco"
          options={options}
          onValueChange={vi.fn()}
        />
        <ServerSelect label="머리 서버" value="siroco" options={options} onValueChange={vi.fn()} />
      </>
    )
  )
  const field = document.querySelector<HTMLButtonElement>('[aria-label="칸 안 서버"]')!
  await act(async () => field.click())
  const fieldList = document.querySelector('[role="listbox"][aria-label="칸 안 서버"]')!
  expect(fieldList.getAttribute('style')).toContain('repeat(4, auto)')
  expect(fieldList.querySelectorAll('[role="option"]')).toHaveLength(8)
  await act(async () =>
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
  )

  const chip = document.querySelector<HTMLButtonElement>('[aria-label="머리 서버"]')!
  await act(async () => chip.click())
  const chipList = document.querySelector('[role="listbox"][aria-label="머리 서버"]')!
  expect(chipList.getAttribute('style') ?? '').not.toContain('repeat(')
})

function keydown(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)

  return event
}

async function renderCard(onLookup: (nickname: string, serverId: string) => void): Promise<void> {
  await act(async () =>
    root.render(
      <CharacterCard
        card={{ state: 'success', character: previewCharacter }}
        slot={1}
        inputEnabled
        onLookup={onLookup}
      />
    )
  )
}

it('이름 칸에서 Tab을 누르면 서버 목록을 열고, 방향키로 고른 서버를 Enter로 바로 조회한다', async () => {
  const onLookup = vi.fn()
  await renderCard(onLookup)
  const name = document.querySelector<HTMLInputElement>('[aria-label="1번 캐릭터 이름"]')!
  const trigger = document.querySelector<HTMLButtonElement>('[aria-label="1번 서버"]')!
  name.focus()

  let tab: KeyboardEvent | undefined
  await act(async () => {
    tab = keydown(name, 'Tab')
  })

  expect(tab?.defaultPrevented).toBe(true)
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  const listbox = document.querySelector('[role="listbox"]')!
  const current = [...listbox.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (option) => option.textContent === '시로코'
  )!
  await vi.waitFor(() => expect(document.activeElement).toBe(current))
  await act(async () => {
    keydown(current, 'ArrowUp')
  })
  const previous = [...listbox.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (option) => option.textContent === '프레이'
  )!
  await vi.waitFor(() => expect(document.activeElement).toBe(previous))
  await act(async () => {
    keydown(previous, 'Enter')
  })

  expect(onLookup).toHaveBeenCalledExactlyOnceWith(previewCharacter.name, 'prey')
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
})

it('지금 서버를 그대로 Enter로 골라도 바로 조회하고, Escape로 닫으면 조회하지 않는다', async () => {
  const onLookup = vi.fn()
  await renderCard(onLookup)
  const name = document.querySelector<HTMLInputElement>('[aria-label="1번 캐릭터 이름"]')!
  const trigger = document.querySelector<HTMLButtonElement>('[aria-label="1번 서버"]')!
  name.focus()

  await act(async () => {
    keydown(name, 'Tab')
  })
  const current = document.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')!
  await vi.waitFor(() => expect(document.activeElement).toBe(current))
  await act(async () => {
    keydown(current, 'Escape')
  })
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  expect(onLookup).not.toHaveBeenCalled()

  name.focus()
  await act(async () => {
    keydown(name, 'Tab')
  })
  const again = document.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')!
  await vi.waitFor(() => expect(document.activeElement).toBe(again))
  await act(async () => {
    keydown(again, 'Enter')
  })

  expect(onLookup).toHaveBeenCalledExactlyOnceWith(previewCharacter.name, previewCharacter.serverId)
})

it('Shift+Tab과 한글 조합 중의 Tab은 서버 목록을 열지 않는다', async () => {
  await renderCard(vi.fn())
  const name = document.querySelector<HTMLInputElement>('[aria-label="1번 캐릭터 이름"]')!
  const trigger = document.querySelector<HTMLButtonElement>('[aria-label="1번 서버"]')!
  name.focus()

  let shiftTab: KeyboardEvent | undefined
  let composingTab: KeyboardEvent | undefined
  await act(async () => {
    shiftTab = keydown(name, 'Tab', { shiftKey: true })
    composingTab = keydown(name, 'Tab', { isComposing: true })
  })

  expect(shiftTab?.defaultPrevented).toBe(false)
  expect(composingTab?.defaultPrevented).toBe(false)
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
})

it('공대 카드의 이름 칸도 Tab으로 서버 목록을 열고 Enter로 고른 서버를 바로 조회한다', async () => {
  const onLookup = vi.fn()
  await act(async () =>
    root.render(
      <RaidCard
        card={{ state: 'success', character: previewCharacter }}
        slot={9}
        onLookup={onLookup}
        move={{ movable: false }}
      />
    )
  )
  const name = document.querySelector<HTMLInputElement>('[aria-label="9번 캐릭터 이름"]')!
  const trigger = document.querySelector<HTMLButtonElement>('[aria-label="9번 서버"]')!
  name.focus()

  await act(async () => {
    keydown(name, 'Tab')
  })

  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  const current = document.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')!
  await vi.waitFor(() => expect(document.activeElement).toBe(current))
  await act(async () => {
    keydown(current, 'Enter')
  })

  expect(onLookup).toHaveBeenCalledExactlyOnceWith(previewCharacter.name, previewCharacter.serverId)
})
