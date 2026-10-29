import type { SVGProps } from 'react'

export function CopyIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
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
      <rect x="9" y="9" width="12" height="12" />
      <path d="M15 5V3H3v12h2" />
    </svg>
  )
}
