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

// App과 같은 방식으로 hook 결과를 알림 컴포넌트에 연결한다.
function Harness(): React.JSX.Element | null {
  const { notice, openRelease, dismiss } = useUpdateNotice()
  if (notice == null) {
    return null
  }

  return (
    <UpdateNotice
      tag={notice.tag}
      endsOcrCollection={notice.endsOcrCollection}
      onOpenRelease={openRelease}
      onDismiss={dismiss}
    />
  )
}

let container: HTMLDivElement
let root: Root
let listeners: Set<(snapshot: UpdateNoticeSnapshot) => void>

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
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

async function click(label: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find(
    (element) => element.textContent === label
  )
  if (button == null) {
    throw new Error(`Missing ${label} control`)
  }

  await act(async () => button.click())
}

it('새 버전과 OCR 수집 종료 안내를 보이고 열기, 닫기에 같은 tag를 보낸다', async () => {
  const api = installApi({
    getUpdateNotice: vi.fn(async () => ({
      revision: 1,
      notice: { tag: 'v0.0.4-beta.1', endsOcrCollection: true }
    })),
    dismissUpdateNotice: vi.fn(async () => ({ revision: 2, notice: null }))
  })
  await act(async () => root.render(<Harness />))

  expect(container.textContent).toContain('새 버전 v0.0.4-beta.1')
  expect(container.textContent).toContain('이 버전으로 바꾸면 OCR 자료 수집이 꺼집니다.')
  await click('Release 열기')
  expect(api.openUpdateRelease).toHaveBeenCalledExactlyOnceWith('v0.0.4-beta.1')
  await click('닫기')
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
      listener({ revision: 2, notice: { tag: 'v0.0.5', endsOcrCollection: false } })
    }
  })
  await act(async () =>
    respond({ revision: 1, notice: { tag: 'v0.0.4', endsOcrCollection: true } })
  )

  expect(container.textContent).toContain('새 버전 v0.0.5')
  expect(container.textContent).not.toContain('OCR 자료 수집')
})
