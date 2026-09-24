import type { DeveloperApi } from './types/developer'

export const DEVELOPER_CHANNELS = {
  getSettings: 'developer:getSettings',
  setEnabled: 'developer:setEnabled',
  listSamples: 'developer:listSamples',
  readImage: 'developer:readImage',
  addSample: 'developer:addSample',
  saveLabel: 'developer:saveLabel',
  setSampleExcluded: 'developer:setSampleExcluded',
  captureFrame: 'developer:captureFrame',
  previewParty: 'developer:previewParty',
  setPartyCollectionSlots: 'developer:setPartyCollectionSlots'
} as const satisfies Record<keyof DeveloperApi, string>
