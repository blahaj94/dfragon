// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useUpdateNotice } from './useUpdateNotice'
import { UpdateNotice } from '../components/UpdateNotice'
import type {
  UpdateNoticeApi,
  UpdateNoticeSnapshot
} from '../../../preload/common/types/update-notice'

function Harness(): React.JSX.Element | null {
  const { notice, openRelease, dismiss } = useUpdateNotice()
  if (notice == null) {
    return null
  }

  return <UpdateNotice tag={notice.tag} onOpenRelease={openRelease} onDismiss={dismiss} />
}

let container: HTMLDivElement
let root: Root
let listeners: Set<(snapshot: UpdateNoticeSnapshot) => void>

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {
        return
      }
      unobserve(): void {
        return
      }
      disconnect(): void {
        return
      }
    }
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  listeners = new Set()
})

afterEach(async () => {
  await act(async () => root.unmount())
  Reflect.deleteProperty(window, 'updateNotice')
  container.remove()
  vi.unstubAllGlobals()
})

function installApi(overrides: Partial<UpdateNoticeApi>): UpdateNoticeApi {
  const api: UpdateNoticeApi = {
    getUpdateNotice: vi.fn(async () => ({ revision: 0, notice: null })),
    dismissUpdateNotice: vi.fn(async () => ({ revision: 0, notice: null })),
    openUpdateRelease: vi.fn(async () => undefined),
    onUpdateNoticeChanged: vi.fn((listener) => {
      listeners.add(listener)

      return () => listeners.delete(listener)
    }),
    ...overrides
  }
  Object.defineProperty(window, 'updateNotice', { configurable: true, value: api })

  return api
}

async function choose(label: string): Promise<void> {
  const chip = container.querySelector('button')
  if (chip == null) {
    throw new Error('Missing update notice chip')
  }
  await act(async () => chip.click())
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (element) => element.textContent === label
  )
  if (item == null) {
    throw new Error(`Missing ${label} menu item`)
  }

  await act(async () => item.click())
}

it('새 버전을 보이고 열기, 닫기에 같은 tag를 보낸다', async () => {
  const api = installApi({
    getUpdateNotice: vi.fn(async () => ({
      revision: 1,
      notice: { tag: 'v0.0.4-beta.1' }
    })),
    dismissUpdateNotice: vi.fn(async () => ({ revision: 2, notice: null }))
  })
  await act(async () => root.render(<Harness />))

  expect(container.textContent).toContain('새 버전 v0.0.4-beta.1')
  await choose('Release 열기')
  expect(api.openUpdateRelease).toHaveBeenCalledExactlyOnceWith('v0.0.4-beta.1')
  await choose('닫기')
  expect(api.dismissUpdateNotice).toHaveBeenCalledExactlyOnceWith('v0.0.4-beta.1')
  expect(container.textContent).toBe('')
})

it('늦게 도착한 이전 상태는 나중 알림을 덮지 않는다', async () => {
  let respond!: (snapshot: UpdateNoticeSnapshot) => void
  installApi({
    getUpdateNotice: vi.fn(
      () =>
        new Promise<UpdateNoticeSnapshot>((resolve) => {
          respond = resolve
        })
    )
  })
  await act(async () => root.render(<Harness />))

  await act(async () => {
    for (const listener of listeners) {
      listener({ revision: 2, notice: { tag: 'v0.0.5' } })
    }
  })
  await act(async () => respond({ revision: 1, notice: { tag: 'v0.0.4' } }))

  expect(container.textContent).toContain('새 버전 v0.0.5')
})
