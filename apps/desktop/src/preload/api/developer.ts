import { ipcRenderer } from 'electron'
import type { DeveloperApi, DeveloperPartyCollectionUpdate } from '../common/types/developer'
import { DEVELOPER_CHANNELS } from '../common/developer-channels'

export const onPartyCollectionStatus: DeveloperApi['onPartyCollectionStatus'] = (listener) => {
  const wrapper = (
    _event: Electron.IpcRendererEvent,
    update: DeveloperPartyCollectionUpdate
  ): void => listener(update)
  ipcRenderer.on(DEVELOPER_CHANNELS.onPartyCollectionStatus, wrapper)

  return () => ipcRenderer.removeListener(DEVELOPER_CHANNELS.onPartyCollectionStatus, wrapper)
}

export const getSettings: DeveloperApi['getSettings'] = () =>
  ipcRenderer.invoke(DEVELOPER_CHANNELS.getSettings)

export const setEnabled: DeveloperApi['setEnabled'] = (enabled) =>
  ipcRenderer.invoke(DEVELOPER_CHANNELS.setEnabled, enabled)

export const listSamples: DeveloperApi['listSamples'] = () =>
  ipcRenderer.invoke(DEVELOPER_CHANNELS.listSamples)

export const readImage: DeveloperApi['readImage'] = (id) =>
  ipcRenderer.invoke(DEVELOPER_CHANNELS.readImage, id)

export const addSample: DeveloperApi['addSample'] = (pngDataUrl) =>
  ipcRenderer.invoke(DEVELOPER_CHANNELS.addSample, pngDataUrl)

export const saveLabel: DeveloperApi['saveLabel'] = (id, text) =>
  ipcRenderer.invoke(DEVELOPER_CHANNELS.saveLabel, id, text)

export const setSampleExcluded: DeveloperApi['setSampleExcluded'] = (id, excluded) =>
  ipcRenderer.invoke(DEVELOPER_CHANNELS.setSampleExcluded, id, excluded)

export const captureFrame: DeveloperApi['captureFrame'] = () =>
  ipcRenderer.invoke(DEVELOPER_CHANNELS.captureFrame)

export const previewParty: DeveloperApi['previewParty'] = (kind) => {
  if (kind == null) {
    return ipcRenderer.invoke(DEVELOPER_CHANNELS.previewParty)
  }

  return ipcRenderer.invoke(DEVELOPER_CHANNELS.previewParty, kind)
}

export const setPartyCollectionSlots: DeveloperApi['setPartyCollectionSlots'] = (slots, kind) => {
  if (kind == null) {
    return ipcRenderer.invoke(DEVELOPER_CHANNELS.setPartyCollectionSlots, slots)
  }

  return ipcRenderer.invoke(DEVELOPER_CHANNELS.setPartyCollectionSlots, slots, kind)
}

export const listOcrSamples: DeveloperApi['listOcrSamples'] = () =>
  ipcRenderer.invoke(DEVELOPER_CHANNELS.listOcrSamples)

export const closeOcrSamples: DeveloperApi['closeOcrSamples'] = () =>
  ipcRenderer.invoke(DEVELOPER_CHANNELS.closeOcrSamples)
