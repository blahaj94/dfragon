import { Typo } from '@dfragon/ui'
import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { styles } from './CardImage.style'

export function CardImage({
  src,
  label,
  portrait = false
}: {
  src?: string
  label: string
  portrait?: boolean
}): React.JSX.Element {
  const [failedSource, setFailedSource] = useState<string>()
  if (src == null || failedSource === src) {
    return (
      <Typo.caption
        role="img"
        aria-label={`${label} 이미지 없음`}
        {...stylex.props(styles.placeholder)}
      >
        —
      </Typo.caption>
    )
  }
  return (
    <img
      src={src}
      alt={label}
      draggable={false}
      onError={() => setFailedSource(src)}
      {...stylex.props(styles.image, portrait && styles.zoom)}
    />
  )
}
