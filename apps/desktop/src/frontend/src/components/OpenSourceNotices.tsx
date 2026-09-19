import { useLayoutEffect, useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { ActionButton, TextField, TextFieldInput } from '@ldb/ui'
import type { NoticeEntry } from '@ldb/licenses/types'
import { styles } from './OpenSourceNotices.style'

export function OpenSourceNotices({ entries }: { entries: NoticeEntry[] }): React.JSX.Element {
  const [selected, setSelected] = useState<NoticeEntry | null>(null)
  const [query, setQuery] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const backButton = useRef<HTMLButtonElement>(null)
  const lastTrigger = useRef<HTMLButtonElement | null>(null)
  const previousSelection = useRef<NoticeEntry | null>(null)
  const term = query.trim().toLocaleLowerCase()
  const filtered = entries.filter((entry) =>
    `${entry.name} ${entry.license}`.toLocaleLowerCase().includes(term)
  )

  useLayoutEffect(() => {
    if (selected) {
      heading.current?.focus({ preventScroll: true })
      backButton.current?.scrollIntoView?.({ block: 'start' })
    } else if (previousSelection.current) {
      lastTrigger.current?.focus()
    }
    previousSelection.current = selected
  }, [selected])

  return selected ? (
    <>
      <ActionButton ref={backButton} size="small" variant="ghost" onClick={() => setSelected(null)}>
        ‹ 라이선스 목록
      </ActionButton>
      <h2 ref={heading} tabIndex={-1} {...stylex.props(styles.heading)}>
        {selected.name}
      </h2>
      <p {...stylex.props(styles.description)}>
        {[selected.version, selected.license].filter(Boolean).join(' · ')}
      </p>
      {selected.documents.map((document, index) => (
        <section
          key={`${document.name}-${index}`}
          {...stylex.props(styles.document)}
          aria-label={document.name}
        >
          <h3 {...stylex.props(styles.documentTitle)}>{document.name}</h3>
          <pre {...stylex.props(styles.original)}>{document.text}</pre>
        </section>
      ))}
    </>
  ) : (
    <>
      <h2 {...stylex.props(styles.heading)}>라이선스 사용고지</h2>
      <p {...stylex.props(styles.description)}>
        LDB에 사용된 오픈소스와 글꼴의 라이선스를 확인하세요.
      </p>
      <TextField label="구성 요소 검색">
        <TextFieldInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="이름 또는 라이선스"
        />
      </TextField>
      <p role="status" {...stylex.props(styles.count)}>
        {filtered.length}개 구성 요소
      </p>
      <ul {...stylex.props(styles.list)}>
        {filtered.map((entry) => (
          <li key={`${entry.name}@${entry.version}`}>
            <ActionButton
              size="small"
              variant="ghost"
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
                {entry.name}
                {entry.version && <span {...stylex.props(styles.version)}>{entry.version}</span>}
              </span>
              <span {...stylex.props(styles.license)}>{entry.license}</span>
              <span aria-hidden="true">›</span>
            </ActionButton>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && (
        <p {...stylex.props(styles.description)}>
          검색 결과가 없습니다. 다른 검색어를 입력해 주세요.
        </p>
      )}
    </>
  )
}
