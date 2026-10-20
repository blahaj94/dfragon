import { useState } from 'react'
import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { RarityTone } from '../lib/card-faces'
import type { ItemPicture } from '../lib/equipment-icons'
import { styles, toneStyles } from './ItemIcon.style'
import { SpriteIconImage } from './SpriteIconImage'

/**
 * 기타 면 행 왼쪽의 장비 아이콘 칸(DFragon 디자인 캔버스 카드 면 보드). 칸 테두리와 아래 2px 바가 희귀도 색이고,
 * 그림은 장식이라 대체 문구를 비운다. 그림이 없거나 불러오지 못하면 같은 크기의 빈 칸만 남겨 줄이 밀리지 않는다.
 * `large`는 상세 창 장비 목록의 28 칸(캔버스 상세 창 보드)이며 그림을 칸에 꽉 채우고 오른쪽 위를 자른다.
 */
export function ItemIcon({
  src,
  tone,
  large = false
}: {
  src: ItemPicture | undefined
  tone: RarityTone | 'missing'
  large?: boolean
}): React.JSX.Element {
  const imageSize = large ? 28 : 22
  const [failedSource, setFailedSource] = useState<string>()
  const showImage = typeof src === 'string' && failedSource !== src

  return (
    <span
      aria-hidden="true"
      data-tone={tone}
      {...stylex.props(
        styles.cell,
        large && styles.cellLarge,
        large && shapes.cutTopRight,
        toneStyles[tone],
        tone === 'primordial' && styles.shine
      )}
    >
      {typeof src === 'object' && (
        <span {...stylex.props(styles.sprite(imageSize))}>
          <SpriteIconImage icon={src} />
        </span>
      )}
      {showImage && (
        <img
          src={src}
          alt=""
          width={imageSize}
          height={imageSize}
          draggable={false}
          onError={() => setFailedSource(src)}
          {...stylex.props(styles.image)}
        />
      )}
    </span>
  )
}
