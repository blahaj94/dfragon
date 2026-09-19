import { Typo } from '@ldb/ui'
import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { styles } from './DetailDeck.style'
import { serverNames } from '../constants/servers'
import { detailFaces } from '../constants/cards'
import type { CardCharacter } from '../types/cards'
import { EquipmentGrid } from './EquipmentGrid'
import { InvestmentTable } from '../components/InvestmentTable'

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
          <Typo.h3 as="h1" {...stylex.props(styles.name)}>
            {character.name}
            <Typo.caption {...stylex.props(styles.server)}>
              {serverNames[character.serverId]}
            </Typo.caption>
          </Typo.h3>
          <Typo.txtS {...stylex.props(styles.subtitle)}>
            {character.adventure} · Lv.115 · {character.job}
          </Typo.txtS>
        </div>
        <dl {...stylex.props(styles.scores)}>
          <div>
            <Typo.caption as="dt" {...stylex.props(styles.label)}>
              장비 점수
            </Typo.caption>
            <Typo.h4 as="dd" {...stylex.props(styles.score)}>
              {character.equipmentScore?.toLocaleString('ko-KR') ?? '—'}
            </Typo.h4>
          </div>
          <div>
            <Typo.caption as="dt" {...stylex.props(styles.label)}>
              명성
            </Typo.caption>
            <Typo.h4 as="dd" {...stylex.props(styles.score, styles.fame)}>
              {character.fame.toLocaleString('ko-KR')}
            </Typo.h4>
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
                      <Typo.txtS as="span" weight={700} {...stylex.props(styles.tabLabel)}>
                        {face}
                      </Typo.txtS>
                      <Typo.caption {...stylex.props(styles.number)}>
                        {String(index + 1).padStart(2, '0')}
                      </Typo.caption>
                    </>
                  )}
                </button>
                {active && (
                  <>
                    <Typo.h5 as="h2" {...stylex.props(styles.title)}>
                      {face}
                    </Typo.h5>
                    <div {...stylex.props(styles.content)}>
                      {(face === '장비' || face === '서약') && (
                        <>
                          <EquipmentGrid character={character} large oath={face === '서약'} />
                          <div {...stylex.props(styles.identity)}>
                            <Typo.caption {...stylex.props(styles.adventure)}>
                              {character.adventure}
                            </Typo.caption>
                            <Typo.h5 as="p" {...stylex.props(styles.characterName)}>
                              {character.name}
                            </Typo.h5>
                            <Typo.txtS as="span" {...stylex.props(styles.subtitle)}>
                              {character.job}
                            </Typo.txtS>
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
                            <Typo.caption as="p" {...stylex.props(styles.note)}>
                              등급은 디자인 예시입니다. 실제 자동 평가는 연결하지 않았습니다.
                            </Typo.caption>
                          )}
                        </>
                      )}
                      {face === '스킬트리' && (
                        <div {...stylex.props(styles.pending)}>
                          <Typo.h6 as="strong">스킬트리</Typo.h6>
                          <Typo.txtS as="span">구성 예정</Typo.txtS>
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
