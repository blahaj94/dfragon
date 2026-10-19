import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { CheckIcon } from './CheckIcon'
import { COMPACT_FACE_SIZE, FACE_SIZE, styles } from './CandidateStrip.style'
import { characterImageUrl } from '../../../preload/common/search/character-summary'
import type { CharacterChoice } from '../../../preload/common/types/search'
import type { CandidatePicker } from '../lib/candidate-picker'

/**
 * 얼굴로 확정하지 못한 카드의 후보 줄. 후보마다 비교에 쓴 얼굴 창, 모험단, 서버를 보인다. 한 번 누르면
 * 미리보기, 미리보기 중인 후보를 다시 누르면 확정이며 그 판단은 누른 뒤의 상태를 정하는 쪽이 한다. 접힌
 * 카드(`compact`)는 이름 오른쪽에 얼굴과 모험단만 담은 작은 타일을 둔다.
 */
export function CandidateStrip({
  slot,
  picker,
  onPick,
  compact = false
}: {
  slot: number
  picker: CandidatePicker
  onPick?: (serverId: string) => void
  compact?: boolean
}): React.JSX.Element {
  const tiles = picker.choices.map((choice) => {
    const shown = choice.serverId === picker.shownServerId
    const previewing = choice.serverId === picker.previewServerId
    const server = choice.serverName ?? choice.serverId
    const adventure = choice.adventureName ?? '모험단 정보 없음'
    const state = previewing ? ', 미리보기 중, 한 번 더 누르면 확정' : ''

    return (
      <button
        key={choice.serverId}
        type="button"
        aria-label={`${server}, ${adventure}${state}`}
        aria-pressed={shown}
        disabled={onPick === undefined}
        onClick={() => onPick?.(choice.serverId)}
        {...stylex.props(
          styles.tile,
          compact && styles.compactTile,
          shown && styles.shown,
          previewing && styles.preview
        )}
      >
        <ChoiceFace choice={choice} compact={compact} />
        {previewing && (
          <span {...stylex.props(styles.check, compact && styles.compactCheck)}>
            <CheckIcon width={compact ? '9' : '10'} height={compact ? '9' : '10'} strokeWidth="4" />
          </span>
        )}
        {compact ? (
          <CompactLabel choice={choice} server={server} />
        ) : (
          <>
            <span
              aria-hidden="true"
              {...stylex.props(
                styles.adventure,
                choice.adventureName === null && styles.adventureMissing
              )}
            >
              {choice.adventureName === null ? (
                '—'
              ) : (
                <span {...stylex.props(styles.marquee)}>{choice.adventureName}</span>
              )}
            </span>
            <span aria-hidden="true" {...stylex.props(styles.server)}>
              {server}
            </span>
          </>
        )}
      </button>
    )
  })
  if (compact) {
    return (
      <div role="group" aria-label={`${slot}번 후보 고르기`} {...stylex.props(styles.compactTiles)}>
        {tiles}
      </div>
    )
  }

  return (
    <div role="group" aria-label={`${slot}번 후보 고르기`} {...stylex.props(styles.strip)}>
      <div {...stylex.props(styles.tiles)}>{tiles}</div>
    </div>
  )
}

/** 작은 타일의 한 줄. 모험단을 모르면 서버를 대신 보인다. */
function CompactLabel({
  choice,
  server
}: {
  choice: CharacterChoice
  server: string
}): React.JSX.Element {
  const label = choice.adventureName ?? server

  return (
    <span
      aria-hidden="true"
      {...stylex.props(
        styles.adventure,
        styles.compactAdventure,
        choice.adventureName === null && styles.compactServerOnly
      )}
    >
      <span {...stylex.props(styles.marquee, styles.compactMarquee)}>{label}</span>
    </span>
  )
}

/** 색 비교가 맞춘 후보 이미지의 얼굴 창. 창이 없거나 이미지를 받지 못하면 빈 칸이다. */
function ChoiceFace({
  choice,
  compact
}: {
  choice: CharacterChoice
  compact: boolean
}): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const face = choice.face
  const size = compact ? COMPACT_FACE_SIZE : FACE_SIZE
  if (face === null || failed) {
    return (
      <span
        aria-hidden="true"
        {...stylex.props(styles.face, compact && styles.compactFace, styles.faceMissing)}
      >
        —
      </span>
    )
  }

  return (
    <span aria-hidden="true" {...stylex.props(styles.face, compact && styles.compactFace)}>
      <img
        src={characterImageUrl(choice)}
        alt=""
        draggable={false}
        onError={() => setFailed(true)}
        {...stylex.props(styles.faceImage, styles.faceWindow(face.x, face.y, size / face.width))}
      />
    </span>
  )
}
