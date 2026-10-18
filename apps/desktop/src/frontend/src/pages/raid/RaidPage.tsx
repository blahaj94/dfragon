import { IconButton, Typo, shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useLayoutEffect, useRef, useState } from 'react'
import { CaptureButton } from '../../components/CaptureButton'
import { FoldIcon } from '../../components/FoldIcon'
import { LastCaptureTime } from '../../components/LastCaptureTime'
import { SnapshotIcon } from '../../components/SnapshotIcon'
import { RAID_PARTY_COUNT, RAID_PARTY_SIZE } from '../../constants/cards'
import { neighborSeat, type SeatDirection, type SeatOrder } from '../../lib/raid-seats'
import { RaidCard } from '../../sections/RaidCard'
import type { CardCharacter, SlotState } from '../../types/cards'
import { styles } from './RaidPage.style'

const SEAT_COUNT = RAID_PARTY_COUNT * RAID_PARTY_SIZE
const parties = Array.from({ length: RAID_PARTY_COUNT }, (_, party) =>
  Array.from({ length: RAID_PARTY_SIZE }, (_, member) => party * RAID_PARTY_SIZE + member)
)
// 다른 앱에서 끌어 온 글자나 파일은 자리 맞바꾸기로 받지 않는다.
const SEAT_DRAG_TYPE = 'application/x-dfragon-raid-seat'
const seatKeys: Readonly<Record<string, SeatDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right'
}

/**
 * 공대 12인 화면(DFragon 디자인 캔버스 공대 보드). 머리 아래에 파티 라벨 열과 축약 카드 네 열, 세 줄을 놓고,
 * 카드를 끌거나 Alt와 방향키로 자리를 맞바꾼다. 자리 배치는 화면 밖이 소유하며, 이 화면은 `seatOrder`로
 * 자리마다 놓인 공대 검색 슬롯을 그리고 조회, 상세 열기는 그 슬롯 번호로 알린다. 카드는 1280×800 보드의
 * 크기로 고정이라 창이 작으면 보드 영역이 가로와 세로로 스크롤한다. 캡처 진행 상태는 상단 바 상태 칩과 캡처
 * 대화상자가 보이고 화면 밖 캡처 안내가 알리므로, 머리에는 캡처 진행 문구를 두지 않는다.
 */
export function RaidPage({
  id,
  hidden = false,
  notice,
  slots,
  characters,
  slotNotices,
  nicknames,
  loadingSlots,
  resetKey = 'raid',
  seatOrder,
  canMoveSeats,
  onSwapSeats,
  lastCapturedAt,
  canCapture,
  onCapture,
  collapsed,
  onToggleCollapsed,
  onLookup,
  onSlotDetail
}: {
  /** 접기 버튼이 가리킬 보드 영역의 id */
  id: string
  /** 파티를 보는 동안에도 자리별 입력과 검색 상태를 지키려고 그린 채 숨긴다. */
  hidden?: boolean
  /** 머리의 안내. 검색 연결 실패나 상세 창 열기 실패처럼 캡처 진행이 아닌 안내만 담는다. */
  notice: string
  /** 공대 검색 슬롯 0~11의 검색 상태. 아래 슬롯별 값도 모두 검색 슬롯 순서다. */
  slots: readonly SlotState[]
  /** 슬롯별 캐릭터. 조회하지 않았거나 찾지 못한 슬롯은 null이다. */
  characters: readonly (CardCharacter | null)[]
  slotNotices?: readonly (string | undefined)[]
  /** 공대 캡처가 인식한 슬롯별 이름. 캐릭터를 찾기 전까지 카드 이름 칸에 보인다. */
  nicknames?: readonly (string | null)[]
  /** 공대 캡처가 인식하는 동안 진행 표시를 보일 슬롯 */
  loadingSlots?: readonly boolean[]
  /** 캡처 회차가 바뀌면 카드의 입력 초안을 새로 그린다. */
  resetKey?: string
  /** 화면 자리 0~11에 놓인 검색 슬롯 */
  seatOrder: SeatOrder
  /** 지금 자리를 맞바꿀 수 있는지. 공대 캡처가 인식하는 동안은 맞바꾸지 않는다. */
  canMoveSeats: boolean
  /** 두 화면 자리(0~11)를 맞바꾼다. */
  onSwapSeats: (from: number, to: number) => void
  /** 마지막으로 인식을 마친 공대 회차의 완료 시각(ms). 없으면 null이다. */
  lastCapturedAt: number | null
  /** Alt+R이 지금 공대 회차를 시작할 수 있는지. 아니면 버튼도 누를 수 없다. */
  canCapture: boolean
  onCapture: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
  /** 검색 슬롯 번호로 서버와 이름을 조회한다. */
  onLookup?: (slot: number, nickname: string, serverId: string) => void
  /** 검색 슬롯 번호로 상세 창을 연다. */
  onSlotDetail?: (slot: number) => void
}): React.JSX.Element {
  const [dragging, setDragging] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  const [moveNotice, setMoveNotice] = useState('')
  const seatElements = useRef(new Map<number, HTMLDivElement>())
  // 키보드로 옮긴 카드. 카드가 새 자리로 옮겨 그려진 뒤 다시 포커스해 이어서 옮길 수 있게 한다.
  const movedSlot = useRef<number | null>(null)
  const filledCount = slots.filter(
    (state, slot) => state === 'success' && characters[slot] != null
  ).length
  const hintId = `${id}-move-hint`

  useLayoutEffect(() => {
    const slot = movedSlot.current
    movedSlot.current = null
    if (slot !== null) {
      seatElements.current.get(slot)?.focus()
    }
  }, [seatOrder])

  function swap(from: number, to: number): void {
    onSwapSeats(from, to)
    setMoveNotice(`${from + 1}번 자리와 ${to + 1}번 자리를 맞바꿨습니다.`)
  }

  function endDrag(): void {
    setDragging(null)
    setDropTarget(null)
  }

  function renderSeat(seat: number, partyLabelId: string): React.JSX.Element {
    const slot = seatOrder[seat]
    const state = slots[slot]
    const character = characters[slot] ?? undefined
    const found = state === 'success' && character != null
    const nickname = found ? undefined : (nicknames?.[slot] ?? undefined)
    let drag: 'source' | 'target' | undefined
    if (dragging === slot) {
      drag = 'source'
    } else if (dropTarget === slot) {
      drag = 'target'
    }

    return (
      <RaidCard
        key={`${resetKey}-${slot}`}
        slot={seat + 1}
        character={character}
        state={state}
        nickname={nickname}
        loading={loadingSlots?.[slot]}
        collapsed={collapsed}
        notice={slotNotices?.[slot]}
        onDetail={found && onSlotDetail !== undefined ? () => onSlotDetail(slot) : undefined}
        onLookup={
          onLookup === undefined
            ? undefined
            : (nickname, serverId) => onLookup(slot, nickname, serverId)
        }
        move={{
          movable: canMoveSeats,
          drag,
          describedBy: canMoveSeats ? `${partyLabelId} ${hintId}` : partyLabelId,
          ref: (element) => {
            if (element === null) {
              return
            }
            seatElements.current.set(slot, element)

            return () => {
              seatElements.current.delete(slot)
            }
          },
          onKeyDown: (event) => {
            // 카드 안의 입력과 버튼은 방향키를 그대로 쓴다.
            if (event.target !== event.currentTarget || !event.altKey) {
              return
            }
            const direction = seatKeys[event.key]
            const target = direction === undefined ? null : neighborSeat(seat, direction)
            if (target === null || !canMoveSeats) {
              return
            }
            event.preventDefault()
            movedSlot.current = slot
            swap(seat, target)
          },
          onDragStart: (event) => {
            // 이름 칸의 선택한 글자를 끄는 동작은 자리 맞바꾸기가 아니다.
            if (event.target !== event.currentTarget || !canMoveSeats) {
              return
            }
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData(SEAT_DRAG_TYPE, String(seat + 1))
            setDragging(slot)
            setDropTarget(null)
          },
          onDragOver: (event) => {
            if (dragging === null || !canMoveSeats) {
              return
            }
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setDropTarget(dragging === slot ? null : slot)
          },
          onDragLeave: (event) => {
            const inside =
              event.relatedTarget instanceof Node &&
              event.currentTarget.contains(event.relatedTarget)
            if (!inside) {
              setDropTarget((target) => (target === slot ? null : target))
            }
          },
          onDrop: (event) => {
            if (dragging === null) {
              return
            }
            // 이름 칸에 놓아도 끈 자리 번호가 입력되지 않게 기본 동작을 막는다.
            event.preventDefault()
            const from = seatOrder.indexOf(dragging)
            if (canMoveSeats && from !== seat) {
              swap(from, seat)
            }
            endDrag()
          },
          onDragEnd: endDrag
        }}
      />
    )
  }

  return (
    <section aria-label="공대" hidden={hidden} {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.title)}>
          <Typo.h4 as="h1" weight={700} {...stylex.props(styles.heading)}>
            공대
          </Typo.h4>
          <span {...stylex.props(styles.count)}>
            {filledCount}
            <span {...stylex.props(styles.total)}>/{SEAT_COUNT}</span>
          </span>
          <span role="status" {...stylex.props(styles.notice)}>
            {notice}
          </span>
        </div>
        <div {...stylex.props(styles.actions)}>
          <IconButton
            size="lg"
            aria-label={collapsed ? '카드 펼치기' : '카드 접기'}
            aria-expanded={!collapsed}
            aria-controls={id}
            onClick={onToggleCollapsed}
            icon={<FoldIcon collapsed={collapsed} />}
          />
          <LastCaptureTime key={lastCapturedAt ?? 'none'} at={lastCapturedAt} />
          <IconButton
            size="lg"
            aria-label="공대 모험단 순번 스냅샷"
            disabled
            icon={<SnapshotIcon />}
          />
          <CaptureButton target="공대" disabled={!canCapture} onClick={onCapture} />
        </div>
      </div>
      <div id={id} {...stylex.props(styles.scroller)}>
        <div {...stylex.props(styles.board, collapsed && styles.boardCollapsed)}>
          {parties.flatMap((seats, party) => {
            // 라벨과 카드를 한 배열로 펼쳐 모든 카드가 같은 부모 아래에서 옮겨 다니게 한다.
            const partyLabelId = `${id}-party-${party + 1}`

            return [
              <div key={partyLabelId} id={partyLabelId} {...stylex.props(styles.partyLabel)}>
                <span {...stylex.props(styles.partyNumber)}>{party + 1}</span>
                <span {...stylex.props(styles.partyName)}>파티</span>
              </div>,
              ...seats.map((seat) => renderSeat(seat, partyLabelId))
            ]
          })}
        </div>
      </div>
      <span id={hintId} {...stylex.props(shapes.srOnly)}>
        Alt와 방향키로 위, 아래, 왼쪽, 오른쪽 자리와 맞바꿉니다.
      </span>
      <span role="status" {...stylex.props(shapes.srOnly)}>
        {moveNotice}
      </span>
    </section>
  )
}
