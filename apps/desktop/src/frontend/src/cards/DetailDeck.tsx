import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { colors } from './theme.stylex'
import { detailFaces, type CardCharacter } from './types'
import { EquipmentGrid, InvestmentTable } from './CardContent'

const styles = stylex.create({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 24,
    paddingBlock: 16,
    color: colors.shellText,
    flexWrap: 'wrap'
  },
  name: { fontSize: 28, margin: '0 0 12px', fontWeight: 700 },
  server: {
    fontSize: 12,
    padding: '5px 12px',
    backgroundColor: colors.control,
    borderRadius: 6,
    marginLeft: 24,
    verticalAlign: 'middle'
  },
  subtitle: { fontSize: 13, color: colors.muted, margin: 0 },
  scores: { display: 'flex', gap: 48, margin: 0, alignItems: 'center', paddingRight: 24 },
  label: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  score: { fontSize: 28, fontWeight: 700, margin: 0 },
  fame: { color: colors.accent },
  scroll: { overflowX: 'auto', paddingBottom: 0 },
  deck: { position: 'relative', minWidth: 1072, height: 512, marginTop: 4 },
  card: (rank: number) => ({
    position: 'absolute',
    width: 736,
    height: 480,
    boxSizing: 'border-box',
    left: rank * 84,
    top: rank * 8,
    zIndex: 5 - rank,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: rank === 0 ? colors.card : colors.alternate,
    transitionProperty: 'left, top, background-color',
    transitionDuration: { default: '180ms', '@media (prefers-reduced-motion: reduce)': '0ms' },
    transitionTimingFunction: 'ease-out',
    color: colors.text
  }),
  selector: (selected: boolean) => ({
    position: 'absolute',
    inset: 0,
    borderWidth: 0,
    borderRadius: 12,
    backgroundColor: 'transparent',
    color: colors.text,
    cursor: selected ? 'default' : 'pointer',
    textAlign: 'right',
    padding: 0,
    ':focus-visible': { outline: `2px solid ${colors.accent}`, outlineOffset: -4 }
  }),
  tabLabel: {
    position: 'absolute',
    top: 24,
    right: 0,
    width: 84,
    textAlign: 'center',
    fontSize: 13
  },
  number: {
    position: 'absolute',
    bottom: 30,
    right: 0,
    width: 84,
    textAlign: 'center',
    fontSize: 13,
    color: colors.muted
  },
  title: { margin: 0, fontSize: 18, fontWeight: 700, position: 'absolute', top: 20, left: 20 },
  content: { position: 'absolute', inset: '68px 20px 20px', pointerEvents: 'none' },
  identity: { textAlign: 'center', marginTop: 12 },
  adventure: { fontSize: 12, color: colors.adventure },
  characterName: { margin: '8px 0', fontSize: 20, fontWeight: 700 },
  pending: {
    display: 'grid',
    placeContent: 'center',
    height: '100%',
    textAlign: 'center',
    gap: 12,
    color: colors.muted,
    fontSize: 14
  },
  note: { margin: '12px 0 0', color: colors.muted, fontSize: 12, textAlign: 'center' }
})

export function DetailDeck({ character }: { character: CardCharacter }): React.JSX.Element {
  const [selected, setSelected] = useState(0)
  const order = [
    selected,
    ...detailFaces.map((_, index) => index).filter((index) => index !== selected)
  ]
  return (
    <>
      <header {...stylex.props(styles.header)}>
        <div>
          <h1 {...stylex.props(styles.name)}>
            {character.name}
            <span {...stylex.props(styles.server)}>{character.server}</span>
          </h1>
          <p {...stylex.props(styles.subtitle)}>
            {character.adventure} · Lv.115 · {character.job}
          </p>
        </div>
        <dl {...stylex.props(styles.scores)}>
          <div>
            <dt {...stylex.props(styles.label)}>장비 점수</dt>
            <dd {...stylex.props(styles.score)}>
              {character.equipmentScore?.toLocaleString('ko-KR') ?? '—'}
            </dd>
          </div>
          <div>
            <dt {...stylex.props(styles.label)}>명성</dt>
            <dd {...stylex.props(styles.score, styles.fame)}>
              {character.fame.toLocaleString('ko-KR')}
            </dd>
          </div>
        </dl>
      </header>
      <div {...stylex.props(styles.scroll)}>
        <div aria-label="캐릭터 상세 카드" {...stylex.props(styles.deck)}>
          {detailFaces.map((face, index) => {
            const active = selected === index
            return (
              <section
                key={face}
                aria-label={`${face} 카드`}
                {...stylex.props(styles.card(order.indexOf(index)))}
              >
                <button
                  type="button"
                  aria-label={`${face} 카드 선택`}
                  aria-pressed={active}
                  onClick={() => setSelected(index)}
                  {...stylex.props(styles.selector(active))}
                >
                  {!active && (
                    <>
                      <span {...stylex.props(styles.tabLabel)}>{face}</span>
                      <span {...stylex.props(styles.number)}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </>
                  )}
                </button>
                {active && (
                  <>
                    <h2 {...stylex.props(styles.title)}>{face}</h2>
                    <div {...stylex.props(styles.content)}>
                      {(face === '장비' || face === '서약') && (
                        <>
                          <EquipmentGrid character={character} large oath={face === '서약'} />
                          <div {...stylex.props(styles.identity)}>
                            <span {...stylex.props(styles.adventure)}>{character.adventure}</span>
                            <p {...stylex.props(styles.characterName)}>{character.name}</p>
                            <span {...stylex.props(styles.subtitle)}>{character.job}</span>
                          </div>
                        </>
                      )}
                      {(face === '강화' || face === '마법부여') && (
                        <>
                          <InvestmentTable
                            equipment={character.equipment}
                            large
                            kind={face === '강화' ? 'enhancement' : 'enchantment'}
                          />
                          {face === '마법부여' && (
                            <p {...stylex.props(styles.note)}>
                              등급은 디자인 예시입니다. 실제 자동 평가는 연결하지 않았습니다.
                            </p>
                          )}
                        </>
                      )}
                      {face === '스킬트리' && (
                        <div {...stylex.props(styles.pending)}>
                          <strong>스킬트리</strong>
                          <span>구성 예정</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </section>
            )
          })}
        </div>
      </div>
    </>
  )
}
