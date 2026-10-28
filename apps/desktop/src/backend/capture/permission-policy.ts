import type { Session } from 'electron'

export function registerCapturePermissions(
  session: Pick<Session, 'setPermissionCheckHandler' | 'setPermissionRequestHandler'>
): void {
  // Electron media 권한은 요청한 API 종류와 source를 구별하지 못하므로 제품 Rule에 따라 모든 권한 확인과 요청을 거절한다.
  session.setPermissionCheckHandler(() => false)
  session.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false)
  })
}
