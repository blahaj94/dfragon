/// <reference types="vite/client" />

declare module 'virtual:dfragon-desktop-licenses' {
  const entries: import('@dfragon/licenses/types').NoticeEntry[]
  export default entries
}
