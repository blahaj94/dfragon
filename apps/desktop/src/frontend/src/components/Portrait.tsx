import * as stylex from '@stylexjs/stylex'
import { CardImage } from './CardImage'
import { styles } from './Portrait.style'

export function Portrait({ src }: { src: string | undefined }): React.JSX.Element {
  return (
    <div {...stylex.props(styles.portrait)}>
      <CardImage src={src} />
    </div>
  )
}
