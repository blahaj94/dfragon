export const WINDOW_CHROME_CHANNELS = {
  setContentHeight: 'setWindowContentHeight'
} as const

export interface WindowChromeIPCFunctions {
  setWindowContentHeight: (height: number) => Promise<void>
}

export interface WindowChromeApi {
  /** 메인 창 내용 높이를 바꾼다. 파티 카드를 접고 펼칠 때 400과 800을 넘긴다. */
  setContentHeight: (height: number) => Promise<void>
}
