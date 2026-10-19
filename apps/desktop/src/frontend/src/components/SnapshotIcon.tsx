import type { SVGProps } from 'react'

// 스냅샷(dfragon-design icons.md의 DFragon 아이콘). 네 모서리 꺾쇠와 가운데 채운 사각형이다. 스냅샷에 없는
// 모험단 경고 칩은 가운데 사각형 없이 꺾쇠만 쓴다.
export function SnapshotIcon({
  center = true,
  ...props
}: SVGProps<SVGSVGElement> & { center?: boolean }): React.JSX.Element {
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
      <path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
      {center && <rect x="9" y="9" width="6" height="6" fill="currentColor" stroke="none" />}
    </svg>
  )
}
