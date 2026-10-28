import type { SVGProps } from 'react'

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
