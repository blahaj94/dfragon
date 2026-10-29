import { ipcRenderer } from 'electron'
import { WINDOW_CHROME_CHANNELS, type WindowChromeApi } from '../common/types/window-chrome'

export const setContentHeight: WindowChromeApi['setContentHeight'] = async (height) => {
  await ipcRenderer.invoke(WINDOW_CHROME_CHANNELS.setContentHeight, height)
}
