import * as stylex from '@stylexjs/stylex'
import { WindowBar } from '../../components/WindowBar'
import { DetailDeck } from '../../sections/DetailDeck'
import type { CardCharacter } from '../../types/cards'
import { styles } from './CharacterDetailPage.style'

// 합성 미리보기의 상세 창. 제품 상세 창과 같은 보조 창 상단 바 아래에 카드 더미를 둔다.
export function CharacterDetailPage({
  character
}: {
  character: CardCharacter
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.page)}>
      <WindowBar title="캐릭터 상세" />
      <main {...stylex.props(styles.content)}>
        <DetailDeck character={character} />
      </main>
    </div>
  )
}
