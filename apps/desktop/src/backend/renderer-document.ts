const UNSAFE_RENDERER_URL_CHARACTER_PATTERN = /[\s\\]/u
const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]']

function hasUnsafeCharacter(value: string): boolean {
  return (
    UNSAFE_RENDERER_URL_CHARACTER_PATTERN.test(value) ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0)

      return code <= 31 || code === 127
    })
  )
}

export function validateDevRendererUrl(value: string): string {
  const url = hasUnsafeCharacter(value) ? null : URL.parse(value)
  // Electron Vite는 dev origin을 마지막 slash 없이 제공한다.
  const isViteOrigin = value === url?.origin && url.href === `${url.origin}/`
  if (
    url === null ||
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    !LOOPBACK_HOSTNAMES.includes(url.hostname) ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    (value !== url.href && !isViteOrigin)
  ) {
    throw new Error('Invalid local renderer URL')
  }

  return url.href
}
