import { Button, Kbd } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { CameraIcon } from './CameraIcon'
import { styles } from './CaptureButton.style'

/**
 * 머리의 캡처 주 버튼. 카메라 아이콘, 구분선, `Alt` `R` 키캡을 두고 누르면 Alt+R과 같은 회차 시작을 요청한다.
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
      size="lg"
      aria-label={`${target} 캡처, 단축키 Alt R`}
      aria-keyshortcuts="Alt+R"
      disabled={disabled}
      onClick={onClick}
    >
      <span {...stylex.props(styles.content)}>
        <CameraIcon width={24} height={24} />
        <span aria-hidden="true" {...stylex.props(styles.divider)} />
        <span aria-hidden="true" {...stylex.props(styles.keys)}>
          <Kbd surface="signal">Alt</Kbd>
          <Kbd surface="signal">R</Kbd>
        </span>
      </span>
    </Button>
  )
}
