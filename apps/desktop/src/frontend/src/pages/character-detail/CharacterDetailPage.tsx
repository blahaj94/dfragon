import { useState } from 'react'
import { serverNames } from '../../constants/servers'
import { CharacterDetailPanel } from '../../sections/CharacterDetailPanel'
import type { CardCharacter } from '../../types/cards'

// 미리보기 상세 창을 연 시각보다 12초 앞의 조회 시각. 캔버스 상세 창 보드의 `12초 전`을 보인다.
const PREVIEW_FETCH_AGE_MS = 12_000

const closeWindow = (): void => window.close()

// 합성 미리보기의 상세 창. 제품 상세 창과 같은 패널에 합성 카드 값과 로컬 아이템 그림을 넣는다.
export function CharacterDetailPage({
  character
}: {
  character: CardCharacter
}): React.JSX.Element {
  const [fetchedAt] = useState(() => new Date(Date.now() - PREVIEW_FETCH_AGE_MS).toISOString())

  return (
    <CharacterDetailPanel
      character={{
        characterName: character.name,
        serverName: serverNames[character.serverId],
        adventureName: character.adventure,
        guildName: character.guild ?? null,
        jobGrowName: character.job,
        fame: character.fame,
        imageUrl: character.image
      }}
      card={character.card}
      itemTexts={character.itemTexts}
      fetchedAt={fetchedAt}
      itemImages={character.itemImages}
      onClose={closeWindow}
    />
  )
}
