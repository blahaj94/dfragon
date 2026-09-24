import { ipcRenderer } from 'electron'
import type { DeveloperApi } from '../common/types/developer'
import { DEVELOPER_CHANNELS } from '../common/developer-channels'

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

export const previewParty: DeveloperApi['previewParty'] = () =>
  ipcRenderer.invoke(DEVELOPER_CHANNELS.previewParty)

export const setPartyCollectionSlots: DeveloperApi['setPartyCollectionSlots'] = (slots) =>
  ipcRenderer.invoke(DEVELOPER_CHANNELS.setPartyCollectionSlots, slots)
