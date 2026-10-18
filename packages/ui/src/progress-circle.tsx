import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, ComponentType } from 'react'
import { type ForwardedStyle, withForwardedStyle } from './public-props'
import { styles } from './progress-circle.style'

const RADIUS = 9
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
// 값이 없을 때 도는 호의 길이. 원의 4분의 1이다.
const INDETERMINATE_ARC = CIRCUMFERENCE / 4

export type ProgressCircleProps = Omit<
  ComponentPropsWithRef<'svg'>,
  'children' | 'className' | 'style' | 'color'
> & {
  /** 없으면 진행률을 모르는 대기 표시로 돈다. */
  value?: number
  minValue?: number
  maxValue?: number
  /** `inherit`는 글자 크기(1em)를 따른다. */
  size?: '24' | '40' | 'inherit'
  /** `inherit`는 글자색을 따른다. */
  tone?: 'neutral' | 'brand' | 'staticWhite' | 'inherit'
}

const sizeStyles = { '24': styles.size24, '40': styles.size40, inherit: styles.sizeInherit }

function ProgressCircleImpl({
  value,
  minValue = 0,
  maxValue = 100,
  size = '40',
  tone = 'neutral',
  className,
  style,
  ...svgProps
}: ProgressCircleProps & ForwardedStyle) {
  const isDeterminate = value != null
  let arc = INDETERMINATE_ARC
  if (isDeterminate) {
    const range = maxValue - minValue
    const ratio = range > 0 ? (value - minValue) / range : 0
    arc = CIRCUMFERENCE * Math.min(Math.max(ratio, 0), 1)
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role="progressbar"
      aria-valuemin={isDeterminate ? minValue : undefined}
      aria-valuemax={isDeterminate ? maxValue : undefined}
      aria-valuenow={isDeterminate ? value : undefined}
      {...svgProps}
      {...withForwardedStyle(
        stylex.props(
          styles.root,
          sizeStyles[size],
          styles[tone],
          !isDeterminate && styles.spinning
        ),
        { className, style }
      )}
    >
      {isDeterminate && (
        <circle cx="12" cy="12" r={RADIUS} strokeWidth="3" {...stylex.props(styles.track)} />
      )}
      <circle
        cx="12"
        cy="12"
        r={RADIUS}
        strokeWidth="3"
        strokeLinecap="square"
        strokeDasharray={`${arc} ${CIRCUMFERENCE}`}
        transform="rotate(-90 12 12)"
        {...stylex.props(styles.range)}
      />
      {!isDeterminate && (
        <circle
          cx="12"
          cy="12"
          r={RADIUS}
          strokeWidth="3"
          strokeLinecap="square"
          strokeDasharray={`${INDETERMINATE_ARC} ${CIRCUMFERENCE}`}
          transform="rotate(90 12 12)"
          {...stylex.props(styles.range)}
        />
      )}
    </svg>
  )
}

// 자체 SVG 진행 표시. 값이 있으면 track 위에 진행 호를, 없으면 마주 보는 두 호를 끊어 돌린다.
export const ProgressCircle: ComponentType<ProgressCircleProps> = ProgressCircleImpl
