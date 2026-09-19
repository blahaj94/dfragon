/// <reference types="vite/client" />

declare module 'virtual:ldb-desktop-licenses' {
  const entries: import('@ldb/licenses/types').NoticeEntry[]
  export default entries
}
