export type ReturnTarget = { kind: 'web' | 'app'; href: string }

/** Validates the configured return boundary before callers end the login or navigate. */
export function parseReturnTarget(url: URL, webTarget: string | undefined): ReturnTarget {
  if (webTarget !== undefined && webTarget.length > 0) {
    const target = new URL(webTarget)
    if (
      url.protocol !== 'https:' ||
      url.origin !== target.origin ||
      url.pathname !== target.pathname ||
      url.username ||
      url.password ||
      url.hash ||
      url.searchParams.size !== 1 ||
      !url.searchParams.has('code')
    ) {
      throw new Error('웹 복귀 주소를 확인하지 못했습니다.')
    }
    const href = url.href

    return { kind: 'web', href }
  }

  if (
    !['dfragon:', 'dfragon.dev:'].includes(url.protocol) ||
    url.host !== 'auth' ||
    url.pathname !== '/callback'
  ) {
    throw new Error('앱 복귀 주소를 확인하지 못했습니다.')
  }
  const href = url.href

  return { kind: 'app', href }
}
