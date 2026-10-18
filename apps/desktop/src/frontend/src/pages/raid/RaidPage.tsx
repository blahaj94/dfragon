import { IconButton, Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { FoldIcon } from '../../components/FoldIcon'
import { RAID_PARTY_COUNT, RAID_PARTY_SIZE } from '../../constants/cards'
import { CharacterCard } from '../../sections/CharacterCard'
import type { CardCharacter, SlotState } from '../../types/cards'
import { styles } from './RaidPage.style'

const parties = Array.from({ length: RAID_PARTY_COUNT }, (_, party) =>
  Array.from({ length: RAID_PARTY_SIZE }, (_, member) => party * RAID_PARTY_SIZE + member)
)

/**
 * 공대 12인 화면. 파티 화면과 같은 캐릭터 카드를 네 장씩 세 파티로 쌓고, 머리는 고정한 채 카드 영역만
 * 세로로 스크롤한다. 한 파티 줄의 카드는 파티 화면과 같은 크기다. 접힘은 파티와 같은 상태를 쓴다.
 */
export function RaidPage({
  id,
  hidden = false,
  status,
  slots,
  characters,
  basicOnly = false,
  slotNotices,
  collapsed,
  onToggleCollapsed,
  onLookup,
  onSlotDetail
}: {
  /** 접기 버튼이 가리킬 카드 영역의 id */
  id: string
  /** 파티를 보는 동안에도 자리별 입력과 검색 상태를 지키려고 그린 채 숨긴다. */
  hidden?: boolean
  /** 머리의 안내. 검색 연결 실패나 상세 창 열기 실패를 알린다. */
  status: string
  /** 1번부터 12번 자리의 검색 상태 */
  slots: readonly SlotState[]
  /** 1번부터 12번 자리의 캐릭터. 조회하지 않았거나 찾지 못한 자리는 null이다. */
  characters: readonly (CardCharacter | null)[]
  basicOnly?: boolean
  slotNotices?: readonly (string | undefined)[]
  collapsed: boolean
  onToggleCollapsed: () => void
  onLookup?: (slot: number, nickname: string, serverId: string) => void
  onSlotDetail?: (slot: number) => void
}): React.JSX.Element {
  return (
    <section aria-label="공대" hidden={hidden} {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.title)}>
          <Typo.h4 as="h1" weight={700}>
            공대
          </Typo.h4>
          <Typo.caption role="status" {...stylex.props(styles.status)}>
            {status}
          </Typo.caption>
        </div>
        <IconButton
          aria-label={collapsed ? '카드 펼치기' : '카드 접기'}
          aria-expanded={!collapsed}
          aria-controls={id}
          onClick={onToggleCollapsed}
          icon={<FoldIcon collapsed={collapsed} />}
        />
      </div>
      <div id={id} {...stylex.props(styles.parties)}>
        {parties.map((members, party) => (
          <div
            // 파티 순서는 바뀌지 않는 고정 목록이다.
            key={party}
            role="group"
            aria-label={`${party + 1}파티`}
            {...stylex.props(styles.party, collapsed && styles.partyCollapsed)}
          >
            {members.map((index) => {
              const state = slots[index]
              const character = characters[index] ?? undefined
              const found = state === 'success' && character != null

              return (
                <CharacterCard
                  key={index}
                  slot={index + 1}
                  character={character}
                  state={state}
                  inputEnabled
                  basicOnly={basicOnly}
                  collapsed={collapsed}
                  notice={slotNotices?.[index]}
                  onDetail={
                    found && onSlotDetail !== undefined ? () => onSlotDetail(index) : undefined
                  }
                  onLookup={
                    onLookup === undefined
                      ? undefined
                      : (nickname, serverId) => onLookup(index, nickname, serverId)
                  }
                />
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
