const CANONICAL_CODE_PATTERN = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/

export type ReturnTarget = { kind: 'web' | 'app'; href: string }

/** 서버가 반환한 원문을 검사한 뒤에만 로그인 종료와 이동을 허용한다. */
export function parseReturnTarget(value: string, webTarget: string | undefined): ReturnTarget {
  const isWebTarget = webTarget !== undefined && webTarget.length > 0
  const failureMessage = isWebTarget
    ? '웹 복귀 주소를 확인하지 못했습니다.'
    : '앱 복귀 주소를 확인하지 못했습니다.'
  try {
    const url = new URL(value)
    if (isWebTarget) {
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
        throw new Error(failureMessage)
      }
      const href = url.href

      return { kind: 'web', href }
    }

    const code = url.searchParams.get('code')
    if (
      Number(url.port) < 1024 ||
      code === null ||
      !CANONICAL_CODE_PATTERN.test(code) ||
      value !== `http://127.0.0.1:${url.port}/auth/callback?code=${code}`
    ) {
      throw new Error(failureMessage)
    }
    const href = url.href

    return { kind: 'app', href }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(failureMessage)
    }
    throw error
  }
}
