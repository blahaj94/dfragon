import { beforeEach, expect, it, vi } from 'vitest'
import { setContentHeight } from './window-chrome'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('electron', () => ({ ipcRenderer: { invoke: mocks.invoke } }))
beforeEach(() => vi.clearAllMocks())

it.each([163, 200, 300])('창 내용 높이 %d를 고정 채널과 값 그대로 보낸다', async (height) => {
  mocks.invoke.mockResolvedValue(undefined)
  await expect(setContentHeight(height)).resolves.toBeUndefined()
  expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('setWindowContentHeight', height)
})

it.each([162, 301, 800, 163.5, Number.NaN, '163', null, undefined, [163]])(
  '잘못된 창 내용 높이 %j는 IPC로 보내지 않는다',
  async (height) => {
    await expect(Reflect.apply(setContentHeight, undefined, [height])).rejects.toThrow(
      'INVALID_WINDOW_CHROME_COMMAND'
    )
    expect(mocks.invoke).not.toHaveBeenCalled()
  }
)
