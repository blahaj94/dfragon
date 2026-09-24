import { useEffect, useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { ActionButton, Typo } from '@dfragon/ui'
import type { DeveloperWorkbenchSample } from '../lib/developer-party'
import { styles } from './DeveloperSampleThumbnail.style'

export function DeveloperSampleThumbnail({
  sample,
  selected,
  onSelect
}: {
  sample: DeveloperWorkbenchSample
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  const itemRef = useRef<HTMLDivElement>(null)
  const [image, setImage] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let current = true
    let requested = false
    const readImage = (): void => {
      if (requested) {
        return
      }
      requested = true
      void window.developer
        .readImage(sample.id)
        .then((data) => {
          if (current) {
            setImage(data)
          }
        })
        .catch(() => {
          if (current) {
            setFailed(true)
          }
        })
    }

    if (typeof IntersectionObserver === 'undefined' || itemRef.current == null) {
      readImage()
    } else {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          readImage()
        }
      })
      observer.observe(itemRef.current)
      return () => {
        current = false
        observer.disconnect()
      }
    }

    return () => {
      current = false
    }
  }, [sample.id])

  const state = sample.excluded ? '제외' : sample.text == null ? '미입력' : '완료'

  return (
    <li>
      <ActionButton
        size="small"
        variant={selected ? 'neutralSolid' : 'ghost'}
        aria-pressed={selected}
        onClick={onSelect}
        {...stylex.props(styles.button)}
      >
        <div ref={itemRef} {...stylex.props(styles.row)}>
          <div {...stylex.props(styles.thumbnail)}>
            {image ? (
              <img src={image} alt="" {...stylex.props(styles.image)} />
            ) : (
              <Typo.caption {...stylex.props(styles.placeholder)}>
                {failed ? '확인 불가' : '로딩'}
              </Typo.caption>
            )}
          </div>
          <div {...stylex.props(styles.description)}>
            <Typo.txtS as="span" weight={700} {...stylex.props(styles.overflow)}>
              {sample.text == null ? '정답 미입력' : sample.text === '' ? '(빈 정답)' : sample.text}
            </Typo.txtS>
            <Typo.caption {...stylex.props(styles.muted)}>{state}</Typo.caption>
          </div>
        </div>
      </ActionButton>
    </li>
  )
}
