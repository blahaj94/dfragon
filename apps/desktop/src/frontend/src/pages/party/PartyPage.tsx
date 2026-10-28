import * as stylex from '@stylexjs/stylex'
import { CharacterCard } from '../../sections/CharacterCard'
import type { SlotCard, SlotCardActions } from '../../lib/slot-cards'
import { styles } from './PartyPage.style'

export function PartyPage({
  slots,
  resetKey = 'party',
  inputEnabled = false,
  actions = {}
}: {
  slots: readonly SlotCard[]
  resetKey?: string
  inputEnabled?: boolean
  actions?: SlotCardActions
}): React.JSX.Element {
  const { lookupSlot, retrySlot, pickCandidate } = actions

  return (
    <section aria-label="파티 캐릭터" {...stylex.props(styles.grid)}>
      {slots.map((card, index) => (
        <CharacterCard
          key={`${resetKey}-${index}`}
          card={card}
          slot={index + 1}
          inputEnabled={inputEnabled}
          onRetry={retrySlot === undefined ? undefined : () => retrySlot(index)}
          onLookup={
            lookupSlot === undefined
              ? undefined
              : (nickname, serverId) => lookupSlot(index, nickname, serverId)
          }
          onPickCandidate={
            pickCandidate === undefined ? undefined : (serverId) => pickCandidate(index, serverId)
          }
        />
      ))}
    </section>
  )
}
