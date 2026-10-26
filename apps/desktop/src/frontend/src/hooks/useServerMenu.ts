import { type KeyboardEvent, useState } from 'react'

/**
 * 이름 칸 안 서버 선택의 열림 상태. 이름 칸에서 Tab을 누르면 서버 목록을 열어 방향키로 고르고 Enter로
 * 바로 조회하게 한다. 고른 서버로 조회하는 일은 `useLookupDraft`의 `changeServer`가 한다. 파티 카드와
 * 공대 카드가 같은 키 규칙을 쓴다.
 */
export function useServerMenu(): {
  open: boolean
  setOpen: (open: boolean) => void
  /** 이름 칸의 keydown에서 부른다. Shift+Tab과 한글 조합 중의 Tab은 그대로 둔다. */
  openOnTab: (event: KeyboardEvent<HTMLInputElement>) => void
} {
  const [open, setOpen] = useState(false)
  const openOnTab = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Tab' || event.shiftKey || event.nativeEvent.isComposing) {
      return
    }
    event.preventDefault()
    setOpen(true)
  }

  return { open, setOpen, openOnTab }
}
