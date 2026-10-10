import * as stylex from '@stylexjs/stylex'
import { TextField as SeedTextField } from './seed/text-field'
import type { PublicProps } from './public-props'
import { styles } from './text-field.style'

export type TextFieldProps = PublicProps<typeof SeedTextField>

// 공식 TextField Snippet의 API를 유지하고 포커스 선 색만 SEED focus ring으로 지정한다.
export function TextField(props: TextFieldProps) {
  return <SeedTextField {...props} {...stylex.props(styles.root)} />
}
