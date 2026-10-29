// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { NameFieldTone } from '../lib/name-field-tone'
import { NameField, type NameFieldProps } from './NameField'
import { ServerSelect } from './ServerSelect'

// jsdom은 테두리 색을 계산하지 않으므로 같은 선언에서 나온 class를 칸이 가졌는지로 확인한다.
const borders = stylex.create({
  signal: { borderColor: colors.cardSignal },
  failure: { borderColor: colors.cardFailure },
  quiet: { borderColor: colors.cardBorder },
  dashed: { borderStyle: 'dashed' }
})

type Border = keyof typeof borders

const borderNames: Border[] = ['signal', 'failure', 'quiet', 'dashed']

const classOf = (border: Border): string => stylex.props(borders[border]).className!

let root: Root
let container: HTMLElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

async function render(props: Partial<NameFieldProps> = {}): Promise<void> {
  await act(async () =>
    root.render(
      <NameField aria-label="2번 캐릭터 이름" value="이름" onChange={vi.fn()} {...props} />
    )
  )
}

const input = (): HTMLInputElement =>
  container.querySelector<HTMLInputElement>('[aria-label="2번 캐릭터 이름"]')!

it('일반 input props를 안쪽 input에 그대로 넘기고 placeholder를 두지 않는다', async () => {
  const onChange = vi.fn()
  const onFocus = vi.fn()
  const onBlur = vi.fn()
  const onKeyDown = vi.fn()
  await render({ value: '새이름', onChange, onFocus, onBlur, onKeyDown })
  expect(input().value).toBe('새이름')
  expect(input().hasAttribute('placeholder')).toBe(false)
  await act(async () => {
    input().focus()
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), '바뀜')
    input().dispatchEvent(new Event('input', { bubbles: true }))
    input().blur()
  })
  expect(onFocus).toHaveBeenCalledOnce()
  expect(onKeyDown).toHaveBeenCalledOnce()
  expect(onChange).toHaveBeenCalledOnce()
  expect(onBlur).toHaveBeenCalledOnce()
})

it('end를 입력 뒤 같은 칸 안에 그린다', async () => {
  await render({
    end: (
      <ServerSelect
        label="2번 서버"
        value="siroco"
        options={[{ id: 'siroco', label: '시로코' }]}
        open={false}
        onOpenChange={vi.fn()}
        onValueChange={vi.fn()}
      />
    )
  })
  const field = input().parentElement!
  const server = container.querySelector('[aria-label="2번 서버"]')!
  expect(field.contains(server)).toBe(true)
  expect(input().compareDocumentPosition(server) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(server.textContent).toContain('시로코')
})

it('end를 넘기지 않으면 입력만 둔다', async () => {
  await render()
  expect(input().parentElement!.children).toHaveLength(1)
})

it('테두리는 tone을 따른다', async () => {
  const cases: { tone?: NameFieldTone; has: Border[] }[] = [
    { has: [] },
    { tone: 'default', has: [] },
    { tone: 'selected', has: ['signal'] },
    { tone: 'failure', has: ['failure'] },
    { tone: 'vacant', has: ['quiet', 'dashed'] }
  ]
  for (const { tone, has } of cases) {
    await render({ tone })
    const classes = input().parentElement!.className.split(' ')
    for (const border of borderNames) {
      expect(classes.includes(classOf(border)), `${tone} ${border}`).toBe(has.includes(border))
    }
  }
})
