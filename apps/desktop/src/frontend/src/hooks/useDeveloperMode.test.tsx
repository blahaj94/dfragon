// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useDeveloperMode } from './useDeveloperMode'

function Harness(): React.JSX.Element {
  const mode = useDeveloperMode()

  return (
    <>
      <output data-testid="state">
        {mode.status}:{String(mode.enabled)}:{String(mode.updating)}
      </output>
      <button onClick={mode.retry}>retry</button>
      <button onClick={() => mode.setEnabled(true)}>enable</button>
      <button onClick={() => mode.setEnabled(false)}>disable</button>
    </>
  )
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  Reflect.deleteProperty(window, 'developer')
  container.remove()
  vi.unstubAllGlobals()
})

function installDeveloperApi(api: unknown): void {
  Object.defineProperty(window, 'developer', {
    configurable: true,
    value: api
  })
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}

function state(): string {
  return container.querySelector('[data-testid="state"]')!.textContent!
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

it('reads and persists the developer mode setting', async () => {
  const api = {
    getSettings: vi.fn(async () => ({ enabled: false })),
    setEnabled: vi.fn(async (enabled: boolean) => ({ enabled }))
  }
  installDeveloperApi(api)

  await act(async () => root.render(<Harness />))
  expect(state()).toBe('ready:false:false')

  await click('enable')
  expect(api.setEnabled).toHaveBeenCalledExactlyOnceWith(true)
  expect(state()).toBe('ready:true:false')

  await click('disable')
  expect(api.setEnabled).toHaveBeenLastCalledWith(false)
  expect(state()).toBe('ready:false:false')
})

it('fails closed and reports unavailable when the preload API is missing', async () => {
  await act(async () => root.render(<Harness />))

  expect(state()).toBe('unavailable:false:false')
  await click('enable')
  expect(state()).toBe('unavailable:false:false')
})

it('keeps mode off after a failed write and can retry the stored setting', async () => {
  const api = {
    getSettings: vi.fn(async () => ({ enabled: false })),
    setEnabled: vi.fn(async () => {
      throw new Error('storage failure')
    })
  }
  installDeveloperApi(api)

  await act(async () => root.render(<Harness />))
  await click('enable')
  expect(state()).toBe('error:false:false')

  api.getSettings.mockResolvedValue({ enabled: true })
  await click('retry')
  expect(state()).toBe('ready:true:false')
})

it('fails closed when the settings response does not have a boolean enabled value', async () => {
  installDeveloperApi({
    getSettings: vi.fn(async () => ({ enabled: 'true' })),
    setEnabled: vi.fn()
  })

  await act(async () => root.render(<Harness />))

  expect(state()).toBe('error:false:false')
})

it('ignores duplicate reads and writes while each operation is pending', async () => {
  const read = deferred<{ enabled: boolean }>()
  const write = deferred<{ enabled: boolean }>()
  const api = {
    getSettings: vi.fn(() => read.promise),
    setEnabled: vi.fn(() => write.promise)
  }
  installDeveloperApi(api)

  await act(async () => root.render(<Harness />))
  expect(api.getSettings).toHaveBeenCalledOnce()

  await click('retry')
  expect(api.getSettings).toHaveBeenCalledOnce()

  await act(async () => read.resolve({ enabled: false }))
  expect(state()).toBe('ready:false:false')

  await click('enable')
  expect(state()).toBe('ready:false:true')
  await click('enable')
  await click('disable')
  expect(api.setEnabled).toHaveBeenCalledExactlyOnceWith(true)
  expect(state()).toBe('ready:false:true')

  await act(async () => write.resolve({ enabled: true }))
  expect(state()).toBe('ready:true:false')
})

it('turns developer mode off immediately and keeps it off after a failed disable', async () => {
  const write = deferred<{ enabled: boolean }>()
  installDeveloperApi({
    getSettings: vi.fn(async () => ({ enabled: true })),
    setEnabled: vi.fn(() => write.promise)
  })

  await act(async () => root.render(<Harness />))
  expect(state()).toBe('ready:true:false')

  await click('disable')
  expect(state()).toBe('ready:false:true')

  await act(async () => write.reject(new Error('storage failure')))
  expect(state()).toBe('error:false:false')
})
