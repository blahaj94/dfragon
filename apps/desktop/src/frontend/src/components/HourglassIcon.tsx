import type { SVGProps } from 'react'

// 각진 모래시계(dfragon-design icons.md의 DFragon 아이콘). 카드의 인식 대기를 중립색으로 보인다. 확인 필요,
// 창을 찾는 중 같은 주의 상태는 이 아이콘 대신 주의 색이 맡는다. 위아래로 맞붙은 두 삼각형이다.
export function HourglassIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      {...props}
    >
      <path d="M6 3h12l-6 9zM12 12l6 9H6z" />
    </svg>
  )
}
