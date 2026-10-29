import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import type { CharacterTier } from '../types/cards'
import { styles } from './PortraitWell.style'

export function PortraitWell({
  tier,
  size,
  children
}: {
  tier: CharacterTier | undefined
  size: 'party' | 'raid'
  children: ReactNode
}): React.JSX.Element {
  return (
    <div
      {...stylex.props(
        shapes.gridWell,
        styles.well,
        size === 'party' ? styles.party : styles.raid,
        tier === 'top' && styles.top,
        tier === 'ranker' && styles.ranker
      )}
    >
      {children}
    </div>
  )
}
