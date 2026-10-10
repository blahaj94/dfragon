import { beforeEach, expect, it, vi } from 'vitest'
import { setTheme } from './window-chrome'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('electron', () => ({ ipcRenderer: { invoke: mocks.invoke } }))
beforeEach(() => vi.clearAllMocks())

it.each(['light', 'dark'] as const)('%s 테마를 고정 채널과 값 그대로 보낸다', async (theme) => {
  mocks.invoke.mockResolvedValue(undefined)
  await expect(setTheme(theme)).resolves.toBeUndefined()
  expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('setWindowChromeTheme', theme)
})

it.each(['system', 'DARK', ' light', null, undefined, 1, ['light']])(
  '잘못된 테마 %j는 IPC로 보내지 않는다',
  async (theme) => {
    await expect(Reflect.apply(setTheme, undefined, [theme])).rejects.toThrow(
      'INVALID_WINDOW_CHROME_COMMAND'
    )
    expect(mocks.invoke).not.toHaveBeenCalled()
  }
)

it('객체를 문자열로 변환해 보내지 않는다', async () => {
  const stringify = vi.fn(() => 'light')
  await expect(Reflect.apply(setTheme, undefined, [{ toString: stringify }])).rejects.toThrow(
    'INVALID_WINDOW_CHROME_COMMAND'
  )
  expect(stringify).not.toHaveBeenCalled()
  expect(mocks.invoke).not.toHaveBeenCalled()
})
