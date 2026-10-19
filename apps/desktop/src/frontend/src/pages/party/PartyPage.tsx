import * as stylex from '@stylexjs/stylex'
import { cardFaces } from '../../constants/cards'
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
  nicknames,
  onDetail,
  onSlotDetail,
  slotNotices,
  onRetry,
  retryEnabled,
  retryPending,
  loadingSlots,
  collapsed = false,
  id,
  onLookup
}: {
  character?: CardCharacter
  characters?: readonly (CardCharacter | null)[]
  slots: SlotState[]
  resetKey?: string
  /** 합성 미리보기에서 카드마다 다른 면을 처음에 펼쳐 세 면을 나란히 비교한다. */
  compareFaces?: boolean
  inputEnabled?: boolean
  nicknames?: readonly (string | null)[]
  onDetail?: () => void
  onSlotDetail?: (slot: number) => void
  slotNotices?: readonly (string | undefined)[]
  onRetry?: (slot: number) => void
  retryEnabled?: readonly boolean[]
  retryPending?: readonly boolean[]
  loadingSlots?: readonly boolean[]
  collapsed?: boolean
  /** 파티 머리의 접기 버튼이 가리킬 카드 영역의 id */
  id?: string
  onLookup?: (slot: number, nickname: string, serverId: string) => void
}): React.JSX.Element {
  return (
    <section
      id={id}
      aria-label="파티 캐릭터"
      {...stylex.props(styles.grid, collapsed && styles.collapsed)}
    >
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
            initialFace={compareFaces ? index % cardFaces.length : 0}
            onDetail={detailAction}
            notice={slotNotices?.[index]}
            onRetry={onRetry == null ? undefined : () => onRetry(index)}
            retryEnabled={retryEnabled?.[index]}
            retryPending={retryPending?.[index]}
            loading={loadingSlots?.[index]}
            collapsed={collapsed}
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
