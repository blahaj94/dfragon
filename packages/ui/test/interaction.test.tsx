import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ActionButton,
  DialogAction,
  DialogContent,
  DialogRoot,
  DialogTrigger,
  TextField,
  TextFieldInput,
  type ActionButtonProps,
  type DialogRootProps,
  type TextFieldProps
} from '../src/index'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function render(children: ReactNode) {
  await act(async () => root.render(children))
}

function element<T extends HTMLElement>(selector: string, scope: ParentNode = document): T {
  const result = scope.querySelector<T>(selector)
  if (result == null) {
    throw new Error(`테스트 준비: 렌더링된 요소가 없습니다. ${selector}`)
  }

  return result
}

function buttonByText(text: string, scope: ParentNode = document) {
  const button = Array.from(scope.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === text
  )
  if (button == null) {
    throw new Error(`테스트 준비: 버튼이 없습니다. ${text}`)
  }

  return button
}

function inputByLabel(text: string) {
  const label = Array.from(document.querySelectorAll('label')).find(
    (candidate) => candidate.textContent === text
  )
  if (!(label?.control instanceof HTMLInputElement)) {
    throw new Error(`테스트 준비: label에 연결된 입력이 없습니다. ${text}`)
  }

  return label.control
}

function referencedTexts(target: HTMLElement, attribute: 'aria-labelledby' | 'aria-describedby') {
  const ids = target.getAttribute(attribute)?.split(/\s+/) ?? []

  return ids.map((id) => document.getElementById(id)?.textContent)
}

async function click(button: HTMLElement) {
  await act(async () => button.click())
}

// jsdom에 텍스트 입력의 기본 동작이 없어 native setter와 input 이벤트를 함께 사용한다.
// disabled/readOnly 입력에 인위적인 input 이벤트를 보내 차단 여부를 판단하지 않는다.
async function editInput(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (valueSetter == null) {
    throw new Error('테스트 준비: native input value setter가 없습니다.')
  }
  await act(async () => {
    valueSetter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function pressEscape(target: HTMLElement) {
  await act(async () => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
  })
}

describe('ActionButton의 클릭과 disabled·loading 상태', () => {
  it.each([
    { title: '활성 버튼은 클릭을 전달한다', loading: false, disabled: false },
    { title: 'disabled 버튼은 클릭을 차단한다', loading: false, disabled: true },
    { title: 'loading만 지정한 버튼은 클릭을 전달한다', loading: true, disabled: false },
    { title: 'loading과 disabled를 함께 지정하면 클릭을 차단한다', loading: true, disabled: true }
  ])('$title', async ({ loading, disabled }) => {
    const onClick = vi.fn<NonNullable<ActionButtonProps['onClick']>>()
    await render(
      <ActionButton loading={loading} disabled={disabled} onClick={onClick}>
        실행
      </ActionButton>
    )
    const button = element<HTMLButtonElement>('button')

    expect(button.disabled).toBe(disabled)
    expect(button.textContent).toBe('실행')
    await click(button)

    if (disabled) {
      expect(onClick).not.toHaveBeenCalled()
    } else {
      expect(onClick).toHaveBeenCalledOnce()
    }
  })

  it('활성·busy·활성 상태가 바뀌면 현재 disabled 값에 따라 클릭을 처리한다', async () => {
    const onClick = vi.fn<NonNullable<ActionButtonProps['onClick']>>()
    await render(<ActionButton onClick={onClick}>실행</ActionButton>)
    await click(element('button'))
    expect(onClick).toHaveBeenCalledTimes(1)

    await render(
      <ActionButton loading disabled onClick={onClick}>
        실행
      </ActionButton>
    )
    expect(element<HTMLButtonElement>('button').disabled).toBe(true)
    await click(element('button'))
    expect(onClick).toHaveBeenCalledTimes(1)

    await render(<ActionButton onClick={onClick}>실행</ActionButton>)
    expect(element<HTMLButtonElement>('button').disabled).toBe(false)
    await click(element('button'))
    expect(onClick).toHaveBeenCalledTimes(2)
  })
})

describe('TextField의 controlled 입력과 접근성 연결', () => {
  it('표시된 label이 편집 가능한 입력에 연결된다', async () => {
    await render(
      <TextField label="표시 이름">
        <TextFieldInput />
      </TextField>
    )
    const input = element<HTMLInputElement>('input')
    const label = element<HTMLLabelElement>('label')

    expect(label.textContent).toBe('표시 이름')
    expect(label.control).toBe(input)
  })

  it('편집 값과 빈 문자열을 전달하고 소비자가 변환한 controlled 값을 표시한다', async () => {
    const onValueChange = vi.fn<NonNullable<TextFieldProps['onValueChange']>>()
    function ControlledField() {
      const [value, setValue] = useState('')

      return (
        <TextField
          label="표시 이름"
          value={value}
          onValueChange={(details) => {
            onValueChange(details)
            setValue(details.value.toUpperCase())
          }}
        >
          <TextFieldInput />
        </TextField>
      )
    }
    await render(<ControlledField />)
    const input = inputByLabel('표시 이름')

    await editInput(input, 'New name')

    // 공식 grapheme callback의 호출 횟수는 고정하지 않고 전달된 모든 값을 검증한다.
    expect(new Set(onValueChange.mock.calls.map(([details]) => details.value))).toEqual(
      new Set(['New name'])
    )
    expect(input.value).toBe('NEW NAME')

    onValueChange.mockClear()
    await editInput(input, '')

    expect(new Set(onValueChange.mock.calls.map(([details]) => details.value))).toEqual(
      new Set([''])
    )
    expect(input.value).toBe('')
  })

  it('소비자가 편집 값을 채택하지 않으면 기존 controlled 값을 유지한다', async () => {
    const onValueChange = vi.fn<NonNullable<TextFieldProps['onValueChange']>>()
    await render(
      <TextField label="표시 이름" value="고정 이름" onValueChange={onValueChange}>
        <TextFieldInput />
      </TextField>
    )
    const input = inputByLabel('표시 이름')

    await editInput(input, '바꾸려는 이름')

    expect(new Set(onValueChange.mock.calls.map(([details]) => details.value))).toEqual(
      new Set(['바꾸려는 이름'])
    )
    expect(input.value).toBe('고정 이름')
  })

  it('부모의 value 변경을 반영하며 사용자 편집 callback을 발생시키지 않는다', async () => {
    const onValueChange = vi.fn<NonNullable<TextFieldProps['onValueChange']>>()
    await render(
      <TextField label="표시 이름" value="처음 이름" onValueChange={onValueChange}>
        <TextFieldInput />
      </TextField>
    )
    expect(inputByLabel('표시 이름').value).toBe('처음 이름')

    await render(
      <TextField label="표시 이름" value="새 이름" onValueChange={onValueChange}>
        <TextFieldInput />
      </TextField>
    )

    expect(inputByLabel('표시 이름').value).toBe('새 이름')
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('invalid 전환에 따라 오류 연결을 추가·제거하며 설명 연결을 유지한다', async () => {
    function Field({ invalid }: { invalid: boolean }) {
      return (
        <TextField
          label="표시 이름"
          invalid={invalid}
          description="다른 사람이 볼 이름입니다."
          errorMessage="이름을 입력해주세요."
        >
          <TextFieldInput />
        </TextField>
      )
    }
    await render(<Field invalid={false} />)
    let input = inputByLabel('표시 이름')
    expect(input.getAttribute('aria-invalid')).not.toBe('true')
    expect(referencedTexts(input, 'aria-describedby')).toEqual(['다른 사람이 볼 이름입니다.'])

    await render(<Field invalid />)
    input = inputByLabel('표시 이름')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(new Set(referencedTexts(input, 'aria-describedby'))).toEqual(
      new Set(['다른 사람이 볼 이름입니다.', '이름을 입력해주세요.'])
    )

    await render(<Field invalid={false} />)
    input = inputByLabel('표시 이름')
    expect(input.getAttribute('aria-invalid')).not.toBe('true')
    expect(referencedTexts(input, 'aria-describedby')).toEqual(['다른 사람이 볼 이름입니다.'])
  })

  it('여러 입력의 label·설명·오류가 다른 필드와 섞이지 않는다', async () => {
    await render(
      <>
        <TextField
          label="표시 이름"
          value="모험가"
          invalid
          description="다른 사람이 볼 이름입니다."
          errorMessage="이름을 확인해주세요."
        >
          <TextFieldInput />
        </TextField>
        <TextField
          label="이메일"
          value="hello@example.invalid"
          invalid
          description="연락받을 이메일입니다."
          errorMessage="이메일을 확인해주세요."
        >
          <TextFieldInput />
        </TextField>
      </>
    )
    const name = inputByLabel('표시 이름')
    const email = inputByLabel('이메일')

    expect(name).not.toBe(email)
    expect(name.value).toBe('모험가')
    expect(email.value).toBe('hello@example.invalid')
    expect(new Set(referencedTexts(name, 'aria-describedby'))).toEqual(
      new Set(['다른 사람이 볼 이름입니다.', '이름을 확인해주세요.'])
    )
    expect(new Set(referencedTexts(email, 'aria-describedby'))).toEqual(
      new Set(['연락받을 이메일입니다.', '이메일을 확인해주세요.'])
    )
  })
})

type DialogExampleProps = Pick<
  DialogRootProps,
  'defaultOpen' | 'open' | 'onOpenChange' | 'closeOnEscape'
>

function DialogExample(props: DialogExampleProps) {
  return (
    <DialogRoot {...props}>
      <DialogTrigger asChild>
        <ActionButton>상세 정보 열기</ActionButton>
      </DialogTrigger>
      <DialogContent title="상세 정보" description="입력한 내용을 확인해주세요.">
        <DialogAction>확인하고 닫기</DialogAction>
      </DialogContent>
    </DialogRoot>
  )
}

describe('Dialog의 상태 전이와 접근성·포커스', () => {
  it('trigger를 누르면 열림 값을 전달하고 dialog를 표시한다', async () => {
    const onOpenChange = vi.fn<NonNullable<DialogRootProps['onOpenChange']>>()
    await render(<DialogExample onOpenChange={onOpenChange} />)
    const trigger = buttonByText('상세 정보 열기')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    await click(trigger)

    expect(new Set(onOpenChange.mock.calls.map(([open]) => open))).toEqual(new Set([true]))
    expect(new Set(onOpenChange.mock.calls.map(([, details]) => details?.reason))).toEqual(
      new Set(['trigger'])
    )
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(referencedTexts(element('[role="dialog"]'), 'aria-labelledby')).toEqual(['상세 정보'])
  })

  it('modal의 제목과 설명이 dialog의 접근성 이름·설명에 연결된다', async () => {
    await render(<DialogExample defaultOpen />)
    const dialog = element('[role="dialog"]')

    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(referencedTexts(dialog, 'aria-labelledby')).toEqual(['상세 정보'])
    expect(referencedTexts(dialog, 'aria-describedby')).toEqual(['입력한 내용을 확인해주세요.'])
  })

  it('trigger로 열면 focus가 dialog 안으로 이동하고 바깥으로의 focus 이동을 막는다', async () => {
    await render(<DialogExample />)
    const trigger = buttonByText('상세 정보 열기')
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    await click(trigger)
    const dialog = element('[role="dialog"]')
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    await act(async () => trigger.focus())

    expect(document.activeElement).not.toBe(trigger)
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it.each([
    { title: 'Escape 키 입력', method: 'escape', reason: 'escapeKeyDown' },
    { title: '닫기 버튼 클릭', method: 'close', reason: 'closeButton' },
    { title: 'DialogAction 클릭', method: 'action', reason: 'closeButton' }
  ])('$title 시 닫힘 값을 전달하고 trigger로 focus를 돌려준다', async ({ method, reason }) => {
    const onOpenChange = vi.fn<NonNullable<DialogRootProps['onOpenChange']>>()
    await render(<DialogExample onOpenChange={onOpenChange} />)
    const trigger = buttonByText('상세 정보 열기')
    trigger.focus()
    await click(trigger)
    const dialog = element('[role="dialog"]')
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    onOpenChange.mockClear()

    if (method === 'escape') {
      await pressEscape(dialog)
    } else if (method === 'close') {
      await click(element('button[aria-label="닫기"]', dialog))
    } else {
      await click(buttonByText('확인하고 닫기', dialog))
    }

    expect(new Set(onOpenChange.mock.calls.map(([open]) => open))).toEqual(new Set([false]))
    expect(new Set(onOpenChange.mock.calls.map(([, details]) => details?.reason))).toEqual(
      new Set([reason])
    )
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('closeOnEscape가 false이면 Escape로 닫거나 닫힘을 요청하지 않는다', async () => {
    const onOpenChange = vi.fn<NonNullable<DialogRootProps['onOpenChange']>>()
    await render(<DialogExample defaultOpen closeOnEscape={false} onOpenChange={onOpenChange} />)

    await pressEscape(element('[role="dialog"]'))

    expect(onOpenChange).not.toHaveBeenCalled()
    expect(referencedTexts(element('[role="dialog"]'), 'aria-labelledby')).toEqual(['상세 정보'])
    expect(buttonByText('상세 정보 열기').getAttribute('aria-expanded')).toBe('true')
  })

  it('controlled dialog는 닫힘 요청 뒤에도 부모의 open 값이 바뀔 때까지 열린 상태를 유지한다', async () => {
    const onOpenChange = vi.fn<NonNullable<DialogRootProps['onOpenChange']>>()
    await render(<DialogExample open onOpenChange={onOpenChange} />)

    await pressEscape(element('[role="dialog"]'))

    expect(new Set(onOpenChange.mock.calls.map(([open]) => open))).toEqual(new Set([false]))
    expect(new Set(onOpenChange.mock.calls.map(([, details]) => details?.reason))).toEqual(
      new Set(['escapeKeyDown'])
    )
    expect(buttonByText('상세 정보 열기').getAttribute('aria-expanded')).toBe('true')
    expect(referencedTexts(element('[role="dialog"]'), 'aria-labelledby')).toEqual(['상세 정보'])
    onOpenChange.mockClear()

    await render(<DialogExample open={false} onOpenChange={onOpenChange} />)

    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    expect(buttonByText('상세 정보 열기').getAttribute('aria-expanded')).toBe('false')
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
