import { beforeEach, expect, it, vi } from 'vitest'
import { writeText } from './clipboard'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('electron', () => ({ ipcRenderer: { invoke: mocks.invoke } }))
beforeEach(() => vi.clearAllMocks())

it('복사할 글자를 고정 채널과 값 그대로 보낸다', async () => {
  mocks.invoke.mockResolvedValue(undefined)
  await expect(writeText('[퍼리조아, 시로코, 검은전투늑대], []')).resolves.toBeUndefined()
  expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith(
    'writeClipboardText',
    '[퍼리조아, 시로코, 검은전투늑대], []'
  )
})

it('main이 거절하면 거절을 그대로 전한다', async () => {
  mocks.invoke.mockRejectedValue(new Error('CLIPBOARD_NOT_ALLOWED'))
  await expect(writeText('[]')).rejects.toThrow('CLIPBOARD_NOT_ALLOWED')
})
