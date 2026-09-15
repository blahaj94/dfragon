import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { addHandler } from '../ipc'
import { CaptureSearchLifetime } from './capture-lifetime'
import { parseSearchControl, parseSearchObservation } from './commands'
import type { SearchRuntime } from './request'
import type { SearchSnapshot } from '../../preload/common/types/search'

export function registerManualSearchIpc({
  runtime,
  requireSender,
  windowGeneration,
  isCurrentDocument,
  publish
}: {
  runtime?: SearchRuntime
  requireSender: (event: IpcMainInvokeEvent) => void
  windowGeneration: () => number
  isCurrentDocument: (generation: number) => boolean
  publish: (snapshot: SearchSnapshot) => void
}): { invalidate: () => void; dispose: () => void } {
  // The shared DTO calls its session ID captureId; this instance never grants media access.
  const lifetime = new CaptureSearchLifetime({
    runtime,
    isCurrent: (binding) => isCurrentDocument(binding.windowGeneration),
    publish
  })

  addHandler('controlManualSearch', (event, ...args) => {
    requireSender(event)
    const control = parseSearchControl(args)
    if (control == null) {
      return lifetime.result('INVALID_SEARCH_COMMAND')
    }
    switch (control.action) {
      case 'read':
        return lifetime.result()
      case 'end':
        return lifetime.end(control.captureId)
      case 'clear':
        return lifetime.clear(control)
      case 'retry':
        return lifetime.retry(control)
      case 'begin':
        // An explicit new begin also recovers a session whose reply was lost.
        lifetime.invalidate()
        return lifetime.begin({ windowGeneration: windowGeneration(), sourceGeneration: 0 })
    }
  })

  addHandler('notifyManualNickname', (event, ...args) => {
    requireSender(event)
    const observation = parseSearchObservation(args)
    if (observation == null) {
      return lifetime.result('INVALID_SEARCH_COMMAND')
    }
    return lifetime.observe(observation)
  })

  return {
    invalidate: () => lifetime.invalidate(),
    dispose: () => {
      lifetime.invalidate()
      ipcMain.removeHandler('controlManualSearch')
      ipcMain.removeHandler('notifyManualNickname')
    }
  }
}
