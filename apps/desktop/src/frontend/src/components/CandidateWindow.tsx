import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { CheckIcon } from './CheckIcon'
import { CloseIcon } from './CloseIcon'
import { FACE_SIZE, styles } from './CandidateWindow.style'
import { characterImageUrl } from '../../../preload/common/search/character-summary'
import type { CharacterChoice } from '../../../preload/common/types/search'
import type { CandidatePicker } from '../lib/candidate-picker'

/**
 * 얼굴로 확정하지 못한 카드 위에 한 겹 더 뜨는 후보 창. 후보마다 비교에 쓴 얼굴 초상화만 한 줄로 두고, 이름은
 * 후보끼리 같아서 쓰지 않는다. 서버와 모험단은 `title`과 보조 기술 이름에만 둔다. 한 번 누르면 미리보기,
 * 미리보기 중인 후보를 다시 누르면 확정이며 그 판단은 누른 뒤의 상태를 정하는 쪽이 한다. 창을 띄우는 곳은
 * `position: relative`인 카드 자리여야 한다.
 */
export function CandidateWindow({
  id,
  slot,
  picker,
  onPick,
  onClose
}: {
  /** 창을 여닫는 버튼이 `aria-controls`로 가리킬 id */
  id?: string
  slot: number
  picker: CandidatePicker
  onPick?: (serverId: string) => void
  onClose: () => void
}): React.JSX.Element {
  return (
    <div id={id} role="group" aria-label={`${slot}번 후보 고르기`} {...stylex.props(styles.window)}>
      <div {...stylex.props(styles.portraits)}>
        {picker.choices.map((choice) => {
          const shown = choice.serverId === picker.shownServerId
          const previewing = choice.serverId === picker.previewServerId
          const server = choice.serverName ?? choice.serverId
          const adventure = choice.adventureName ?? '모험단 정보 없음'
          const description = `${server}, ${adventure}`
          const state = previewing ? ', 미리보기 중, 한 번 더 누르면 확정' : ''

          return (
            <button
              key={choice.serverId}
              type="button"
              title={description}
              aria-label={`${description}${state}`}
              aria-pressed={shown}
              disabled={onPick === undefined}
              onClick={() => onPick?.(choice.serverId)}
              {...stylex.props(
                styles.portrait,
                shown && styles.shown,
                previewing && styles.preview
              )}
            >
              <ChoiceFace choice={choice} />
              {previewing && (
                <span {...stylex.props(styles.check)}>
                  <CheckIcon width="9" height="9" strokeWidth="4" />
                </span>
              )}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        aria-label={`${slot}번 후보 창 닫기`}
        onClick={onClose}
        {...stylex.props(styles.close)}
      >
        <CloseIcon {...stylex.props(styles.closeIcon)} />
      </button>
    </div>
  )
}

/** 색 비교가 맞춘 후보 이미지의 얼굴 창. 창이 없거나 이미지를 받지 못하면 빈 칸이다. */
function ChoiceFace({ choice }: { choice: CharacterChoice }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const face = choice.face
  if (face === null || failed) {
    return (
      <span aria-hidden="true" {...stylex.props(styles.faceMissing)}>
        —
      </span>
    )
  }

  return (
    <img
      src={characterImageUrl(choice)}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      {...stylex.props(styles.faceImage, styles.faceWindow(face.x, face.y, FACE_SIZE / face.width))}
    />
  )
}
