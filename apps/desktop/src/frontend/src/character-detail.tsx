import '@dfragon/ui/tokens.css'
import '@dfragon/ui/foundation.css'
import './assets/fonts.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CharacterSnapshotPage } from './pages/character-detail/CharacterSnapshotPage'

// 상세 창은 테마와 관계없이 다크 카드 패널이라 테마를 정하지 않고 tokens.css의 다크 기본값으로 그린다.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CharacterSnapshotPage />
  </StrictMode>
)
