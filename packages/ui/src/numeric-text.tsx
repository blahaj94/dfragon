import * as stylex from '@stylexjs/stylex'
import { useLayoutEffect, useRef, useState } from 'react'
import { parseDuration, parseEasing } from './count-up'
import { shapes } from './shapes'
import { styles } from './numeric-text.style'

const defaultFormatter = new Intl.NumberFormat('ko-KR')

export type NumericTextProps = {
  value: number
  /** 화면에 보일 글자. 기본은 한국어 천 단위 구분이다. */
  format?: (value: number) => string
  /** 처음 보일 때와 값이 바뀔 때 400ms 동안 올라간다. @default true */
  countUp?: boolean
}

// 숫자 글꼴의 tabular-nums 값. 올라가는 동안의 글자는 보조 기술에 숨기고 최종값만 읽힌다.
export function NumericText({
  value,
  format = (number) => defaultFormatter.format(number),
  countUp = true
}: NumericTextProps) {
  const element = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(countUp ? 0 : value)
  const current = useRef(shown)

  // 그리기 전에 시간을 읽어, 바로 최종값을 보일 때 0이 한 번 그려지지 않게 한다.
  useLayoutEffect(() => {
    const from = current.current
    const computed = element.current == null ? null : getComputedStyle(element.current)
    const duration = parseDuration(computed?.getPropertyValue('--df-dur-count') ?? '')
    const shouldAnimate = countUp && duration > 0 && from !== value
    if (!shouldAnimate) {
      current.current = value
      setShown(value)

      return
    }
    const ease = parseEasing(computed?.getPropertyValue('--df-ease') ?? '')
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const next = progress < 1 ? Math.round(from + (value - from) * ease(progress)) : value
      current.current = next
      setShown(next)
      if (progress < 1) {
        frame = requestAnimationFrame(step)
      }
    }
    frame = requestAnimationFrame(step)

    return () => cancelAnimationFrame(frame)
  }, [value, countUp])

  return (
    <span ref={element} {...stylex.props(styles.root)}>
      <span aria-hidden="true">{format(shown)}</span>
      <span {...stylex.props(shapes.srOnly)}>{format(value)}</span>
    </span>
  )
}
