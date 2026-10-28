export const WINDOW_CHROME_CHANNELS = {
  setContentHeight: 'setWindowContentHeight'
} as const

export interface WindowChromeIPCFunctions {
  setWindowContentHeight: (height: number) => Promise<void>
}

export interface WindowChromeApi {
  setContentHeight: (height: number) => Promise<void>
}
