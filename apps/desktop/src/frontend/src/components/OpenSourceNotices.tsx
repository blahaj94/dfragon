import { useLayoutEffect, useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { shapes } from '@dfragon/ui'
import type { NoticeEntry } from '@dfragon/licenses/types'
import { ChevronLeftIcon } from './ChevronLeftIcon'
import { ChevronRightIcon } from './ChevronRightIcon'
import { styles } from './OpenSourceNotices.style'

// 메뉴 이름이 목록의 제목을 겸하므로 본문 제목과 열 머리를 두지 않는다.
export function OpenSourceNotices({ entries }: { entries: NoticeEntry[] }): React.JSX.Element {
  const [selected, setSelected] = useState<NoticeEntry | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const backButton = useRef<HTMLButtonElement>(null)
  const lastTrigger = useRef<HTMLButtonElement | null>(null)
  const previousSelection = useRef<NoticeEntry | null>(null)

  useLayoutEffect(() => {
    if (selected) {
      heading.current?.focus({ preventScroll: true })
      backButton.current?.scrollIntoView?.({ block: 'start' })
    } else if (previousSelection.current) {
      lastTrigger.current?.focus()
    }
    previousSelection.current = selected
  }, [selected])

  if (selected) {
    return (
      <>
        <button
          type="button"
          ref={backButton}
          onClick={() => setSelected(null)}
          {...stylex.props(styles.back)}
        >
          <ChevronLeftIcon {...stylex.props(styles.backIcon)} />
          라이선스 사용고지
        </button>
        <h3 ref={heading} tabIndex={-1} {...stylex.props(styles.heading)}>
          {selected.name}
        </h3>
        <div {...stylex.props(styles.tags)}>
          <span {...stylex.props(styles.tag, shapes.cutTopRight)}>{selected.license}</span>
          {selected.version && <span {...stylex.props(styles.version)}>{selected.version}</span>}
        </div>
        {selected.documents.map((document, index) => (
          <section
            key={`${document.name}-${index}`}
            {...stylex.props(styles.notice)}
            aria-label={document.name}
          >
            <h4 {...stylex.props(styles.documentTitle)}>{document.name}</h4>
            <pre {...stylex.props(styles.original)}>{document.text}</pre>
          </section>
        ))}
      </>
    )
  }

  return (
    <ul aria-label="라이선스 사용고지" {...stylex.props(styles.list)}>
      {entries.map((entry) => (
        <li key={`${entry.name}@${entry.version}`} {...stylex.props(styles.item)}>
          <button
            type="button"
            ref={(element) => {
              if (entry === previousSelection.current && element) {
                lastTrigger.current = element
              }
            }}
            onClick={(event) => {
              lastTrigger.current = event.currentTarget
              setSelected(entry)
            }}
            {...stylex.props(styles.row)}
          >
            <span {...stylex.props(styles.name)}>
              <span {...stylex.props(styles.nameText)}>{entry.name}</span>
              {entry.version && <span {...stylex.props(styles.nameDetail)}>{entry.version}</span>}
            </span>
            <span {...stylex.props(styles.license)}>{entry.license}</span>
            <ChevronRightIcon {...stylex.props(styles.rowChevron)} />
          </button>
        </li>
      ))}
    </ul>
  )
}
