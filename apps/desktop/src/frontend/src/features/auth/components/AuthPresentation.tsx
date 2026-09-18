import { SupportingText } from '@ldb/ui'
import type { AuthNotice, AuthPresentationProps } from '../types/presentation'
import { AuthPhaseContent } from './AuthPhaseContent'

const notices: Record<AuthNotice, string> = {
  LOGIN_CANCELLED: '로그인을 취소했습니다. 로그인 방법을 선택해 다시 시작할 수 있습니다.',
  LOGIN_EXPIRED: '로그인 대기 시간이 만료됐습니다. 새 로그인을 시작해 주세요.',
  LOGIN_RETURN_INVALID:
    '앱으로 돌아온 로그인 정보를 확인하지 못했습니다. 새 로그인은 현재 시도를 취소한 뒤 시작합니다.',
  LOGIN_RESTART_REQUIRED: '로그인을 완료하지 못했습니다. 새 로그인을 시작해 주세요.',
  BROWSER_OPEN_FAILED: '로그인 창을 열지 못했습니다. 새 로그인을 시작해 주세요.',
  NETWORK_UNAVAILABLE: '네트워크 연결을 확인해 주세요.',
  AUTH_SERVICE_UNAVAILABLE: '인증 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  RESTORE_RETRY_REQUIRED: '로그인 상태 확인을 마치지 못했습니다. 다시 시도해 주세요.',
  REAUTH_REQUIRED: '다시 로그인이 필요합니다.',
  SECURE_STORAGE_UNAVAILABLE:
    '이 기기의 안전한 저장소를 사용할 수 없습니다. 저장소를 확인한 뒤 다시 시도해 주세요.',
  TOKEN_SAVE_FAILED:
    '로그인 정보를 안전하게 저장하지 못했습니다. 저장소 복구 후 새 로그인이 필요합니다.',
  LOCAL_CLEAR_UNCONFIRMED:
    '이 기기의 로그인 정보 삭제를 확인하지 못했습니다. 서버 로그아웃도 확인하지 못했습니다. 재시작 후 안전한 차단을 보장할 수 없습니다.',
  LOGOUT_SERVER_UNCONFIRMED: '이 기기 정보는 지웠지만 서버 로그아웃은 확인하지 못했습니다.'
}

export function AuthPresentation(props: AuthPresentationProps): React.JSX.Element {
  const { notice } = props.snapshot
  const hasNotice = notice != null
  return (
    <>
      <AuthPhaseContent {...props} />
      {hasNotice && (
        <div role="status">
          <SupportingText>{notices[notice]}</SupportingText>
        </div>
      )}
    </>
  )
}
