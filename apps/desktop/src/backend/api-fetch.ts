import { session } from 'electron'

// Chromium uses the OS certificate/proxy configuration, including trusted development CAs.
// A nonpersistent partition keeps API traffic separate from renderer cookies and caches.
export const fetchApi: typeof globalThis.fetch = (input, init) => {
  const apiSession = session.fromPartition('ldb-api', { cache: false })
  const request = input instanceof URL ? input.href : input
  return apiSession.fetch(request, { ...init, bypassCustomProtocolHandlers: true })
}
