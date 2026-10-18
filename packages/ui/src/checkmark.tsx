import * as stylex from '@stylexjs/stylex'
import { CheckIcon } from './icons'
import { styles } from './checkmark.style'

/**
 * 체크 상자 모양만 그린다. 상태는 바로 위 부모의 `data-checked`, `data-disabled`를 따른다.
 * Desktop이 SEED `Checkbox.Root.Primitive` 안에서 쓰는 동안만 두며, 화면이 `Checkbox`로 옮기는
 * Desktop SEED 제거 PR에서 지운다.
 * @deprecated `Checkbox`를 쓴다.
 */
export function Checkmark() {
  return (
    <span aria-hidden="true" {...stylex.props(styles.box)}>
      <span {...stylex.props(styles.check)}>
        <CheckIcon />
      </span>
    </span>
  )
}
