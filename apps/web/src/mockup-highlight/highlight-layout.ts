export type Box = { top: number; left: number; width: number; height: number }

const RING_OFFSET = 5

function toBox(rect: DOMRect): Box {
  return {
    top: Math.round(rect.top),
    left: Math.round(rect.left),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  }
}

function intersect(a: Box, b: Box): Box | null {
  const left = Math.max(a.left, b.left)
  const top = Math.max(a.top, b.top)
  const right = Math.min(a.left + a.width, b.left + b.width)
  const bottom = Math.min(a.top + a.height, b.top + b.height)
  if (right <= left || bottom <= top) {
    return null
  }

  return { top, left, width: right - left, height: bottom - top }
}

function inflate(box: Box): Box {
  return {
    top: box.top - RING_OFFSET,
    left: box.left - RING_OFFSET,
    width: box.width + RING_OFFSET * 2,
    height: box.height + RING_OFFSET * 2
  }
}

export function measureRings(
  frame: HTMLElement,
  scroller: HTMLElement,
  targets: readonly (HTMLElement | null)[]
): (Box | null)[] {
  const frameBox = toBox(frame.getBoundingClientRect())
  const view = intersect(frameBox, toBox(scroller.getBoundingClientRect())) ?? frameBox

  return targets.map((target) => {
    if (target === null) {
      return null
    }
    const shown = intersect(toBox(target.getBoundingClientRect()), view)
    if (shown === null) {
      return null
    }

    return inflate(shown)
  })
}

export function sameRings(a: readonly (Box | null)[], b: readonly (Box | null)[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
