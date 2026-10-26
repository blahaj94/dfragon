import * as stylex from '@stylexjs/stylex'
import { CharacterCard } from '../../sections/CharacterCard'
import type { SlotCard, SlotCardActions } from '../../lib/slot-cards'
import { styles } from './PartyPage.style'

export function PartyPage({
  id,
  slots,
  resetKey = 'party',
  inputEnabled = false,
  collapsed = false,
  actions = {}
}: {
  /** 파티 머리의 접기 버튼이 가리킬 카드 영역의 id */
  id?: string
  /** 슬롯마다 카드가 그릴 값 */
  slots: readonly SlotCard[]
  resetKey?: string
  inputEnabled?: boolean
  collapsed?: boolean
  /** 슬롯 번호로 부르는 조회, 다시 시도, 후보 고르기 */
  actions?: SlotCardActions
}): React.JSX.Element {
  const { lookupSlot, retrySlot, pickCandidate } = actions

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
          onRetry={retrySlot === undefined ? undefined : () => retrySlot(index)}
          collapsed={collapsed}
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
