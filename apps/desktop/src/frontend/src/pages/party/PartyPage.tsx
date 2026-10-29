import * as stylex from '@stylexjs/stylex'
import { CharacterCard } from '../../sections/CharacterCard'
import type { SlotCard, SlotCardActions } from '../../lib/slot-cards'
import { styles } from './PartyPage.style'

export function PartyPage({
  slots,
  resetKey,
  actions
}: {
  slots: readonly SlotCard[]
  resetKey: string
  actions: SlotCardActions
}): React.JSX.Element {
  const { lookupSlot, pickCandidate } = actions

  function renderSlot(card: SlotCard, index: number): React.JSX.Element {
    const handleLookup = (nickname: string, serverId: string): void =>
      lookupSlot(index, nickname, serverId)
    const handlePickCandidate = (serverId: string): void => pickCandidate(index, serverId)

    return (
      <CharacterCard
        key={`${resetKey}-${index}`}
        cardKey={{ id: `party-${index}`, resetKey }}
        card={card}
        slot={index + 1}
        onLookup={handleLookup}
        onPickCandidate={handlePickCandidate}
      />
    )
  }

  return (
    <section aria-label="파티 캐릭터" {...stylex.props(styles.grid)}>
      {slots.map(renderSlot)}
    </section>
  )
}
