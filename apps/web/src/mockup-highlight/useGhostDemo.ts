import { useEffect, useEffectEvent, useState } from 'react'
import { findCaptureButton } from './highlight-targets'

export type GhostCursor = { x: number; y: number; moveMs: number; pressed: boolean; shown: boolean }

// 목업의 첫 자동 캡처는 마운트 1초 뒤에 시작한다. 그 전에 누른 캡처가 자동 캡처를 대신하므로, 가짜 커서가
// 누르는 장면과 카드가 채워지는 장면이 이어진다.
const APPEAR_AT = 150
const MOVE_TO_CAPTURE_AT = 250
const CLICK_AT = 850
const RELEASE_AT = 1050
const HIDE_AT = 1600
const END_AT = 1900
const MOVE_MS = 600

function centerOf(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect()

  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

function isOnScreen(element: HTMLElement, scroller: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  const visible = scroller.getBoundingClientRect()

  return (
    rect.width > 0 &&
    rect.left >= visible.left &&
    rect.right <= visible.right &&
    rect.top >= 0 &&
    rect.bottom <= window.innerHeight
  )
}

export function useGhostDemo(
  root: HTMLElement,
  scroller: HTMLElement,
  active: boolean,
  onEnd: () => void
): GhostCursor | null {
  const [cursor, setCursor] = useState<GhostCursor | null>(null)
  const end = useEffectEvent(onEnd)

  useEffect(() => {
    if (!active) {
      return
    }
    const timers: number[] = []
    const at = (ms: number, action: () => void): void => {
      timers.push(window.setTimeout(action, ms))
    }
    const stop = (): void => end()
    const updateCursor = (change: (current: GhostCursor) => GhostCursor): void => {
      setCursor((current) => {
        if (current === null) {
          return null
        }

        return change(current)
      })
    }
    const moveToCapture = (): void => {
      const capture = findCaptureButton(root)
      if (capture === null) {
        return
      }
      updateCursor((current) => ({ ...current, ...centerOf(capture), moveMs: MOVE_MS }))
    }

    at(APPEAR_AT, () => {
      const capture = findCaptureButton(root)
      if (
        capture === null ||
        !isOnScreen(capture, scroller) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        end()

        return
      }
      const frame = root.getBoundingClientRect()
      setCursor({
        x: frame.left + frame.width * 0.45,
        y: frame.bottom - 12,
        moveMs: 0,
        pressed: false,
        shown: true
      })
    })
    at(MOVE_TO_CAPTURE_AT, moveToCapture)
    at(CLICK_AT, () => {
      updateCursor((current) => ({ ...current, pressed: true }))
      findCaptureButton(root)?.click()
    })
    at(RELEASE_AT, () => updateCursor((current) => ({ ...current, pressed: false })))
    at(HIDE_AT, () => updateCursor((current) => ({ ...current, shown: false })))
    at(END_AT, stop)
    // 방문자가 먼저 목업을 만지면 시연을 멈춘다. 가짜 커서의 click()은 pointerdown을
    // 만들지 않으므로 시연이 스스로를 멈추지 않는다.
    root.addEventListener('pointerdown', stop)
    root.addEventListener('keydown', stop)

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer)
      }
      root.removeEventListener('pointerdown', stop)
      root.removeEventListener('keydown', stop)
    }
  }, [active, root, scroller])

  if (!active) {
    return null
  }

  return cursor
}
