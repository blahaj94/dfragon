import { Typo, shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { styles } from './WindowBar.style'

/**
 * 상세 창 같은 보조 창의 상단 바. dfragon-design layout.md의 보조 창대로 로고 마크와 창 제목만 두고
 * 오른쪽 끝은 OS 창 버튼 자리로 비운다. 바 전체가 창을 옮기는 끌기 영역이다.
 */
export function WindowBar({ title }: { title: string }): React.JSX.Element {
  return (
    <header {...stylex.props(styles.bar)}>
      <div aria-hidden="true" {...stylex.props(styles.dragArea)} />
      <span aria-hidden="true" {...stylex.props(styles.mark, shapes.cutTopRight)} />
      <Typo.h6 as="h1" weight={700} {...stylex.props(styles.title)}>
        {title}
      </Typo.h6>
    </header>
  )
}
