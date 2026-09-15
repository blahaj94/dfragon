import type { Session, WebContents } from 'electron'

type CapturePermission = (contents: WebContents, requestingUrl: string) => boolean

export function registerCapturePermissions(
  session: Pick<Session, 'setPermissionCheckHandler' | 'setPermissionRequestHandler'>,
  consumePermission?: CapturePermission
): void {
  session.setPermissionCheckHandler(() => false)
  session.setPermissionRequestHandler((contents, permission, callback, details) => {
    const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined
    const isCaptureCandidate =
      permission === 'media' &&
      details.isMainFrame === true &&
      Array.isArray(mediaTypes) &&
      mediaTypes.length === 0
    // 빈 mediaTypes는 display/legacy API를 구별하지 못한다. 제품 Rule의 신뢰 한계다.
    const allowed =
      isCaptureCandidate && consumePermission?.(contents, details.requestingUrl) === true
    callback(allowed)
  })
}
