import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, ComponentType } from 'react'
import { type ForwardedStyle, withForwardedStyle } from './public-props'
import { styles } from './progress-circle.style'

const RADIUS = 9
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const INDETERMINATE_ARC = CIRCUMFERENCE / 4

export type ProgressCircleProps = Omit<
  ComponentPropsWithRef<'svg'>,
  'children' | 'className' | 'style' | 'color'
> & {
  value?: number
  minValue?: number
  maxValue?: number
  size?: '24' | '40' | 'inherit'
  tone?: 'neutral' | 'brand' | 'staticWhite' | 'inherit'
}

const sizeStyles = { '24': styles.size24, '40': styles.size40, inherit: styles.sizeInherit }

function determinateArc(value: number, minValue: number, maxValue: number) {
  const range = maxValue - minValue
  const ratio = range > 0 ? (value - minValue) / range : 0

  return CIRCUMFERENCE * Math.min(Math.max(ratio, 0), 1)
}

function arcLength(value: number | undefined, minValue: number, maxValue: number) {
  if (value == null) {
    return INDETERMINATE_ARC
  }

  return determinateArc(value, minValue, maxValue)
}

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
  const arc = arcLength(value, minValue, maxValue)
  const arcDasharray = `${arc} ${CIRCUMFERENCE}`
  const indeterminateDasharray = `${INDETERMINATE_ARC} ${CIRCUMFERENCE}`

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
        strokeDasharray={arcDasharray}
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
          strokeDasharray={indeterminateDasharray}
          transform="rotate(90 12 12)"
          {...stylex.props(styles.range)}
        />
      )}
    </svg>
  )
}

export const ProgressCircle: ComponentType<ProgressCircleProps> = ProgressCircleImpl
