import type { WindowChromeTheme } from '../window-chrome'

export const WINDOW_CHROME_CHANNELS = {
  setTheme: 'setWindowChromeTheme',
  setContentHeight: 'setWindowContentHeight'
} as const

export interface WindowChromeIPCFunctions {
  setWindowChromeTheme: (theme: WindowChromeTheme) => Promise<void>
  setWindowContentHeight: (height: number) => Promise<void>
}

export interface WindowChromeApi {
  setTheme: (theme: WindowChromeTheme) => Promise<void>
  /** 메인 창 내용 높이를 바꾼다. 파티 카드를 접고 펼칠 때 400과 800을 넘긴다. */
  setContentHeight: (height: number) => Promise<void>
}
