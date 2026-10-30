import type { SVGProps } from 'react'

function LineIcon({ children, ...props }: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      {...props}
    >
      {children}
    </svg>
  )
}

export function DownloadIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path d="M12 15V3m-5 7 5 5 5-5M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </LineIcon>
  )
}

export function ExternalLinkIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path d="M15 3h6v6m-11 5L21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </LineIcon>
  )
}
