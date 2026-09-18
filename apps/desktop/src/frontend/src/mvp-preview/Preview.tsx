import { useEffect, useState } from 'react'
import { ActionButton } from '@ldb/ui'
import * as stylex from '@stylexjs/stylex'
import { colors, lightTheme } from '../cards/theme.stylex'
import { CharacterCard } from '../cards/CharacterCard'
import { DetailDeck } from '../cards/DetailDeck'
import type { SlotState } from '../cards/types'
import { previewCharacter } from './fixture'

const styles = stylex.create({
  app: {
    minHeight: '100vh',
    boxSizing: 'border-box',
    backgroundColor: colors.background,
    color: colors.text,
    padding: '16px 24px',
    fontFamily: 'NanumSquareNeo, sans-serif'
  },
  header: {
    minHeight: 72,
    color: colors.shellText,
    paddingInline: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: 16
  },
  themeIcon: { color: colors.shellText, fontSize: 20 },
  actions: { display: 'flex', alignItems: 'center', gap: 8 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
    gap: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 8
  },
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginTop: 16,
    fontSize: 12,
    color: colors.shellMuted
  },
  select: {
    maxWidth: '100%',
    padding: 6,
    fontFamily: 'inherit',
    backgroundColor: colors.card,
    color: colors.text,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 6
  },
  notice: { fontSize: 12, lineHeight: 1.6, color: colors.shellMuted, margin: '12px 0 0' },
  title: {
    fontSize: 12,
    color: colors.shellMuted,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }
})

const scenarios: Record<string, SlotState[]> = {
  states: ['success', 'success', 'failure', 'idle'],
  faces: ['success', 'success', 'success', 'success'],
  pending: ['pending', 'empty', 'failure', 'idle'],
  missing: ['success', 'success', 'success', 'success']
}

export function Preview(): React.JSX.Element {
  const query = new URLSearchParams(window.location.search)
  const [light, setLight] = useState(
    () =>
      query.get('theme') === 'light' ||
      (query.get('theme') === 'system' &&
        window.matchMedia('(prefers-color-scheme: light)').matches)
  )
  const [scenario, setScenario] = useState('states')
  useEffect(() => {
    document.documentElement.dataset.seedColorMode = light ? 'light-only' : 'dark-only'
  }, [light])
  const detail = query.get('detail') === 'sample'
  const character =
    scenario === 'missing'
      ? {
          ...previewCharacter,
          image: 'data:image/png;base64,AA==',
          equipment: previewCharacter.equipment.map((item) => ({
            ...item,
            image: 'data:image/png;base64,AA==',
            enhancement: undefined,
            enchantment: undefined
          }))
        }
      : previewCharacter
  const openDetail = (): void => {
    const url = new URL(window.location.href)
    url.search = new URLSearchParams({
      detail: 'sample',
      theme: light ? 'light' : 'dark'
    }).toString()
    window.open(url.href, 'ldb-mvp-detail')
  }

  return (
    <main
      data-seed-color-mode={light ? 'light-only' : 'dark-only'}
      {...stylex.props(styles.app, light && lightTheme)}
    >
      {detail ? (
        <>
          <div {...stylex.props(styles.title)}>
            <span>캐릭터 상세 · 합성 데이터 미리보기</span>
            <ActionButton
              size="xsmall"
              variant="ghost"
              aria-label="상세 닫기"
              onClick={() => window.close()}
            >
              ×
            </ActionButton>
          </div>
          <DetailDeck character={character} />
        </>
      ) : (
        <>
          <header {...stylex.props(styles.header)}>
            <ActionButton size="small" variant="ghost" disabled aria-label="캡처 연결 예정">
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </ActionButton>
            <div {...stylex.props(styles.actions)}>
              <ActionButton
                size="small"
                variant="ghost"
                aria-label={light ? '다크 테마' : '라이트 테마'}
                onClick={() => setLight(!light)}
              >
                <span {...stylex.props(styles.themeIcon)}>{light ? '☾' : '☀'}</span>
              </ActionButton>
              <ActionButton size="small" variant="ghost" disabled>
                로그인
              </ActionButton>
            </div>
          </header>
          <section aria-label="파티 캐릭터" {...stylex.props(styles.grid)}>
            {scenarios[scenario].map((state, index) => (
              <CharacterCard
                key={`${scenario}-${index}`}
                slot={index + 1}
                character={character}
                state={state}
                initialFace={scenario === 'faces' || scenario === 'missing' ? index : 0}
                onDetail={openDetail}
              />
            ))}
          </section>
          <footer {...stylex.props(styles.footer)}>
            <span>LDB Desktop</span>
            <select
              aria-label="미리보기 상태"
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
              {...stylex.props(styles.select)}
            >
              <option value="states">기본 · 상태 비교</option>
              <option value="faces">네 면 비교</option>
              <option value="pending">검색 중 · 결과 없음</option>
              <option value="missing">누락 · 이미지 실패</option>
            </select>
          </footer>
          <p {...stylex.props(styles.notice)}>
            합성 데이터 미리보기 · 카드를 눌러 넘기고, 우측 상단에서 상세를 여세요.
            <br />
            이름 입력은 조작 확인용이며 검색되지 않습니다. 마법부여 등급은 디자인 예시입니다.
          </p>
        </>
      )}
    </main>
  )
}
