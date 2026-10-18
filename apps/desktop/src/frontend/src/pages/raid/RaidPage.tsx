import { IconButton, Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { FoldIcon } from '../../components/FoldIcon'
import { RaidCard } from '../../components/RaidCard'
import { RAID_PARTY_COUNT, RAID_PARTY_SIZE } from '../../constants/cards'
import type { CardCharacter } from '../../types/cards'
import { styles } from './RaidPage.style'

const parties = Array.from({ length: RAID_PARTY_COUNT }, (_, party) =>
  Array.from({ length: RAID_PARTY_SIZE }, (_, member) => party * RAID_PARTY_SIZE + member)
)

/**
 * 공대 12인 화면. 네 명씩 세 파티를 한 줄에 한 파티로 놓는다. 파티 카드와 같은 접힘 상태를 써서 접은
 * 창에서는 카드가 한 줄씩으로 줄어든다. 공대 데이터와 캡처는 아직 연결하지 않아 화면이 넘긴 자리만
 * 그린다.
 */
export function RaidPage({
  characters,
  collapsed,
  onToggleCollapsed,
  id
}: {
  /** 1번부터 12번 자리의 공대원. 비어 있는 자리는 null이다. */
  characters: readonly (CardCharacter | null)[]
  collapsed: boolean
  onToggleCollapsed: () => void
  /** 접기 버튼이 가리킬 카드 영역의 id */
  id: string
}): React.JSX.Element {
  return (
    <section aria-label="공대" {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.header)}>
        <Typo.h4 as="h1" weight={700}>
          공대
        </Typo.h4>
        <IconButton
          aria-label={collapsed ? '카드 펼치기' : '카드 접기'}
          aria-expanded={!collapsed}
          aria-controls={id}
          onClick={onToggleCollapsed}
          icon={<FoldIcon collapsed={collapsed} />}
        />
      </div>
      <div id={id} {...stylex.props(styles.parties, collapsed && styles.partiesCollapsed)}>
        {parties.map((members, party) => (
          <div
            // 파티 순서는 바뀌지 않는 고정 목록이다.
            key={party}
            role="group"
            aria-label={`${party + 1}파티`}
            {...stylex.props(styles.party, collapsed && styles.partyCollapsed)}
          >
            {members.map((index) => (
              <RaidCard
                key={index}
                slot={index + 1}
                character={characters[index] ?? null}
                collapsed={collapsed}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
