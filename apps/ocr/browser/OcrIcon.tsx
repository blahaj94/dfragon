const paths = {
  upload: 'M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5',
  download: 'M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4',
  plus: 'M12 5v14M5 12h14',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3',
  check: 'm5 12 4 4 10-10',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  moon: 'M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z'
}

export function OcrIcon({ name, size = 18 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
      {name === 'sun' && <circle cx="12" cy="12" r="4" />}
    </svg>
  )
}
