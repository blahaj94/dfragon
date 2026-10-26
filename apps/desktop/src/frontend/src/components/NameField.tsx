import { Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { styles } from './NameField.style'

/** 칸 테두리 상태. 찾음은 투명, 이름 수정 중은 크림, 인식 대기는 회색, 검색 실패는 노랑, 빈 자리는 회색 점선이다. */
export type NameFieldTone = 'default' | 'selected' | 'waiting' | 'failure' | 'vacant'

export type NameFieldProps = Omit<ComponentPropsWithoutRef<'input'>, 'size'> & {
  /** 칸 테두리 상태. @default 'default' */
  tone?: NameFieldTone
  /** 칸 안 왼쪽에 둘 요소 */
  left?: ReactNode
  /** 칸 안 오른쪽에 둘 요소. 카드는 여기에 `ServerSelect`(`variant="field"`)를 넘긴다. */
  right?: ReactNode
}

/**
 * 캐릭터 카드의 이름 입력 칸. 높이 20의 한 칸 안에 입력과 `left`, `right` 요소를 두고, 테두리가 `tone`을
 * 따른다. 나머지 props는 안쪽 `input`에 그대로 넘기므로 조회 시점과 조합 중 Enter 같은 동작은 쓰는 쪽이
 * 정한다.
 */
export function NameField({
  tone = 'default',
  left,
  right,
  ...inputProps
}: NameFieldProps): React.JSX.Element {
  return (
    <div
      {...stylex.props(
        styles.field,
        tone === 'selected' && styles.fieldSelected,
        tone === 'waiting' && styles.fieldWaiting,
        tone === 'failure' && styles.fieldFailure,
        tone === 'vacant' && styles.fieldVacant
      )}
    >
      {left}
      <Typo.caption as="input" weight={700} {...inputProps} {...stylex.props(styles.name)} />
      {right}
    </div>
  )
}
