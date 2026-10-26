import { Button, Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { CameraIcon } from './CameraIcon'
import { styles } from './CaptureButton.style'

/**
 * 머리의 캡처 주 버튼. 카메라 아이콘과 `Alt R` 글자를 두고 누르면 Alt+R과 같은 회차 시작을 요청한다.
 * 접근 가능한 이름은 `<대상> 캡처, 단축키 Alt R`이다.
 */
export function CaptureButton({
  target,
  disabled,
  onClick
}: {
  /** 회차가 인식하는 대상. 파티나 공대 */
  target: string
  /** Alt+R이 지금 회차를 시작할 수 없으면 버튼도 누를 수 없다. */
  disabled: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <Button
      variant="primary"
      size="sm"
      aria-label={`${target} 캡처, 단축키 Alt R`}
      aria-keyshortcuts="Alt+R"
      disabled={disabled}
      onClick={onClick}
      {...stylex.props(styles.button)}
    >
      <CameraIcon width={16} height={16} />
      <Typo.caption as="span" weight={700}>
        Alt R
      </Typo.caption>
    </Button>
  )
}
