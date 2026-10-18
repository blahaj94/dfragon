import { act, createRef, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ActionButton,
  Button,
  CardFrame,
  Checkbox,
  Chip,
  DialogAction,
  DialogContent,
  DialogRoot,
  DialogTrigger,
  IconButton,
  Menu,
  NumericText,
  Select,
  StatusBadge,
  StatusChip,
  Switch,
  Tabs,
  TextField,
  TextFieldInput,
  Typo,
  type ActionButtonProps,
  type ControlSurface,
  type DialogRootProps,
  type IconButtonProps,
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

// 접근 가능한 이름: aria-labelledby, aria-label, 연결된 label, 글자 순으로 찾는다.
function accessibleName(element: Element) {
  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy != null) {
    return labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim()
  }
  const label = element.getAttribute('aria-label')
  if (label != null) {
    return label
  }
  const isLabelable = element instanceof HTMLInputElement
  if (isLabelable && element.labels != null && element.labels.length > 0) {
    return Array.from(element.labels, (candidate) => candidate.textContent ?? '').join(' ')
  }

  const text = element.textContent ?? ''

  return text.trim()
}

const IMPLICIT_ROLES: Record<string, string> = {
  button: 'button, [role="button"]',
  textbox: 'input:not([type]), input[type="text"], [role="textbox"]',
  dialog: '[role="dialog"]',
  combobox: '[role="combobox"]',
  listbox: '[role="listbox"]',
  option: '[role="option"]',
  menu: '[role="menu"]',
  menuitem: '[role="menuitem"]',
  menuitemradio: '[role="menuitemradio"]',
  tab: '[role="tab"]',
  tablist: '[role="tablist"]',
  tabpanel: '[role="tabpanel"]',
  switch: '[role="switch"]',
  checkbox: '[role="checkbox"]',
  status: '[role="status"]'
}

function queryByRole(role: string, name?: string, scope: ParentNode = document) {
  const candidates = Array.from(scope.querySelectorAll<HTMLElement>(IMPLICIT_ROLES[role]))

  const match = candidates.find((candidate) => {
    const isNamed = name === undefined || accessibleName(candidate) === name

    return isNamed
  })
  if (match === undefined) {
    return null
  }

  return match
}

function getByRole(role: string, name?: string, scope: ParentNode = document) {
  const result = queryByRole(role, name, scope)
  if (result == null) {
    throw new Error(`테스트 준비: ${role} ${name ?? ''} 요소가 없습니다.`)
  }

  return result
}

function allByRole(role: string, scope: ParentNode = document) {
  return Array.from(scope.querySelectorAll<HTMLElement>(IMPLICIT_ROLES[role]))
}

function describedTexts(target: HTMLElement) {
  const ids = target.getAttribute('aria-describedby')?.split(/\s+/) ?? []

  return ids.map((id) => document.getElementById(id)?.textContent)
}

async function click(target: HTMLElement) {
  await act(async () => target.click())
}

async function press(target: HTMLElement, key: string) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

// jsdom에 텍스트 입력의 기본 동작이 없어 native setter와 input 이벤트를 함께 사용한다.
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

// Base UI는 열기를 유발한 입력과 바깥 누름을 구분하려고 일부 listener를 다음 timer에 등록한다.
async function settle() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
}

describe('Button과 ActionButton의 클릭과 disabled, loading 상태', () => {
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
    const button = getByRole('button', '실행')

    expect(button).toBeInstanceOf(HTMLButtonElement)
    expect((button as HTMLButtonElement).disabled).toBe(disabled)
    await click(button)

    if (disabled) {
      expect(onClick).not.toHaveBeenCalled()
    } else {
      expect(onClick).toHaveBeenCalledOnce()
    }
  })

  // jsdom은 계산된 스타일을 모르므로 글자를 투명하게만 가리는 스타일 계약은 확인하지 못한다.
  it('loading 중에도 글자가 보조 기술에서 가려지지 않고 접근 가능한 이름으로 남는다', async () => {
    await render(
      <Button variant="primary" loading>
        검색
      </Button>
    )
    const button = getByRole('button', '검색')
    // 글자를 직접 담은 가장 안쪽 요소를 본다.
    const label = Array.from(button.querySelectorAll('span'))
      .filter((candidate) => candidate.textContent === '검색')
      .at(-1)

    expect(label?.closest('[aria-hidden="true"]')).toBeNull()
    expect(
      button.querySelector('[role="progressbar"]')?.closest('[aria-hidden="true"]')
    ).not.toBeNull()
  })

  it('화면이 넘긴 type과 ref를 native button에 전달한다', async () => {
    const ref = createRef<HTMLButtonElement>()
    await render(
      <Button ref={ref} type="submit">
        저장
      </Button>
    )

    expect(ref.current).toBe(getByRole('button', '저장'))
    expect(ref.current?.type).toBe('submit')
  })
})

describe('TextField의 controlled 입력과 접근성 연결', () => {
  it('표시된 label이 편집 가능한 입력의 이름이 된다', async () => {
    await render(
      <TextField label="표시 이름">
        <TextFieldInput />
      </TextField>
    )

    expect(getByRole('textbox', '표시 이름')).toBeInstanceOf(HTMLInputElement)
  })

  it('TextField의 ref는 입력을 감싼 상자를 가리킨다', async () => {
    const ref = createRef<HTMLDivElement>()
    await render(
      <TextField ref={ref} label="표시 이름">
        <TextFieldInput />
      </TextField>
    )

    expect(ref.current).toBe(getByRole('textbox', '표시 이름').parentElement)
  })

  it('편집 값을 전달하고 소비자가 변환한 controlled 값을 표시한다', async () => {
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
    const input = getByRole('textbox', '표시 이름') as HTMLInputElement

    await editInput(input, 'New name')

    expect(onValueChange).toHaveBeenLastCalledWith({ value: 'New name' })
    expect(input.value).toBe('NEW NAME')

    await editInput(input, '')

    expect(onValueChange).toHaveBeenLastCalledWith({ value: '' })
    expect(input.value).toBe('')
  })

  it('소비자가 편집 값을 채택하지 않으면 기존 controlled 값을 유지한다', async () => {
    const onValueChange = vi.fn<NonNullable<TextFieldProps['onValueChange']>>()
    await render(
      <TextField label="표시 이름" value="고정 이름" onValueChange={onValueChange}>
        <TextFieldInput />
      </TextField>
    )
    const input = getByRole('textbox', '표시 이름') as HTMLInputElement

    await editInput(input, '바꾸려는 이름')

    expect(onValueChange).toHaveBeenLastCalledWith({ value: '바꾸려는 이름' })
    expect(input.value).toBe('고정 이름')
  })

  it('입력에 직접 준 value와 onChange도 TextField 안에서 동작한다', async () => {
    function DirectField() {
      const [value, setValue] = useState('처음')

      return (
        <TextField label="정답 닉네임">
          <TextFieldInput value={value} onChange={(event) => setValue(event.target.value)} />
        </TextField>
      )
    }
    await render(<DirectField />)
    const input = getByRole('textbox', '정답 닉네임') as HTMLInputElement

    await editInput(input, '바뀐 값')

    expect(input.value).toBe('바뀐 값')
  })

  it('invalid 전환에 따라 오류 연결을 추가, 제거하며 설명 연결을 유지한다', async () => {
    function Field({ invalid }: { invalid: boolean }) {
      return (
        <TextField
          label="표시 이름"
          invalid={invalid}
          description="다른 사람이 볼 이름입니다."
          errorMessage="이름을 입력해 주세요."
        >
          <TextFieldInput />
        </TextField>
      )
    }
    await render(<Field invalid={false} />)
    let input = getByRole('textbox', '표시 이름')
    expect(input.getAttribute('aria-invalid')).not.toBe('true')
    expect(describedTexts(input)).toEqual(['다른 사람이 볼 이름입니다.'])

    await render(<Field invalid />)
    input = getByRole('textbox', '표시 이름')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(new Set(describedTexts(input))).toEqual(
      new Set(['다른 사람이 볼 이름입니다.', '이름을 입력해 주세요.'])
    )

    await render(<Field invalid={false} />)
    input = getByRole('textbox', '표시 이름')
    expect(input.getAttribute('aria-invalid')).not.toBe('true')
    expect(describedTexts(input)).toEqual(['다른 사람이 볼 이름입니다.'])
  })

  it('여러 입력의 label, 설명, 오류가 다른 필드와 섞이지 않는다', async () => {
    await render(
      <>
        <TextField
          label="표시 이름"
          value="모험가"
          invalid
          description="다른 사람이 볼 이름입니다."
          errorMessage="이름을 확인해 주세요."
        >
          <TextFieldInput />
        </TextField>
        <TextField
          label="이메일"
          value="hello@example.invalid"
          invalid
          description="연락받을 이메일입니다."
          errorMessage="이메일을 확인해 주세요."
        >
          <TextFieldInput />
        </TextField>
      </>
    )
    const name = getByRole('textbox', '표시 이름') as HTMLInputElement
    const email = getByRole('textbox', '이메일') as HTMLInputElement

    expect(name).not.toBe(email)
    expect(name.value).toBe('모험가')
    expect(email.value).toBe('hello@example.invalid')
    expect(new Set(describedTexts(name))).toEqual(
      new Set(['다른 사람이 볼 이름입니다.', '이름을 확인해 주세요.'])
    )
    expect(new Set(describedTexts(email))).toEqual(
      new Set(['연락받을 이메일입니다.', '이메일을 확인해 주세요.'])
    )
  })

  it.each([
    { title: 'render', compose: 'render' },
    { title: '이행 중 asChild', compose: 'asChild' }
  ])('합성 방식 $title: Typo input에 label과 값이 연결된다', async ({ compose }) => {
    const ref = createRef<HTMLInputElement>()
    function SearchField() {
      const [query, setQuery] = useState('')
      const input = <Typo.txtS as="input" ref={ref} />

      return (
        <TextField
          label="구성 요소 검색"
          value={query}
          onValueChange={({ value }) => setQuery(value)}
        >
          {compose === 'render' ? (
            <TextFieldInput render={input} />
          ) : (
            <TextFieldInput asChild>{input}</TextFieldInput>
          )}
        </TextField>
      )
    }
    await render(<SearchField />)
    const input = getByRole('textbox', '구성 요소 검색') as HTMLInputElement

    await editInput(input, 'MIT')

    expect(ref.current).toBe(input)
    expect(input.value).toBe('MIT')
  })
})

type DialogExampleProps = Pick<
  DialogRootProps,
  'defaultOpen' | 'open' | 'onOpenChange' | 'disablePointerDismissal'
>

function DialogExample(props: DialogExampleProps) {
  return (
    <DialogRoot {...props}>
      <DialogTrigger asChild>
        <Button>상세 정보 열기</Button>
      </DialogTrigger>
      <DialogContent title="상세 정보" description="입력한 내용을 확인해 주세요.">
        <DialogAction>확인하고 닫기</DialogAction>
      </DialogContent>
    </DialogRoot>
  )
}

function reasons(
  onOpenChange: ReturnType<typeof vi.fn<NonNullable<DialogRootProps['onOpenChange']>>>
) {
  return new Set(onOpenChange.mock.calls.map(([, details]) => details.reason))
}

describe('Dialog의 상태 전이와 접근성, 포커스', () => {
  it('trigger를 누르면 열림 값을 전달하고 이름이 붙은 dialog를 표시한다', async () => {
    const onOpenChange = vi.fn<NonNullable<DialogRootProps['onOpenChange']>>()
    await render(<DialogExample onOpenChange={onOpenChange} />)
    const trigger = getByRole('button', '상세 정보 열기')
    expect(queryByRole('dialog')).toBeNull()
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    await click(trigger)

    expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything())
    expect(reasons(onOpenChange)).toEqual(new Set(['trigger-press']))
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(queryByRole('dialog', '상세 정보')).not.toBeNull()
  })

  it('modal의 제목과 설명이 dialog의 접근성 이름, 설명에 연결되고 바깥 내용은 가려진다', async () => {
    await render(<DialogExample defaultOpen />)
    const dialog = getByRole('dialog', '상세 정보')

    expect(describedTexts(dialog)).toEqual(['입력한 내용을 확인해 주세요.'])
    // Base UI는 aria-modal 대신 dialog 밖의 형제 내용을 보조 기술에서 가린다.
    expect(container.getAttribute('aria-hidden')).toBe('true')
  })

  it.each([
    { title: '기본값이면 닫지 않는다', props: {}, closes: false },
    { title: '허용하면 닫는다', props: { disablePointerDismissal: false }, closes: true }
  ])('바깥 누름은 $title', async ({ props, closes }) => {
    const onOpenChange = vi.fn<NonNullable<DialogRootProps['onOpenChange']>>()
    await render(<DialogExample {...props} onOpenChange={onOpenChange} />)
    await click(getByRole('button', '상세 정보 열기'))
    const dialog = getByRole('dialog', '상세 정보')
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    await settle()
    onOpenChange.mockClear()

    await act(async () => {
      document.body.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', button: 0 })
      )
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
      document.body.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse', button: 0 })
      )
      document.body.click()
    })

    if (closes) {
      expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything())
      expect(reasons(onOpenChange)).toEqual(new Set(['outside-press']))
      await vi.waitFor(() => expect(queryByRole('dialog')).toBeNull())
    } else {
      expect(onOpenChange).not.toHaveBeenCalled()
      expect(queryByRole('dialog')).toBe(dialog)
    }
  })

  // jsdom은 inert와 Tab 이동을 구현하지 않으므로 focus 가두기는 시작 위치와 경계 표시까지만 확인한다.
  it('trigger로 열면 focus가 dialog 안으로 이동하고 앞뒤에 focus 경계를 둔다', async () => {
    await render(<DialogExample />)
    const trigger = getByRole('button', '상세 정보 열기')
    trigger.focus()

    await click(trigger)
    const dialog = getByRole('dialog', '상세 정보')

    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    expect(dialog.previousElementSibling?.hasAttribute('data-base-ui-focus-guard')).toBe(true)
    expect(dialog.nextElementSibling?.hasAttribute('data-base-ui-focus-guard')).toBe(true)
  })

  it.each([
    { title: 'Escape 키 입력', method: 'escape', reason: 'escape-key' },
    { title: '닫기 버튼 클릭', method: 'close', reason: 'close-press' },
    { title: 'DialogAction 클릭', method: 'action', reason: 'close-press' }
  ])('$title 시 닫힘 값을 전달하고 trigger로 focus를 돌려준다', async ({ method, reason }) => {
    const onOpenChange = vi.fn<NonNullable<DialogRootProps['onOpenChange']>>()
    await render(<DialogExample onOpenChange={onOpenChange} />)
    const trigger = getByRole('button', '상세 정보 열기')
    trigger.focus()
    await click(trigger)
    const dialog = getByRole('dialog', '상세 정보')
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    onOpenChange.mockClear()

    if (method === 'escape') {
      await press(document.activeElement as HTMLElement, 'Escape')
    } else if (method === 'close') {
      await click(getByRole('button', '닫기', dialog))
    } else {
      await click(getByRole('button', '확인하고 닫기', dialog))
    }

    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything())
    expect(reasons(onOpenChange)).toEqual(new Set([reason]))
    await vi.waitFor(() => expect(queryByRole('dialog')).toBeNull())
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('onOpenChange에서 Escape 닫기를 취소하면 열린 상태를 유지한다', async () => {
    await render(
      <DialogExample
        defaultOpen
        onOpenChange={(_open, details) => {
          if (details.reason === 'escape-key') {
            details.cancel()
          }
        }}
      />
    )
    const dialog = getByRole('dialog', '상세 정보')
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    await press(document.activeElement as HTMLElement, 'Escape')

    expect(queryByRole('dialog', '상세 정보')).toBe(dialog)
  })

  it.each([{ role: 'listbox' }, { role: 'menu' }])(
    'dialog 안에 펼친 $role 에서 누른 Escape는 dialog를 닫지 않는다',
    async ({ role }) => {
      const onOpenChange = vi.fn<NonNullable<DialogRootProps['onOpenChange']>>()
      await render(
        <DialogRoot defaultOpen onOpenChange={onOpenChange}>
          <DialogContent title="화면 캡처">
            <div role={role} aria-label="캡처할 창" tabIndex={0} />
          </DialogContent>
        </DialogRoot>
      )
      const list = getByRole(role, '캡처할 창')
      await act(async () => list.focus())

      await press(list, 'Escape')

      expect(onOpenChange).not.toHaveBeenCalled()
      expect(queryByRole('dialog', '화면 캡처')).not.toBeNull()
    }
  )

  it('controlled dialog는 닫힘 요청 뒤에도 부모의 open 값이 바뀔 때까지 열린 상태를 유지한다', async () => {
    const onOpenChange = vi.fn<NonNullable<DialogRootProps['onOpenChange']>>()
    await render(<DialogExample open onOpenChange={onOpenChange} />)
    const dialog = getByRole('dialog', '상세 정보')
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    await press(document.activeElement as HTMLElement, 'Escape')

    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything())
    expect(getByRole('button', '상세 정보 열기').getAttribute('aria-expanded')).toBe('true')
    expect(queryByRole('dialog', '상세 정보')).not.toBeNull()
    onOpenChange.mockClear()

    await render(<DialogExample open={false} onOpenChange={onOpenChange} />)

    await vi.waitFor(() => expect(queryByRole('dialog')).toBeNull())
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

function SettingsIcon() {
  return <svg data-testid="settings-icon" viewBox="0 0 24 24" />
}

describe('IconButton의 이름, 클릭, disabled와 Dialog trigger 연결', () => {
  it('아이콘만 보이는 버튼이 aria-label을 이름으로 갖고 클릭과 ref를 전달한다', async () => {
    const onClick = vi.fn<NonNullable<IconButtonProps['onClick']>>()
    const ref = createRef<HTMLButtonElement>()
    await render(
      <IconButton ref={ref} aria-label="설정" icon={<SettingsIcon />} onClick={onClick} />
    )
    const button = getByRole('button', '설정')

    expect(ref.current).toBe(button)
    expect(button.textContent).toBe('')
    expect(button.querySelector('[data-testid="settings-icon"]')).not.toBeNull()
    await click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('disabled 버튼은 클릭을 차단한다', async () => {
    const onClick = vi.fn<NonNullable<IconButtonProps['onClick']>>()
    await render(
      <IconButton aria-label="캡처 연결 예정" icon={<SettingsIcon />} disabled onClick={onClick} />
    )
    const button = getByRole('button', '캡처 연결 예정') as HTMLButtonElement

    expect(button.disabled).toBe(true)
    await click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it.each([
    { title: 'render', compose: 'render' },
    { title: '이행 중 asChild', compose: 'asChild' }
  ])(
    'DialogTrigger 합성 방식 $title: dialog를 열고 Escape로 닫으면 focus를 버튼으로 돌려준다',
    async ({ compose }) => {
      const icon = <IconButton aria-label="설정" icon={<SettingsIcon />} />
      await render(
        <DialogRoot>
          {compose === 'render' ? (
            <DialogTrigger render={icon} />
          ) : (
            <DialogTrigger asChild>{icon}</DialogTrigger>
          )}
          <DialogContent title="설정">
            <DialogAction>닫기</DialogAction>
          </DialogContent>
        </DialogRoot>
      )
      const trigger = getByRole('button', '설정')
      expect(allByRole('button').length).toBe(1)
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
      trigger.focus()

      await click(trigger)
      const dialog = getByRole('dialog', '설정')
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

      await press(document.activeElement as HTMLElement, 'Escape')

      await vi.waitFor(() => expect(queryByRole('dialog')).toBeNull())
      await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
    }
  )
})

const servers = [
  { id: 'cain', label: '카인' },
  { id: 'diregie', label: '디레지에' },
  { id: 'siroco', label: '시로코' }
]

function ServerSelect({
  onValueChange,
  surface
}: {
  onValueChange: (value: string | null) => void
  surface?: ControlSurface
}) {
  const [value, setValue] = useState<string | null>('siroco')

  return (
    <Select.Root
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onValueChange(next)
      }}
      items={servers.map((server) => ({ value: server.id, label: server.label }))}
    >
      <Select.Trigger size="xs" aria-label="서버" surface={surface}>
        <Select.Value />
      </Select.Trigger>
      <Select.Popup aria-label="서버 목록" surface={surface}>
        {servers.map((server) => (
          <Select.Item key={server.id} value={server.id}>
            <Select.ItemText>{server.label}</Select.ItemText>
          </Select.Item>
        ))}
      </Select.Popup>
    </Select.Root>
  )
}

describe('Select의 키보드 선택과 포커스 복귀', () => {
  it('trigger에서 목록을 열고 화살표와 Enter로 고르면 값을 전달하고 trigger로 돌아온다', async () => {
    const onValueChange = vi.fn<(value: string | null) => void>()
    await render(<ServerSelect onValueChange={onValueChange} />)
    const trigger = getByRole('combobox', '서버')
    expect(trigger.textContent).toContain('시로코')
    trigger.focus()

    await press(trigger, 'ArrowDown')
    const listbox = await vi.waitFor(() => getByRole('listbox'))
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const current = getByRole('option', '시로코', listbox)
    expect(current.getAttribute('aria-selected')).toBe('true')
    await vi.waitFor(() => expect(document.activeElement).toBe(current))

    await press(current, 'ArrowUp')
    const previous = getByRole('option', '디레지에', listbox)
    await vi.waitFor(() => expect(document.activeElement).toBe(previous))
    await press(previous, 'Enter')

    expect(onValueChange).toHaveBeenLastCalledWith('diregie')
    await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'))
    expect(trigger.textContent).toContain('디레지에')
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('카드 위 칩은 body portal의 목록 항목까지 카드 면으로 그리고 같은 키보드 조작을 유지한다', async () => {
    const onValueChange = vi.fn<(value: string | null) => void>()
    await render(<ServerSelect onValueChange={onValueChange} surface="card" />)
    const trigger = getByRole('combobox', '서버')
    expect(trigger.dataset.surface).toBe('card')
    trigger.focus()

    await press(trigger, 'ArrowDown')
    const listbox = await vi.waitFor(() => getByRole('listbox', '서버 목록'))
    expect(container.contains(listbox)).toBe(false)
    expect(listbox.closest('[data-surface]')?.getAttribute('data-surface')).toBe('card')
    const options = allByRole('option', listbox)
    expect(options.map((option) => option.dataset.surface)).toEqual(['card', 'card', 'card'])
    const current = getByRole('option', '시로코', listbox)
    await vi.waitFor(() => expect(document.activeElement).toBe(current))
    await press(current, 'ArrowUp')
    const previous = getByRole('option', '디레지에', listbox)
    await vi.waitFor(() => expect(document.activeElement).toBe(previous))
    await press(previous, 'Enter')

    expect(onValueChange).toHaveBeenLastCalledWith('diregie')
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('기본 칩과 목록 항목은 모드 면으로 그리고 카드 면과 다른 외형을 쓴다', async () => {
    await render(
      <>
        <ServerSelect onValueChange={vi.fn()} />
        <ServerSelect onValueChange={vi.fn()} surface="card" />
      </>
    )
    const [plain, onCard] = allByRole('combobox')
    expect(plain.dataset.surface).toBe('default')
    expect(onCard.className).not.toBe(plain.className)

    await click(plain)
    const plainList = await vi.waitFor(() => getByRole('listbox', '서버 목록'))
    const plainOption = getByRole('option', '카인', plainList)
    expect(plainOption.dataset.surface).toBe('default')
    const plainOptionClass = plainOption.className
    await press(plainOption, 'Escape')
    await vi.waitFor(() => expect(plain.getAttribute('aria-expanded')).toBe('false'))

    await click(onCard)
    await vi.waitFor(() => expect(onCard.getAttribute('aria-expanded')).toBe('true'))
    const cardList = document.getElementById(onCard.getAttribute('aria-controls') ?? '')
    if (cardList == null) {
      throw new Error('테스트 준비: 카드 목록이 없습니다.')
    }
    const cardOption = getByRole('option', '카인', cardList)
    expect(cardOption.dataset.surface).toBe('card')
    expect(cardOption.className).not.toBe(plainOptionClass)
  })

  it('Escape로 닫으면 값을 바꾸지 않고 trigger로 focus를 돌려준다', async () => {
    const onValueChange = vi.fn<(value: string | null) => void>()
    await render(<ServerSelect onValueChange={onValueChange} />)
    const trigger = getByRole('combobox', '서버')
    trigger.focus()
    await press(trigger, 'ArrowDown')
    const listbox = await vi.waitFor(() => getByRole('listbox'))
    const current = getByRole('option', '시로코', listbox)
    await vi.waitFor(() => expect(document.activeElement).toBe(current))

    await press(current, 'Escape')

    await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'))
    expect(onValueChange).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})

function SearchMenu({ onValueChange }: { onValueChange: (value: string) => void }) {
  const [mode, setMode] = useState('party')

  return (
    <Menu.Root>
      <Menu.Trigger render={<Button />}>검색 방식</Menu.Trigger>
      <Menu.Popup aria-label="검색 방식">
        <Menu.RadioGroup
          value={mode}
          onValueChange={(next: string) => {
            setMode(next)
            onValueChange(next)
          }}
        >
          <Menu.RadioItem value="party" closeOnClick>
            파티
          </Menu.RadioItem>
          <Menu.RadioItem value="raid" closeOnClick>
            공대
          </Menu.RadioItem>
        </Menu.RadioGroup>
      </Menu.Popup>
    </Menu.Root>
  )
}

describe('Menu radio 항목의 키보드 선택과 포커스 복귀', () => {
  it('trigger를 키보드로 열고 화살표와 Enter로 고르면 값을 전달하고 trigger로 돌아온다', async () => {
    const onValueChange = vi.fn<(value: string) => void>()
    await render(<SearchMenu onValueChange={onValueChange} />)
    const trigger = getByRole('button', '검색 방식')
    trigger.focus()

    await press(trigger, 'ArrowDown')
    const menu = await vi.waitFor(() => getByRole('menu', '검색 방식'))
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const party = getByRole('menuitemradio', '파티', menu)
    expect(party.getAttribute('aria-checked')).toBe('true')
    await vi.waitFor(() => expect(document.activeElement).toBe(party))

    await press(party, 'ArrowDown')
    const raid = getByRole('menuitemradio', '공대', menu)
    await vi.waitFor(() => expect(document.activeElement).toBe(raid))
    await press(raid, 'Enter')

    expect(onValueChange).toHaveBeenLastCalledWith('raid')
    await vi.waitFor(() => expect(queryByRole('menu')).toBeNull())
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('Escape로 닫으면 선택을 바꾸지 않고 trigger로 focus를 돌려준다', async () => {
    const onValueChange = vi.fn<(value: string) => void>()
    await render(<SearchMenu onValueChange={onValueChange} />)
    const trigger = getByRole('button', '검색 방식')
    trigger.focus()
    await press(trigger, 'ArrowDown')
    const menu = await vi.waitFor(() => getByRole('menu', '검색 방식'))
    const party = getByRole('menuitemradio', '파티', menu)
    await vi.waitFor(() => expect(document.activeElement).toBe(party))

    await press(party, 'Escape')

    await vi.waitFor(() => expect(queryByRole('menu')).toBeNull())
    expect(onValueChange).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})

describe('Tabs의 키보드 이동과 패널 연결', () => {
  // 탭은 native button이다. jsdom은 Enter의 기본 click을 만들지 않으므로 고르기는 click으로 보낸다.
  it('화살표로 다음 탭에 focus를 옮기고 고르면 그 패널을 보인다', async () => {
    await render(
      <Tabs.Root defaultValue="collection">
        <Tabs.List aria-label="개발자 도구">
          <Tabs.Tab value="collection">수집</Tabs.Tab>
          <Tabs.Tab value="labeling">정답 입력</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="collection">수집 패널</Tabs.Panel>
        <Tabs.Panel value="labeling">정답 패널</Tabs.Panel>
      </Tabs.Root>
    )
    const collection = getByRole('tab', '수집')
    const labeling = getByRole('tab', '정답 입력')
    expect(collection.getAttribute('aria-selected')).toBe('true')
    expect(getByRole('tabpanel').textContent).toBe('수집 패널')
    collection.focus()

    await press(collection, 'ArrowRight')
    await vi.waitFor(() => expect(document.activeElement).toBe(labeling))
    await click(labeling)

    await vi.waitFor(() => expect(labeling.getAttribute('aria-selected')).toBe('true'))
    expect(collection.getAttribute('aria-selected')).toBe('false')
    const panel = getByRole('tabpanel')
    expect(panel.textContent).toBe('정답 패널')
    expect(panel.getAttribute('aria-labelledby')).toBe(labeling.id)
  })

  it('카드 면 탭은 카드 면으로 표시하고 비활성 탭을 고르지 않는다', async () => {
    await render(
      <Tabs.Root defaultValue="character">
        <Tabs.List aria-label="카드 면" surface="card">
          <Tabs.Tab value="character">캐릭터</Tabs.Tab>
          <Tabs.Tab value="equipment" disabled>
            장비
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="character">캐릭터 패널</Tabs.Panel>
        <Tabs.Panel value="equipment">장비 패널</Tabs.Panel>
      </Tabs.Root>
    )
    expect(getByRole('tablist', '카드 면').dataset.surface).toBe('card')
    const character = getByRole('tab', '캐릭터')
    expect(character.dataset.surface).toBe('card')
    const equipment = getByRole('tab', '장비')
    expect(equipment.getAttribute('aria-disabled')).toBe('true')

    await click(equipment)

    expect(getByRole('tab', '캐릭터').getAttribute('aria-selected')).toBe('true')
    expect(getByRole('tabpanel').textContent).toBe('캐릭터 패널')
  })
})

describe('Switch, Checkbox, Chip의 켜짐 상태', () => {
  it('Switch를 누르면 켜짐 값을 전달하고 상태를 알린다', async () => {
    const onCheckedChange = vi.fn<(checked: boolean) => void>()
    await render(<Switch aria-label="자동 캡처" onCheckedChange={onCheckedChange} />)
    const control = getByRole('switch', '자동 캡처')
    expect(control.getAttribute('aria-checked')).toBe('false')

    await click(control)

    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.anything())
    expect(control.getAttribute('aria-checked')).toBe('true')
  })

  it('Checkbox는 disabled이면 눌러도 켜지지 않는다', async () => {
    const onCheckedChange = vi.fn<(checked: boolean) => void>()
    await render(
      <>
        <Checkbox aria-label="1번 크롭 저장" onCheckedChange={onCheckedChange} />
        <Checkbox aria-label="2번 크롭 저장" disabled onCheckedChange={onCheckedChange} />
      </>
    )
    const enabled = getByRole('checkbox', '1번 크롭 저장')
    const disabled = getByRole('checkbox', '2번 크롭 저장')

    await click(enabled)
    await click(disabled)

    expect(enabled.getAttribute('aria-checked')).toBe('true')
    expect(disabled.getAttribute('aria-checked')).toBe('false')
    expect(onCheckedChange).toHaveBeenCalledOnce()
  })

  it('Chip은 누를 때마다 aria-pressed를 바꾼다', async () => {
    await render(<Chip>원본</Chip>)
    const chip = getByRole('button', '원본')
    expect(chip.getAttribute('aria-pressed')).toBe('false')

    await click(chip)
    expect(chip.getAttribute('aria-pressed')).toBe('true')

    await click(chip)
    expect(chip.getAttribute('aria-pressed')).toBe('false')
  })
})

describe('StatusChip과 StatusBadge의 상태 알림 범위', () => {
  it('호출자가 status 영역을 요청하면 상태 글자만 알린다', async () => {
    await render(
      <StatusBadge tone="positive" role="status">
        창 감지됨
      </StatusBadge>
    )

    expect(getByRole('status').textContent).toBe('창 감지됨')
  })

  it('호출자가 요청하지 않으면 live region을 만들지 않는다', async () => {
    await render(<StatusChip tone="waiting">파티원창 찾는 중</StatusChip>)

    expect(container.textContent).toBe('파티원창 찾는 중')
    expect(container.querySelector('[role]')).toBeNull()
    expect(container.querySelector('[aria-live]')).toBeNull()
  })
})

describe('NumericText의 최종값 읽기', () => {
  it('올라가는 시간이 없으면 바로 천 단위로 구분한 최종값을 보이고 읽힌다', async () => {
    await render(<NumericText value={125850} />)

    expect(container.textContent).toBe('125,850125,850')
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('125,850')
  })
})

describe('CardFrame의 상태별 장식', () => {
  // 카드 내용은 화면이 넘긴 자식뿐이고, 나머지 자식은 보조 기술에서 숨긴 장식이다.
  async function decorations(state: 'default' | 'waiting' | 'top' | 'ranker') {
    await render(
      <CardFrame state={state} as="article" aria-label="1번 슬롯">
        <p>내용</p>
      </CardFrame>
    )
    const card = container.querySelector('article')
    const extras = [...(card?.children ?? [])].filter((child) => child.tagName !== 'P')

    return { card, extras }
  }

  it('상위와 랭커는 꺾쇠 네 개 밖에 빛줄기 층을 하나 더 두고 모두 보조 기술에서 숨긴다', async () => {
    const top = await decorations('top')
    expect(top.card?.getAttribute('data-state')).toBe('top')
    expect(top.extras).toHaveLength(5)
    expect(top.extras.every((child) => child.getAttribute('aria-hidden') === 'true')).toBe(true)
    expect(top.card?.textContent).toBe('내용')
    // 장식 층 안에 빛줄기 하나를 둔다.
    expect(top.extras[0]?.children).toHaveLength(1)
    const topLayer = top.extras[0]?.className
    const topSweep = top.extras[0]?.firstElementChild?.className

    const ranker = await decorations('ranker')
    expect(ranker.extras).toHaveLength(5)
    expect(ranker.extras[0]?.children).toHaveLength(1)
    // 랭커 층에는 스캔선이 깔리고 빛줄기도 상위의 금색 띠와 다른 청록 띠다.
    expect(ranker.extras[0]?.className).not.toBe(topLayer)
    expect(ranker.extras[0]?.firstElementChild?.className).not.toBe(topSweep)
  })

  it('기본 카드는 꺾쇠만, 대기 카드는 장식 없이 그린다', async () => {
    expect((await decorations('default')).extras).toHaveLength(4)
    expect((await decorations('waiting')).extras).toHaveLength(0)
  })
})
