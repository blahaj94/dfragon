import * as stylex from '@stylexjs/stylex'
import { useEffect, useEffectEvent, useState } from 'react'
import { createPortal } from 'react-dom'
import { type Box, measureRings, sameRings } from './highlight-layout'
import { HIGHLIGHT_TARGETS } from './highlight-targets'
import { styles } from './MockupHighlights.style'
import { type GhostCursor, useGhostDemo } from './useGhostDemo'

const POINTER_PATH = 'M4 2.5v17l4.6-4.3 2.9 6.6 2.8-1.2-2.9-6.6 6.3-.2z'

function useEveryFrame(onFrame: () => void): void {
  const frame = useEffectEvent(onFrame)

  useEffect(() => {
    let id = window.requestAnimationFrame(function tick() {
      frame()
      id = window.requestAnimationFrame(tick)
    })

    return () => window.cancelAnimationFrame(id)
  }, [])
}

export function MockupHighlights({
  root,
  scroller
}: {
  root: HTMLElement
  scroller: HTMLElement
}): React.JSX.Element {
  const [rings, setRings] = useState<(Box | null)[]>([])
  const [demoRunning, setDemoRunning] = useState(true)
  const cursor = useGhostDemo(root, scroller, demoRunning, () => setDemoRunning(false))

  useEveryFrame(() => {
    const targets = HIGHLIGHT_TARGETS.map((find) => find(root))
    const next = measureRings(root, scroller, targets)
    setRings((current) => {
      if (sameRings(current, next)) {
        return current
      }

      return next
    })
  })

  return createPortal(
    <div {...stylex.props(styles.layer)}>
      {rings.map(
        (ring, index) =>
          ring !== null && (
            <div
              // 대상 순서가 고정이라 위치가 바뀌어도 같은 링을 옮겨 깜박임 애니메이션이 처음부터 다시 돌지 않는다.
              key={index}
              aria-hidden="true"
              {...stylex.props(
                styles.ring,
                styles.box(ring.top, ring.left, ring.width, ring.height)
              )}
            />
          )
      )}
      {cursor !== null && <Cursor cursor={cursor} />}
    </div>,
    document.body
  )
}

function Cursor({ cursor }: { cursor: GhostCursor }): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      {...stylex.props(
        styles.cursor,
        styles.cursorAt(cursor.x, cursor.y, cursor.moveMs, cursor.shown)
      )}
    >
      {cursor.pressed && <span {...stylex.props(styles.ripple)} />}
      <svg
        width={32}
        height={32}
        viewBox="0 0 24 24"
        {...stylex.props(styles.cursorIcon, cursor.pressed && styles.cursorPressed)}
      >
        <path
          d={POINTER_PATH}
          fill="#FFFFFF"
          stroke="#0F1A24"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
