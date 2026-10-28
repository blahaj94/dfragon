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

  function renderSlot(card: SlotCard, index: number): React.JSX.Element {
    const handleRetry = retrySlot != null ? () => retrySlot(index) : undefined
    const handleLookup =
      lookupSlot != null
        ? (nickname: string, serverId: string) => lookupSlot(index, nickname, serverId)
        : undefined
    const handlePickCandidate =
      pickCandidate != null ? (serverId: string) => pickCandidate(index, serverId) : undefined

    return (
      <CharacterCard
        key={`${resetKey}-${index}`}
        cardKey={{ id: `party-${index}`, resetKey }}
        card={card}
        slot={index + 1}
        inputEnabled={inputEnabled}
        onRetry={handleRetry}
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
