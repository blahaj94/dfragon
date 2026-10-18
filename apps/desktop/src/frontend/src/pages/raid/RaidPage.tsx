import { IconButton, Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { CaptureButton } from '../../components/CaptureButton'
import { FoldIcon } from '../../components/FoldIcon'
import { LastCaptureTime } from '../../components/LastCaptureTime'
import { RAID_PARTY_COUNT, RAID_PARTY_SIZE } from '../../constants/cards'
import { CharacterCard } from '../../sections/CharacterCard'
import type { CardCharacter, SlotState } from '../../types/cards'
import { styles } from './RaidPage.style'

const parties = Array.from({ length: RAID_PARTY_COUNT }, (_, party) =>
  Array.from({ length: RAID_PARTY_SIZE }, (_, member) => party * RAID_PARTY_SIZE + member)
)

/**
 * 공대 12인 화면. 파티 화면과 같은 캐릭터 카드를 네 장씩 세 파티로 쌓고, 머리는 고정한 채 카드 영역만
 * 스크롤한다. 카드는 창 크기와 상관없이 기준 창 1280×800의 파티 카드 크기로 고정이라 창이 작으면 카드
 * 영역이 가로와 세로로 스크롤한다. 접힘은 파티와 같은 상태를 쓴다. 머리 오른쪽에 접기 버튼, 마지막 캡처
 * 시간, Alt+R과 같은 회차를 시작하는 캡처 버튼을 둔다.
 */
export function RaidPage({
  id,
  hidden = false,
  status,
  slots,
  characters,
  basicOnly = false,
  slotNotices,
  nicknames,
  loadingSlots,
  resetKey = 'raid',
  lastCapturedAt,
  canCapture,
  onCapture,
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
  /** 공대 캡처가 인식한 자리별 이름. 캐릭터를 찾기 전까지 카드 이름 칸에 보인다. */
  nicknames?: readonly (string | null)[]
  /** 공대 캡처가 인식하는 동안 진행 표시를 보일 자리 */
  loadingSlots?: readonly boolean[]
  /** 캡처 회차가 바뀌면 카드의 입력 초안을 새로 그린다. */
  resetKey?: string
  /** 마지막으로 인식을 마친 공대 회차의 완료 시각(ms). 없으면 null이다. */
  lastCapturedAt: number | null
  /** Alt+R이 지금 공대 회차를 시작할 수 있는지. 아니면 버튼도 누를 수 없다. */
  canCapture: boolean
  onCapture: () => void
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
        <div {...stylex.props(styles.actions)}>
          <IconButton
            aria-label={collapsed ? '카드 펼치기' : '카드 접기'}
            aria-expanded={!collapsed}
            aria-controls={id}
            onClick={onToggleCollapsed}
            icon={<FoldIcon collapsed={collapsed} />}
          />
          <LastCaptureTime key={lastCapturedAt ?? 'none'} at={lastCapturedAt} />
          <CaptureButton target="공대" disabled={!canCapture} onClick={onCapture} />
        </div>
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
              const nickname = found ? undefined : (nicknames?.[index] ?? undefined)

              return (
                <CharacterCard
                  key={`${resetKey}-${index}`}
                  slot={index + 1}
                  character={character}
                  state={state}
                  nickname={nickname}
                  loading={loadingSlots?.[index]}
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
