import {
  SEARCH_ACTIONS,
  SEARCH_COMMAND_ERRORS,
  SEARCH_SLOT_COUNTS
} from '../../preload/common/types/search'
import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { addHandler } from '../ipc'
import {
  createCaptureSearchLifetime,
  type CaptureBinding,
  type CaptureSearchLifetime
} from './capture-lifetime'
import { parseOcrSearchObservation, parseSearchControl, parseSearchObservation } from './commands'
import type { SearchRuntime } from './request'
import type { SearchSnapshot } from '../../preload/common/types/search'

/** 파티 카드의 네 자리 조회와 공대 카드의 12자리 조회는 서로 다른 수명과 채널을 쓴다. */
export type ManualSearchKind = keyof typeof SEARCH_SLOT_COUNTS

// 수명마다 제어 채널과 변경 알림 채널을 함께 정해 한 곳에서만 대응시킨다.
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
  isCurrentDocument,
  publish
}: {
  kind: ManualSearchKind
  runtime?: SearchRuntime
  requireSender: (event: IpcMainInvokeEvent) => void
  windowGeneration: () => number
  /** BEGIN 때의 창 선택 세대. 공대 캡처의 프레임 요청이 회차를 시작한 창인지 비교한다. */
  sourceGeneration: () => number
  isCurrentDocument: (generation: number) => boolean
  publish: (channel: ManualSearchChangedChannel, snapshot: SearchSnapshot) => void
}): {
  /** 현재 수명의 결합. 조회만 하는 수명이면 창 선택 세대는 프레임 읽기에 쓰이지 않는다. */
  readonly current: CaptureBinding | null
  invalidate: () => void
  dispose: () => void
  selection: CaptureSearchLifetime['selection']
} {
  const slotCount = SEARCH_SLOT_COUNTS[kind]
  const { control: controlChannel, changed: changedChannel } = CHANNELS[kind]
  // The shared DTO calls its session ID captureId; this instance never grants media access.
  // 공대 캡처의 OCR 이름은 얼굴 비교 대신 공대 후보 선택 함수로 식별한다.
  const lifetimeRuntime: SearchRuntime | undefined =
    kind === 'raid' && runtime !== undefined ? { ...runtime, ocrIdentification: 'raid' } : runtime
  const lifetime = createCaptureSearchLifetime({
    runtime: lifetimeRuntime,
    slotCount,
    isCurrent: (binding) => isCurrentDocument(binding.windowGeneration),
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

  // 공대 카드는 서버를 함께 고른 조회만 쓰므로 서버 없는 이름 통지는 파티 수명에만 연다.
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

  // 공대 캡처의 OCR 관측은 서버 없이 이름으로 식별하므로 공대 수명에만 연다. 파티 캡처는 캡처 수명의 채널을 쓴다.
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
    selection: lifetime.selection,
    invalidate: () => lifetime.invalidate(),
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
