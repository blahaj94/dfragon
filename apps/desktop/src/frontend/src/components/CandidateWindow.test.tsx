// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CandidateWindow } from './CandidateWindow'
import type { CandidatePicker } from '../lib/candidate-picker'

let root: Root
let container: HTMLDivElement
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

const choices: CandidatePicker['choices'] = [
  {
    characterId: 'cain-character',
    characterName: '같은이름',
    serverId: 'cain',
    serverName: '카인',
    fame: 125850,
    adventureName: '달빛아래늑대무리',
    face: { x: 150, y: 50, width: 20, height: 20 }
  },
  {
    characterId: 'siroco-character',
    characterName: '같은이름',
    serverId: 'siroco',
    serverName: '시로코',
    fame: 90000,
    adventureName: null,
    face: null
  }
]

async function render(
  picker: CandidatePicker,
  {
    onPick = vi.fn(),
    onClose = vi.fn()
  }: { onPick?: (serverId: string) => void; onClose?: () => void } = {}
): Promise<void> {
  await act(async () =>
    root.render(<CandidateWindow slot={2} picker={picker} onPick={onPick} onClose={onClose} />)
  )
}

function portrait(server: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>('[role="group"] button')].find(
    (button) => button.getAttribute('aria-label')?.startsWith(server)
  )!
}

it('후보마다 얼굴 초상화만 두고 서버와 모험단은 title과 보조 기술 이름에만 둔다', async () => {
  await render({ choices, shownServerId: 'cain', previewServerId: null })

  expect(container.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
    '2번 후보 고르기'
  )
  expect(portrait('카인').getAttribute('aria-label')).toBe('카인, 달빛아래늑대무리')
  expect(portrait('카인').title).toBe('카인, 달빛아래늑대무리')
  expect(portrait('시로코').getAttribute('aria-label')).toBe('시로코, 모험단 정보 없음')
  expect(portrait('카인').querySelector('img')?.getAttribute('src')).toBe(
    'https://img-api.neople.co.kr/df/servers/cain/characters/cain-character?zoom=1'
  )
  expect(portrait('시로코').querySelector('img')).toBeNull()
  expect(container.textContent).not.toContain('같은이름')
  expect(container.textContent).not.toContain('카인')
  expect(container.textContent).not.toContain('달빛아래늑대무리')
})

it('지금 보이는 후보를 눌린 상태로 두고 미리보기 중인 후보에 체크와 확정 안내를 단다', async () => {
  await render({ choices, shownServerId: 'cain', previewServerId: null })
  expect(portrait('카인').getAttribute('aria-pressed')).toBe('true')
  expect(portrait('시로코').getAttribute('aria-pressed')).toBe('false')
  expect(portrait('카인').querySelector('svg')).toBeNull()
  expect(portrait('시로코').querySelector('svg')).toBeNull()

  await render({ choices, shownServerId: 'siroco', previewServerId: 'siroco' })
  expect(portrait('시로코').getAttribute('aria-pressed')).toBe('true')
  expect(portrait('시로코').getAttribute('aria-label')).toBe(
    '시로코, 모험단 정보 없음, 미리보기 중, 한 번 더 누르면 확정'
  )
  expect(portrait('시로코').querySelector('svg')).not.toBeNull()
  expect(portrait('카인').querySelector('svg')).toBeNull()
  expect(portrait('시로코').className).not.toBe(portrait('카인').className)
})

it('초상화를 누르면 그 서버로 고르고 닫기 X는 창을 닫는다', async () => {
  const pick = vi.fn()
  const close = vi.fn()
  await render(
    { choices, shownServerId: 'cain', previewServerId: 'siroco' },
    { onPick: pick, onClose: close }
  )

  await act(async () => portrait('시로코').click())
  expect(pick).toHaveBeenCalledExactlyOnceWith('siroco')
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="2번 후보 창 닫기"]')!.click()
  )
  expect(close).toHaveBeenCalledOnce()
  expect(pick).toHaveBeenCalledOnce()
})
