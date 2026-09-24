import { beforeEach, expect, it, vi } from 'vitest'
import * as developer from './developer'

const renderer = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('electron', () => ({ ipcRenderer: renderer }))

beforeEach(() => vi.clearAllMocks())

it('exposes only typed developer operations through namespaced IPC channels', async () => {
  expect(Object.keys(developer).sort()).toEqual([
    'addSample',
    'captureFrame',
    'getSettings',
    'listSamples',
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
    ['developer:readImage', '00000000-0000-4000-8000-000000000001'],
    ['developer:addSample', 'data:image/png;base64,AA=='],
    ['developer:saveLabel', '00000000-0000-4000-8000-000000000001', ''],
    ['developer:setSampleExcluded', '00000000-0000-4000-8000-000000000001', true],
    ['developer:captureFrame'],
    ['developer:previewParty'],
    ['developer:setPartyCollectionSlots', [1, 4]]
  ])
})

it('forwards the participant mode explicitly while keeping stop on the shared channel', async () => {
  await developer.previewParty('participants')
  await developer.setPartyCollectionSlots([3], 'participants')
  await developer.setPartyCollectionSlots(null)
  expect(renderer.invoke.mock.calls).toEqual([
    ['developer:previewParty', 'participants'],
    ['developer:setPartyCollectionSlots', [3], 'participants'],
    ['developer:setPartyCollectionSlots', null]
  ])
})
