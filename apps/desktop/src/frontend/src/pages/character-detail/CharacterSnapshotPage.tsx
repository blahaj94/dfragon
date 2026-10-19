import { Button, CardFrame, Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useCharacterDetail } from '../../hooks/useCharacterDetail'
import { CharacterDetailPanel } from '../../sections/CharacterDetailPanel'
import { styles } from './CharacterSnapshotPage.style'

const closeWindow = (): void => window.close()

// 제품 상세 창. 창을 열 때 main이 넘긴 정보를 한 번 읽어 패널에 그리고, 이 창에서는 다시 조회하지 않는다.
export function CharacterSnapshotPage(): React.JSX.Element {
  const detail = useCharacterDetail()
  if (detail.status === 'ready') {
    const { character, card, itemTexts, skills, freshness } = detail.snapshot

    return (
      <CharacterDetailPanel
        character={character}
        card={card}
        itemTexts={itemTexts}
        skills={skills}
        fetchedAt={freshness.lastSuccessfulFetchAt}
        onClose={closeWindow}
      />
    )
  }

  return (
    <div {...stylex.props(styles.page)}>
      <CardFrame as="article" aria-label="캐릭터 상세">
        <div aria-hidden="true" {...stylex.props(styles.dragArea)} />
        <div {...stylex.props(styles.body)}>
          {detail.status === 'loading' ? (
            <Typo.txtM role="status">캐릭터 정보를 불러오는 중입니다.</Typo.txtM>
          ) : (
            <>
              <Typo.txtM role="alert">
                캐릭터 정보를 불러오지 못했습니다. 이 창을 닫고 캐릭터 카드를 다시 선택해 주세요.
              </Typo.txtM>
              <Button size="sm" onClick={closeWindow} {...stylex.props(styles.close)}>
                닫기
              </Button>
            </>
          )}
        </div>
      </CardFrame>
    </div>
  )
}
