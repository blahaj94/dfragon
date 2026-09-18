import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { styles } from './DetailDeck.style'
import { serverNames } from '../../constants/servers'
import { detailFaces } from '../../constants/cards'
import type { CardCharacter } from '../../types/cards'
import { EquipmentGrid } from './EquipmentGrid'
import { InvestmentTable } from '../../components/InvestmentTable'

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
            <span {...stylex.props(styles.server)}>{serverNames[character.serverId]}</span>
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
