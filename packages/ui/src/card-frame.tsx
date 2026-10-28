import * as stylex from '@stylexjs/stylex'
import { createElement, type ComponentType, type HTMLAttributes, type Ref } from 'react'
import { CornerBrackets, type CornerBracketsTone } from './corner-brackets'
import { type ForwardedStyle, withForwardedStyle } from './public-props'
import { shapes } from './shapes'
import { styles } from './card-frame.style'

export type CardFrameState = 'default' | 'selected' | 'failure' | 'waiting' | 'top' | 'ranker'

export type CardFrameProps = Omit<HTMLAttributes<HTMLElement>, 'className' | 'style'> & {
  state?: CardFrameState
  as?: 'div' | 'article' | 'section' | 'li'
  ref?: Ref<HTMLElement>
}

const bracketTones: Record<Exclude<CardFrameState, 'waiting'>, CornerBracketsTone> = {
  default: 'default',
  selected: 'selected',
  failure: 'failure',
  top: 'top',
  ranker: 'ranker'
}

function TopEffects() {
  return (
    <span aria-hidden="true" {...stylex.props(styles.effects)}>
      <span {...stylex.props(styles.sweep, styles.sweepTop)} />
    </span>
  )
}

function RankerEffects() {
  return (
    <span aria-hidden="true" {...stylex.props(styles.effects, shapes.scanlines)}>
      <span {...stylex.props(styles.sweep, styles.sweepRanker)} />
    </span>
  )
}

function StateEffects({ state }: { state: CardFrameState }) {
  if (state === 'top') {
    return <TopEffects />
  }

  if (state === 'ranker') {
    return <RankerEffects />
  }

  return null
}

function StateBrackets({ state }: { state: CardFrameState }) {
  if (state === 'waiting') {
    return null
  }

  return <CornerBrackets tone={bracketTones[state]} />
}

function CardFrameImpl({
  state = 'default',
  as = 'div',
  children,
  className,
  style,
  ...props
}: CardFrameProps & ForwardedStyle) {
  const isWaiting = state === 'waiting'
  const isRanker = state === 'ranker'

  return createElement(
    as,
    {
      'data-state': state,
      ...props,
      ...withForwardedStyle(
        stylex.props(styles.root, isWaiting && styles.waiting, isRanker && styles.ranker),
        { className, style }
      )
    },
    children,
    <StateEffects state={state} />,
    <StateBrackets state={state} />
  )
}

export const CardFrame: ComponentType<CardFrameProps> = CardFrameImpl
