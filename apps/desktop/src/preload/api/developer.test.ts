import { beforeEach, expect, it, vi } from 'vitest'
import * as developer from './developer'
import type { DeveloperPartyCollectionUpdate } from '../common/types/developer'

const renderer = await vi.hoisted(async () => {
  const { EventEmitter } = await import('node:events')
  const events = new EventEmitter()
  const invoke = vi.fn()
  const on = vi.fn(events.on.bind(events))
  const removeListener = vi.fn(events.removeListener.bind(events))

  return { invoke, on, removeListener, events }
})
vi.mock('electron', () => ({ ipcRenderer: renderer }))

beforeEach(() => {
  vi.clearAllMocks()
  renderer.events.removeAllListeners()
})

it('개발자 API는 허용된 작업을 전용 IPC 채널로 전달한다', async () => {
  expect(Object.keys(developer).sort()).toEqual([
    'addSample',
    'captureFrame',
    'closeOcrSamples',
    'getSettings',
    'listOcrSamples',
    'listSamples',
    'onPartyCollectionStatus',
    'previewParty',
    'readImage',
    'saveLabel',
    'setEnabled',
    'setPartyCollectionSlots',
    'setSampleExcluded'
  ])

  await developer.getSettings()
  await developer.setEnabled(true)
  await developer.listSamples()
  await developer.listOcrSamples()
  await developer.closeOcrSamples()
  await developer.readImage('00000000-0000-4000-8000-000000000001')
  await developer.addSample('data:image/png;base64,AA==')
  await developer.saveLabel('00000000-0000-4000-8000-000000000001', '')
  await developer.setSampleExcluded('00000000-0000-4000-8000-000000000001', true)
  await developer.captureFrame()
  await developer.previewParty()
  await developer.setPartyCollectionSlots([1, 4])

  expect(renderer.invoke.mock.calls).toEqual([
    ['developer:getSettings'],
    ['developer:setEnabled', true],
    ['developer:listSamples'],
    ['developer:listOcrSamples'],
    ['developer:closeOcrSamples'],
    ['developer:readImage', '00000000-0000-4000-8000-000000000001'],
    ['developer:addSample', 'data:image/png;base64,AA=='],
    ['developer:saveLabel', '00000000-0000-4000-8000-000000000001', ''],
    ['developer:setSampleExcluded', '00000000-0000-4000-8000-000000000001', true],
    ['developer:captureFrame'],
    ['developer:previewParty'],
    ['developer:setPartyCollectionSlots', [1, 4]]
  ])
})

it('수집 구독 해제는 해당 listener만 멈추고 IPC event 없이 남은 구독에 상태를 전달한다', () => {
  const first = vi.fn()
  const second = vi.fn()
  const unsubscribe = developer.onPartyCollectionStatus(first)
  const unsubscribeSecond = developer.onPartyCollectionStatus(second)
  const [[channel, wrapper], [, secondWrapper]] = renderer.on.mock.calls
  expect(channel).toBe('developer:partyCollectionStatus')
  const update: DeveloperPartyCollectionUpdate = {
    kind: 'hud',
    status: {
      armed: true,
      slots: [1, 4],
      revision: 1,
      lastSavedAt: null,
      error: null,
      upload: 'uploading'
    }
  }
  const rawEvent = { sender: 'private' }
  renderer.events.emit(channel, rawEvent, update)
  unsubscribe()
  const completed: DeveloperPartyCollectionUpdate = {
    ...update,
    status: {
      ...update.status,
      revision: 2,
      lastSavedAt: '2026-10-01T00:00:00.000Z',
      lastSavedCount: 2,
      upload: 'uploaded'
    }
  }
  renderer.events.emit(channel, rawEvent, completed)

  expect(first).toHaveBeenCalledExactlyOnceWith(update)
  expect(second.mock.calls).toEqual([[update], [completed]])
  expect(wrapper).not.toBe(secondWrapper)
  expect(renderer.removeListener).toHaveBeenCalledExactlyOnceWith(channel, wrapper)
  unsubscribeSecond()
  expect(renderer.events.listenerCount(channel)).toBe(0)
})

it('파티원창 종류를 명시해 전달하고 중지는 공통 수집 채널을 사용한다', async () => {
  await developer.previewParty('participants')
  await developer.setPartyCollectionSlots([3], 'participants')
  await developer.setPartyCollectionSlots(null)
  expect(renderer.invoke.mock.calls).toEqual([
    ['developer:previewParty', 'participants'],
    ['developer:setPartyCollectionSlots', [3], 'participants'],
    ['developer:setPartyCollectionSlots', null]
  ])
})

it('12개 공대원 위치의 수집은 같은 전용 채널을 사용한다', async () => {
  await developer.previewParty('raid')
  await developer.setPartyCollectionSlots([1, 10, 11, 12], 'raid')
  expect(renderer.invoke.mock.calls).toEqual([
    ['developer:previewParty', 'raid'],
    ['developer:setPartyCollectionSlots', [1, 10, 11, 12], 'raid']
  ])
})
