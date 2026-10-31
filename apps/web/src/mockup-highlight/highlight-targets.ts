// 목업은 Desktop 컴포넌트를 그대로 쓰므로 강조할 버튼을 Desktop의 접근성 이름으로 찾는다. 이름이 바뀌면
// MockupHighlights.test.tsx가 실패한다.

const SEARCH_MENU_BUTTON = 'nav[aria-label="주 메뉴"] button'
const SNAPSHOT_BUTTON = 'button[aria-label$="모험단 순번 스냅샷"]'
const COPY_BUTTON = 'button[aria-label="클립보드로 복사"]'
const CAPTURE_BUTTON = 'button[aria-label$="캡처, 단축키 Alt R"]'

export function findCaptureButton(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>(CAPTURE_BUTTON)
}

export const HIGHLIGHT_TARGETS: readonly ((root: HTMLElement) => HTMLElement | null)[] = [
  (root) => root.querySelector<HTMLElement>(SEARCH_MENU_BUTTON),
  (root) => root.querySelector<HTMLElement>(SNAPSHOT_BUTTON),
  (root) => root.querySelector<HTMLElement>(COPY_BUTTON),
  findCaptureButton
]
