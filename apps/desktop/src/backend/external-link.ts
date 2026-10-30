import { shell } from 'electron'

// 화면은 새 창 요청(target="_blank")으로만 외부 주소를 열고, 여기 적은 주소만 기본 브라우저로 넘긴다.
const EXTERNAL_LINKS: ReadonlySet<string> = new Set(['https://developers.neople.co.kr/'])

export function openExternalLink(url: string): void {
  if (!URL.canParse(url) || !EXTERNAL_LINKS.has(new URL(url).href)) {
    return
  }
  shell.openExternal(url).catch(() => undefined)
}
