import { useLayoutEffect, useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { Typo, ActionButton, TextField, TextFieldInput } from '@ldb/ui'
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
        <Typo.txtS as="span" weight={700}>
          ‹ 라이선스 목록
        </Typo.txtS>
      </ActionButton>
      <Typo.h4 as="h2" ref={heading} tabIndex={-1} {...stylex.props(styles.heading)}>
        {selected.name}
      </Typo.h4>
      <Typo.txtS {...stylex.props(styles.description)}>
        {[selected.version, selected.license].filter(Boolean).join(' · ')}
      </Typo.txtS>
      {selected.documents.map((document, index) => (
        <section
          key={`${document.name}-${index}`}
          {...stylex.props(styles.document)}
          aria-label={document.name}
        >
          <Typo.txtM as="h3" weight={700} {...stylex.props(styles.documentTitle)}>
            {document.name}
          </Typo.txtM>
          <Typo.txtS as="pre" {...stylex.props(styles.original)}>
            {document.text}
          </Typo.txtS>
        </section>
      ))}
    </>
  ) : (
    <>
      <Typo.h4 as="h2" {...stylex.props(styles.heading)}>
        라이선스 사용고지
      </Typo.h4>
      <Typo.txtS {...stylex.props(styles.description)}>
        LDB에 사용된 오픈소스와 글꼴의 라이선스를 확인하세요.
      </Typo.txtS>
      <TextField
        label={
          <Typo.txtS as="span" weight={700}>
            구성 요소 검색
          </Typo.txtS>
        }
      >
        <TextFieldInput
          asChild
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="이름 또는 라이선스"
        >
          <Typo.txtS as="input" />
        </TextFieldInput>
      </TextField>
      <Typo.caption as="p" role="status" {...stylex.props(styles.count)}>
        {filtered.length}개 구성 요소
      </Typo.caption>
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
              <Typo.txtM as="span" weight={700} {...stylex.props(styles.name)}>
                {entry.name}
                {entry.version && (
                  <Typo.caption {...stylex.props(styles.version)}>{entry.version}</Typo.caption>
                )}
              </Typo.txtM>
              <Typo.txtS as="span" {...stylex.props(styles.license)}>
                {entry.license}
              </Typo.txtS>
              <span aria-hidden="true" {...stylex.props(styles.rowChevron)}>
                ›
              </span>
            </ActionButton>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && (
        <Typo.txtS {...stylex.props(styles.description)}>
          검색 결과가 없습니다. 다른 검색어를 입력해 주세요.
        </Typo.txtS>
      )}
    </>
  )
}
