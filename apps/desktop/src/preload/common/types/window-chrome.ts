import type { WindowChromeTheme } from '../window-chrome'

export const WINDOW_CHROME_CHANNELS = { setTheme: 'setWindowChromeTheme' } as const

export interface WindowChromeIPCFunctions {
  setWindowChromeTheme: (theme: WindowChromeTheme) => Promise<void>
}

export interface WindowChromeApi {
  setTheme: (theme: WindowChromeTheme) => Promise<void>
}
