import { ActionButton } from '@ldb/ui'
import * as stylex from '@stylexjs/stylex'
import { DetailDeck } from '../../sections/cards/DetailDeck'
import type { CardCharacter } from '../../components/cards/types'
import { styles } from './CharacterDetailPage.style'

export function CharacterDetailPage({
  character,
  onClose
}: {
  character: CardCharacter
  onClose: () => void
}): React.JSX.Element {
  return (
    <>
      <div {...stylex.props(styles.title)}>
        <span>캐릭터 상세 · 합성 데이터 미리보기</span>
        <ActionButton size="xsmall" variant="ghost" aria-label="상세 닫기" onClick={onClose}>
          ×
        </ActionButton>
      </div>
      <DetailDeck character={character} />
    </>
  )
}
