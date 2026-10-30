import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { CheckIcon } from './CheckIcon'
import { CloseIcon } from './CloseIcon'
import { FACE_SIZE, styles } from './CandidateWindow.style'
import { MISSING_VALUE } from '../constants/cards'
import { characterImageUrl } from '../../../preload/common/search/character-summary'
import type { CharacterChoice } from '../../../preload/common/types/search'
import type { CandidatePicker } from '../lib/candidate-picker'

const integer = new Intl.NumberFormat('ko-KR')

export function CandidateWindow({
  id,
  slot,
  picker,
  onPick,
  onClose
}: {
  id?: string
  slot: number
  picker: CandidatePicker
  onPick: (serverId: string) => void
  onClose: () => void
}): React.JSX.Element {
  const renderChoice = (choice: CharacterChoice): React.JSX.Element => {
    const shown = choice.serverId === picker.shownServerId
    const previewing = choice.serverId === picker.previewServerId
    const server = choice.serverName ?? choice.serverId
    const fame = choice.fame !== null ? integer.format(choice.fame) : MISSING_VALUE
    const adventure = choice.adventureName ?? '모험단 정보 없음'
    const description = `${server}, 명성 ${fame}, ${adventure}`
    const state = previewing ? ', 미리보기 중, 한 번 더 누르면 확정' : ''
    const handlePick = (): void => onPick(choice.serverId)

    return (
      <button
        key={choice.serverId}
        type="button"
        title={description}
        aria-label={`${description}${state}`}
        aria-pressed={shown}
        onClick={handlePick}
        {...stylex.props(styles.portrait, shown && styles.shown, previewing && styles.preview)}
      >
        <ChoiceFace choice={choice} />
        <span aria-hidden="true" {...stylex.props(styles.tag)}>
          <span {...stylex.props(styles.tagServer)}>{server}</span>
          <span {...stylex.props(styles.tagFame)}>{fame}</span>
        </span>
        {previewing && (
          <span {...stylex.props(styles.check)}>
            <CheckIcon width="9" height="9" strokeWidth="4" />
          </span>
        )}
      </button>
    )
  }

  return (
    <div id={id} role="group" aria-label={`${slot}번 후보 고르기`} {...stylex.props(styles.window)}>
      <div {...stylex.props(styles.portraits)}>{picker.choices.map(renderChoice)}</div>
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

function ChoiceFace({ choice }: { choice: CharacterChoice }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const face = choice.face
  const handleError = (): void => setFailed(true)
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
      onError={handleError}
      {...stylex.props(styles.faceImage, styles.faceWindow(face.x, face.y, FACE_SIZE / face.width))}
    />
  )
}
