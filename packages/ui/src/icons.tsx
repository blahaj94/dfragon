import type { SVGProps } from 'react'

// 공용 Component 안에서만 쓰는 선 아이콘. 모서리는 각지게(square, miter) 그린다.
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>

function LineIcon({ d, ...props }: IconProps & { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={d} />
    </svg>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return <LineIcon d="m6 9 6 6 6-6" {...props} />
}

export function CheckIcon(props: IconProps) {
  return <LineIcon d="m5 12 5 5 9-10" {...props} />
}

export function DashIcon(props: IconProps) {
  return <LineIcon d="M6 12h12" {...props} />
}

export function CloseIcon(props: IconProps) {
  return <LineIcon d="M6 6l12 12M18 6 6 18" {...props} />
}

// 대기 상태 표시. 위아래로 맞붙은 두 삼각형으로 그린 각진 모래시계다(dfragon-design icons.md).
export function HourglassIcon(props: IconProps) {
  return <LineIcon d="M6 3h12l-6 9zM12 12l6 9H6z" {...props} />
}
