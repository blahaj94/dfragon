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
