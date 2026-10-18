import type { SVGProps } from 'react'

// 마름모 해(dfragon-design icons.md의 DFragon 아이콘). 가운데 마름모와 여덟 방향의 짧은 선이다.
export function SunIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
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
      <polygon points="12 7 17 12 12 17 7 12" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
      <path d="m5 5 1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" />
    </svg>
  )
}
