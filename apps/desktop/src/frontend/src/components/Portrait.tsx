import * as stylex from '@stylexjs/stylex'
import type { CharacterFaceWindow } from '../../../preload/common/types/search'
import { CardImage } from './CardImage'
import { styles } from './Portrait.style'

export function Portrait({
  src,
  face
}: {
  src: string | undefined
  face?: CharacterFaceWindow | null
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.portrait)}>
      <CardImage src={src} face={face} />
    </div>
  )
}
