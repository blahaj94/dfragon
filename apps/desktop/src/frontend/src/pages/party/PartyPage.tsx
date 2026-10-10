import * as stylex from '@stylexjs/stylex'
import { CharacterCard } from '../../sections/CharacterCard'
import type { CardCharacter, SlotState } from '../../types/cards'
import { styles } from './PartyPage.style'

export function PartyPage({
  character,
  characters,
  slots,
  resetKey = 'party',
  compareFaces = false,
  inputEnabled = false,
  basicOnly = false,
  nicknames,
  onDetail,
  onSlotDetail,
  slotNotices,
  onRetry,
  retryEnabled,
  retryPending,
  loadingSlots,
  onLookup
}: {
  character?: CardCharacter
  characters?: readonly (CardCharacter | null)[]
  slots: SlotState[]
  resetKey?: string
  compareFaces?: boolean
  inputEnabled?: boolean
  basicOnly?: boolean
  nicknames?: readonly (string | null)[]
  onDetail?: () => void
  onSlotDetail?: (slot: number) => void
  slotNotices?: readonly (string | undefined)[]
  onRetry?: (slot: number) => void
  retryEnabled?: readonly boolean[]
  retryPending?: readonly boolean[]
  loadingSlots?: readonly boolean[]
  onLookup?: (slot: number, nickname: string, serverId: string) => void
}): React.JSX.Element {
  return (
    <section aria-label="파티 캐릭터" {...stylex.props(styles.grid)}>
      {slots.map((state, index) => {
        const selected = characters == null ? character : (characters[index] ?? undefined)
        const observedNickname = nicknames?.[index] ?? undefined
        const displayedNickname =
          state === 'success' && selected != null ? undefined : observedNickname
        let detailAction = onDetail
        if (onSlotDetail !== undefined) {
          detailAction =
            state === 'success' && selected != null ? () => onSlotDetail(index) : undefined
        }

        return (
          <CharacterCard
            key={`${resetKey}-${index}`}
            slot={index + 1}
            character={selected}
            state={state}
            nickname={displayedNickname}
            inputEnabled={inputEnabled}
            basicOnly={basicOnly}
            initialFace={compareFaces ? index : 0}
            onDetail={detailAction}
            notice={slotNotices?.[index]}
            onRetry={onRetry == null ? undefined : () => onRetry(index)}
            retryEnabled={retryEnabled?.[index]}
            retryPending={retryPending?.[index]}
            loading={loadingSlots?.[index]}
            onLookup={
              onLookup === undefined
                ? undefined
                : (nickname, serverId) => onLookup(index, nickname, serverId)
            }
          />
        )
      })}
    </section>
  )
}
