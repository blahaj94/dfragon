import * as stylex from '@stylexjs/stylex'
import { IconCheckmarkFatFill } from '@karrotmarket/react-monochrome-icon'
import { Checkbox } from '@seed-design/react'
import { styles } from './checkmark.style'

// DFragon 디자인 컴포넌트: 공식 checkbox Snippet의 Control, Indicator 단위에 디자인 꺼짐 색을 적용한다.
// SEED Checkbox.Root나 Checkbox.Root.Primitive 안에서만 동작하며 label 배치와 HiddenInput은 화면이 Root와 함께 둔다.
export function Checkmark() {
  return (
    <Checkbox.Control {...stylex.props(styles.control)}>
      <Checkbox.Indicator checked={<IconCheckmarkFatFill />} />
    </Checkbox.Control>
  )
}
