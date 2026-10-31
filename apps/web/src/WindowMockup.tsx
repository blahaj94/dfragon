import { WindowMockup } from '@dfragon/desktop-site'
import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import { MockupHighlights } from './mockup-highlight/MockupHighlights'
import { styles } from './mockup-highlight/MockupHighlights.style'

// 여러 작업이 Desktop의 목업 컴포넌트를 함께 고치므로, 강조 표시는 목업을 감싸 바깥에서 덮어 그린다.
export default function HighlightedWindowMockup(): React.JSX.Element {
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  // App.tsx의 목업 section이 좁은 화면에서 가로로 스크롤하므로, 링을 그 section에 보이는 범위로 자른다.
  const scroller = root?.parentElement ?? null

  return (
    <div ref={setRoot} {...stylex.props(styles.wrapper)}>
      <WindowMockup />
      {root !== null && scroller !== null && <MockupHighlights root={root} scroller={scroller} />}
    </div>
  )
}
