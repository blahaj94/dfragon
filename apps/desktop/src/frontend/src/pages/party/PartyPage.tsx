import * as stylex from '@stylexjs/stylex'
import { cardFaces } from '../../constants/cards'
import { CharacterCard } from '../../sections/CharacterCard'
import type { SlotCard } from '../../lib/slot-cards'
import { styles } from './PartyPage.style'

export function PartyPage({
  slots,
  resetKey = 'party',
  compareFaces = false,
  inputEnabled = false,
  onDetail,
  onSlotDetail,
  onRetry,
  collapsed = false,
  id,
  onLookup
}: {
  /** 슬롯마다 카드가 그릴 값 */
  slots: readonly SlotCard[]
  resetKey?: string
  /** 합성 미리보기에서 카드마다 다른 면을 처음에 펼쳐 세 면을 나란히 비교한다. */
  compareFaces?: boolean
  inputEnabled?: boolean
  onDetail?: () => void
  onSlotDetail?: (slot: number) => void
  onRetry?: (slot: number) => void
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
      {slots.map((card, index) => {
        const found = card.state === 'success' && card.character != null
        let detailAction = onDetail
        if (onSlotDetail !== undefined) {
          detailAction = found ? () => onSlotDetail(index) : undefined
        }

        return (
          <CharacterCard
            key={`${resetKey}-${index}`}
            card={card}
            slot={index + 1}
            inputEnabled={inputEnabled}
            initialFace={compareFaces ? index % cardFaces.length : 0}
            onDetail={detailAction}
            onRetry={onRetry == null ? undefined : () => onRetry(index)}
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
