import {
  SEARCH_ACTIONS,
  SEARCH_COMMAND_ERRORS,
  SEARCH_SLOT_COUNTS
} from '../../preload/common/types/search'
import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { addHandler } from '../ipc'
import { createCaptureSearchLifetime, type CaptureBinding } from './capture-lifetime'
import { parseOcrSearchObservation, parseSearchControl, parseSearchObservation } from './commands'
import type { SearchRuntime } from './request'
import type { SearchSnapshot } from '../../preload/common/types/search'

export type ManualSearchKind = keyof typeof SEARCH_SLOT_COUNTS

const CHANNELS = {
  party: { control: 'controlManualSearch', changed: 'manualSearchChanged' },
  raid: { control: 'controlRaidSearch', changed: 'raidSearchChanged' }
} as const
export type ManualSearchChangedChannel = (typeof CHANNELS)[ManualSearchKind]['changed']

export function registerManualSearchIpc({
  kind,
  runtime,
  requireSender,
  windowGeneration,
  sourceGeneration,
  isCurrentCaptureSource,
  isCurrentDocument,
  publish
}: {
  kind: ManualSearchKind
  runtime?: SearchRuntime
  requireSender: (event: IpcMainInvokeEvent) => void
  windowGeneration: () => number
  /** BEGIN 때의 창 선택 세대. 공대 캡처의 프레임 요청이 회차를 시작한 창인지 비교한다. */
  sourceGeneration: () => number
  /** 공대 캡처의 OCR 관측과 그 요청이 회차를 시작한 게임 창 선택에 아직 묶여 있는지 */
  isCurrentCaptureSource: (binding: CaptureBinding) => boolean
  isCurrentDocument: (generation: number) => boolean
  publish: (channel: ManualSearchChangedChannel, snapshot: SearchSnapshot) => void
}): {
  readonly current: CaptureBinding | null
  invalidate: () => void
  /** 게임 창이 바뀌거나 캡처를 멈추면 진행 중인 OCR에서 시작한 요청을 끝낸다. */
  cancelOcrRequests: () => void
  dispose: () => void
} {
  const slotCount = SEARCH_SLOT_COUNTS[kind]
  const { control: controlChannel, changed: changedChannel } = CHANNELS[kind]
  // The shared DTO calls its session ID captureId; this instance never grants media access.
  const lifetimeRuntime: SearchRuntime | undefined =
    kind === 'raid' && runtime !== undefined ? { ...runtime, ocrIdentification: 'raid' } : runtime
  const lifetime = createCaptureSearchLifetime({
    runtime: lifetimeRuntime,
    slotCount,
    isCurrent: (binding) => isCurrentDocument(binding.windowGeneration),
    isCurrentOcr: isCurrentCaptureSource,
    publish: (snapshot) => publish(changedChannel, snapshot)
  })

  addHandler(controlChannel, (event, ...args) => {
    requireSender(event)
    const control = parseSearchControl(args, slotCount)
    if (control == null) {
      return lifetime.result(SEARCH_COMMAND_ERRORS.INVALID_SEARCH_COMMAND)
    }
    switch (control.action) {
      case SEARCH_ACTIONS.READ:
        return lifetime.result()
      case SEARCH_ACTIONS.END:
        return lifetime.end(control.captureId)
      case SEARCH_ACTIONS.LOOKUP:
        return lifetime.lookup(control)
      case SEARCH_ACTIONS.CLEAR:
        return lifetime.clear(control)
      case SEARCH_ACTIONS.RETRY:
        return lifetime.retry(control)
      case SEARCH_ACTIONS.BEGIN:
        // An explicit new begin also recovers a session whose reply was lost.
        lifetime.invalidate()

        return lifetime.begin({
          windowGeneration: windowGeneration(),
          sourceGeneration: sourceGeneration()
        })
    }
  })

  if (kind === 'party') {
    addHandler('notifyManualNickname', (event, ...args) => {
      requireSender(event)
      const observation = parseSearchObservation(args)
      if (observation == null) {
        return lifetime.result(SEARCH_COMMAND_ERRORS.INVALID_SEARCH_COMMAND)
      }

      return lifetime.observe(observation)
    })
  }

  if (kind === 'raid') {
    addHandler('notifyRaidOcrCandidatesDetected', (event, ...args) => {
      requireSender(event)
      const observation = parseOcrSearchObservation(args, slotCount)
      if (observation === null) {
        return lifetime.result(SEARCH_COMMAND_ERRORS.INVALID_SEARCH_COMMAND)
      }

      return lifetime.observeOcr(observation)
    })
  }

  return {
    get current() {
      return lifetime.current
    },
    invalidate: () => lifetime.invalidate(),
    cancelOcrRequests: () => lifetime.cancelOcrRequests(),
    dispose: () => {
      lifetime.invalidate()
      ipcMain.removeHandler(controlChannel)
      if (kind === 'party') {
        ipcMain.removeHandler('notifyManualNickname')
      }

      if (kind === 'raid') {
        ipcMain.removeHandler('notifyRaidOcrCandidatesDetected')
      }
    }
  }
}
