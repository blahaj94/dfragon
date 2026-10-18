import { useEffect, useRef, useState } from 'react'
import type { WindowChromeApi } from '../../../preload/common/types/window-chrome'
import { MAIN_WINDOW_SIZE } from '../../../preload/common/window-chrome'

// 카드가 접히는 전환 시간이다. @dfragon/ui tokens.css의 --df-dur-state와 같은 값이며, 동작 줄이기
// 설정에서는 tokens.css가 전환을 0으로 두므로 창 높이도 기다리지 않고 바꾼다.
export const PARTY_COLLAPSE_TRANSITION_MS = 180
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function readBridge(): Pick<WindowChromeApi, 'setContentHeight'> | null {
  const candidate = typeof window === 'undefined' ? undefined : window.windowChrome

  if (candidate != null && typeof candidate.setContentHeight === 'function') {
    return candidate
  }

  return null
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/**
 * 파티와 공대 카드의 접힘 상태와 메인 창 높이를 함께 맞춘다. 접힘 상태는 두 화면이 함께 쓰고, 접은 창
 * 높이는 보이는 화면이 정한다(파티 400, 공대 560). 접을 때는 카드 전환이 끝난 뒤 창을 줄이고, 펼칠 때는
 * 카드가 펼쳐질 자리를 먼저 만들도록 창을 바로 800으로 늘린다. 접은 채 화면을 바꾸면 그 화면의 접은 높이로
 * 바로 맞추되, 접는 전환이 아직 끝나지 않았으면 남은 시간만큼 기다린다. 연달아 누르면 마지막 상태만 창에 반영한다.
 */
export function usePartyCollapse(collapsedHeight: number = MAIN_WINDOW_SIZE.collapsedHeight): {
  collapsed: boolean
  toggleCollapsed: () => void
} {
  const [collapsed, setCollapsed] = useState(false)
  const applied = useRef<{ collapsed: boolean; height: number }>({
    collapsed,
    height: MAIN_WINDOW_SIZE.height
  })
  // 접은 카드 전환이 끝나는 시각(performance.now). 전환 중에 화면을 바꿔 접은 높이가 달라져도 남은 시간만큼
  // 기다린다. 벽시계는 시스템 시각 조정에 따라 뒤로 갈 수 있어 단조 시계로 잰다.
  const transitionEndsAt = useRef<number | null>(null)

  useEffect(() => {
    const height = collapsed ? collapsedHeight : MAIN_WINDOW_SIZE.height
    if (applied.current.height === height) {
      return
    }
    const collapsing = collapsed && !applied.current.collapsed
    applied.current = { collapsed, height }
    if (collapsing && !prefersReducedMotion()) {
      transitionEndsAt.current = performance.now() + PARTY_COLLAPSE_TRANSITION_MS
    } else if (!collapsed) {
      transitionEndsAt.current = null
    }
    const bridge = readBridge()
    if (bridge == null) {
      return
    }
    const endsAt = transitionEndsAt.current
    const delay = endsAt === null ? 0 : Math.max(0, endsAt - performance.now())
    const timer = window.setTimeout(() => {
      void bridge.setContentHeight(height).catch(() => {
        // 창 높이를 바꾸지 못해도 카드 접기는 화면 안에서 유지한다. 다음 전환에서 다시 맞춘다.
      })
    }, delay)

    return () => window.clearTimeout(timer)
  }, [collapsed, collapsedHeight])
  const toggleCollapsed = (): void => setCollapsed((current) => !current)

  return { collapsed, toggleCollapsed }
}
