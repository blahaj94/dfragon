import * as stylex from '@stylexjs/stylex'
import { createElement, type ComponentType, type HTMLAttributes, type Ref } from 'react'
import { CornerBrackets, type CornerBracketsTone } from './corner-brackets'
import { type ForwardedStyle, withForwardedStyle } from './public-props'
import { styles } from './card-frame.style'

export type CardFrameState = 'default' | 'selected' | 'failure' | 'waiting' | 'top' | 'ranker'

export type CardFrameProps = Omit<HTMLAttributes<HTMLElement>, 'className' | 'style'> & {
  /** @default 'default' */
  state?: CardFrameState
  /** @default 'div' */
  as?: 'div' | 'article' | 'section' | 'li'
  ref?: Ref<HTMLElement>
}

const bracketTones: Record<Exclude<CardFrameState, 'waiting'>, CornerBracketsTone> = {
  default: 'default',
  selected: 'selected',
  failure: 'danger',
  top: 'top',
  ranker: 'ranker'
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

  return createElement(
    as,
    {
      'data-state': state,
      ...props,
      ...withForwardedStyle(
        stylex.props(styles.root, isWaiting && styles.waiting, state === 'ranker' && styles.ranker),
        { className, style }
      )
    },
    children,
    !isWaiting && <CornerBrackets tone={bracketTones[state]} />
  )
}

// 카드 면과 상태 꺾쇠. 상태 색은 꺾쇠로만 보이고 테두리 전체를 칠하지 않는다.
// 실패의 사선은 카드 면이 아니라 그림 칸에만 깔므로 화면이 그림 칸에 shapes.hazardStripes를 합성한다.
export const CardFrame: ComponentType<CardFrameProps> = CardFrameImpl
