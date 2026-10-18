import type * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, CSSProperties, ElementType } from 'react'

// 공개 props는 semantic 옵션과 ref를 유지하고 화면별 외형 override prop을 제외한다.
export type PublicProps<T extends ElementType> = Omit<
  ComponentPropsWithRef<T>,
  'style' | 'className'
>

// 공개 타입은 className, style을 받지 않지만, 기존 화면이 배치용 stylex.props를 펼쳐 넘기는
// 경로는 구현이 받아 자기 StyleX class 뒤에 합친다. 구현 함수만 이 타입을 받는다.
export type ForwardedStyle = {
  className?: string
  style?: CSSProperties
}

export function withForwardedStyle(
  own: ReturnType<typeof stylex.props>,
  { className, style }: ForwardedStyle
): ForwardedStyle {
  const classNames = [own.className, className].filter((name) => {
    const hasName = name != null && name !== ''

    return hasName
  })
  const hasStyle = own.style != null || style != null
  const mergedClassName = classNames.length > 0 ? classNames.join(' ') : undefined
  const mergedStyle = hasStyle ? { ...own.style, ...style } : undefined

  return { className: mergedClassName, style: mergedStyle }
}
