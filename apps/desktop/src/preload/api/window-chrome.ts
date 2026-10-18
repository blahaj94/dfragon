import { ipcRenderer } from 'electron'
import { isMainWindowContentHeight, isWindowChromeTheme } from '../common/window-chrome'
import { WINDOW_CHROME_CHANNELS, type WindowChromeApi } from '../common/types/window-chrome'

export const setTheme: WindowChromeApi['setTheme'] = async (theme) => {
  if (!isWindowChromeTheme(theme)) {
    throw new Error('INVALID_WINDOW_CHROME_COMMAND')
  }
  await ipcRenderer.invoke(WINDOW_CHROME_CHANNELS.setTheme, theme)
}

export const setContentHeight: WindowChromeApi['setContentHeight'] = async (height) => {
  if (!isMainWindowContentHeight(height)) {
    throw new Error('INVALID_WINDOW_CHROME_COMMAND')
  }
  await ipcRenderer.invoke(WINDOW_CHROME_CHANNELS.setContentHeight, height)
}
