import { CardFrame, NumericText, Typo } from '@dfragon/ui'
import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { styles } from './DetailDeck.style'
import { serverNames } from '../constants/servers'
import { detailFaces } from '../constants/cards'
import type { CardCharacter } from '../types/cards'
import { EquipmentGrid } from './EquipmentGrid'
import { InvestmentTable } from '../components/InvestmentTable'
import { toCharacterFace, toInvestmentRows } from '../lib/card-faces'

// 명성, 장비 점수 값. 알 수 없으면 같은 크기의 `—`를 흐리게 둔다.
function ScoreValue({ value }: { value: number | null | undefined }): React.JSX.Element {
  if (value == null) {
    return <dd {...stylex.props(styles.score, styles.scoreMissing)}>—</dd>
  }

  return (
    <dd {...stylex.props(styles.score)}>
      <NumericText value={value} />
    </dd>
  )
}

export function DetailDeck({ character }: { character: CardCharacter }): React.JSX.Element {
  const [selected, setSelected] = useState(0)
  const order = [
    selected,
    ...detailFaces.map((_, index) => index).filter((index) => index !== selected)
  ]

  return (
    <>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.identity)}>
          <div {...stylex.props(styles.nameRow)}>
            <Typo.h3 as="h2" {...stylex.props(styles.name)}>
              {character.name}
            </Typo.h3>
            <Typo.caption weight={600} {...stylex.props(styles.server)}>
              {serverNames[character.serverId]}
            </Typo.caption>
          </div>
          <div {...stylex.props(styles.subtitle)}>
            <Typo.txtS as="span" weight={600} {...stylex.props(styles.adventure)}>
              {character.adventure}
            </Typo.txtS>
            <span aria-hidden="true" {...stylex.props(styles.divider)} />
            <Typo.txtS as="span">Lv.115</Typo.txtS>
            <span aria-hidden="true" {...stylex.props(styles.divider)} />
            <Typo.txtS as="span">{character.job}</Typo.txtS>
          </div>
        </div>
        <dl {...stylex.props(styles.scores)}>
          <div {...stylex.props(styles.scoreItem)}>
            <Typo.caption as="dt" {...stylex.props(styles.label)}>
              장비 점수
            </Typo.caption>
            <ScoreValue value={toCharacterFace(character.card, 'long').score.value} />
          </div>
          <div {...stylex.props(styles.scoreItem)}>
            <Typo.caption as="dt" {...stylex.props(styles.label)}>
              명성
            </Typo.caption>
            <ScoreValue value={character.fame} />
          </div>
        </dl>
      </header>
      <div aria-label="캐릭터 상세 카드" {...stylex.props(styles.deck)}>
        {detailFaces.map((face, index) => {
          const active = selected === index
          const rank = order.indexOf(index)

          return (
            <section key={face} aria-label={`${face} 카드`} {...stylex.props(styles.card(rank))}>
              <CardFrame>
                <button
                  type="button"
                  aria-label={`${face} 카드 선택`}
                  aria-pressed={active}
                  onClick={() => setSelected(index)}
                  {...stylex.props(styles.selector, active && styles.selectorActive)}
                >
                  {!active && (
                    <>
                      <Typo.txtS as="span" weight={700} {...stylex.props(styles.tabLabel)}>
                        {face}
                      </Typo.txtS>
                      <span {...stylex.props(styles.number)}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </>
                  )}
                </button>
                {active && (
                  <>
                    <Typo.h5 as="h3" weight={700} {...stylex.props(styles.title)}>
                      {face}
                    </Typo.h5>
                    <div {...stylex.props(styles.content)}>
                      {(face === '장비' || face === '서약') && (
                        <>
                          <EquipmentGrid character={character} large oath={face === '서약'} />
                          <div {...stylex.props(styles.cardIdentity)}>
                            <Typo.caption weight={600} {...stylex.props(styles.cardAdventure)}>
                              {character.adventure}
                            </Typo.caption>
                            <Typo.h5 as="p" weight={700} {...stylex.props(styles.characterName)}>
                              {character.name}
                            </Typo.h5>
                            <Typo.txtS as="span" {...stylex.props(styles.job)}>
                              {character.job}
                            </Typo.txtS>
                          </div>
                        </>
                      )}
                      {(face === '강화' || face === '마법부여') && (
                        <>
                          <InvestmentTable
                            rows={toInvestmentRows(character.card)}
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
                {/* 앞 카드의 오른쪽 끝을 뒤 카드 위에 그어 겹친 카드를 나눈다. */}
                <span aria-hidden="true" {...stylex.props(styles.edge)} />
              </CardFrame>
            </section>
          )
        })}
      </div>
    </>
  )
}
