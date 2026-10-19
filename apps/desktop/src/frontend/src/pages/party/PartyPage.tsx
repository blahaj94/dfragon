import * as stylex from '@stylexjs/stylex'
import { cardFaces } from '../../constants/cards'
import { CharacterCard } from '../../sections/CharacterCard'
import type { SlotCard, SlotCardActions } from '../../lib/slot-cards'
import { styles } from './PartyPage.style'

export function PartyPage({
  id,
  slots,
  resetKey = 'party',
  compareFaces = false,
  inputEnabled = false,
  collapsed = false,
  actions = {}
}: {
  /** 파티 머리의 접기 버튼이 가리킬 카드 영역의 id */
  id?: string
  /** 슬롯마다 카드가 그릴 값 */
  slots: readonly SlotCard[]
  resetKey?: string
  /** 합성 미리보기에서 카드마다 다른 면을 처음에 펼쳐 세 면을 나란히 비교한다. */
  compareFaces?: boolean
  inputEnabled?: boolean
  collapsed?: boolean
  /** 슬롯 번호로 부르는 조회, 상세 열기, 다시 시도 */
  actions?: SlotCardActions
}): React.JSX.Element {
  const { lookupSlot, openDetails, retrySlot } = actions

  return (
    <section
      id={id}
      aria-label="파티 캐릭터"
      {...stylex.props(styles.grid, collapsed && styles.collapsed)}
    >
      {slots.map((card, index) => (
        <CharacterCard
          key={`${resetKey}-${index}`}
          card={card}
          slot={index + 1}
          inputEnabled={inputEnabled}
          initialFace={compareFaces ? index % cardFaces.length : 0}
          onDetail={openDetails === undefined ? undefined : () => openDetails(index)}
          onRetry={retrySlot === undefined ? undefined : () => retrySlot(index)}
          collapsed={collapsed}
          onLookup={
            lookupSlot === undefined
              ? undefined
              : (nickname, serverId) => lookupSlot(index, nickname, serverId)
          }
        />
      ))}
    </section>
  )
}
