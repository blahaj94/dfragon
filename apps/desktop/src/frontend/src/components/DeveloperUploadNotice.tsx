import { Typo } from '@dfragon/ui'
import type { DeveloperUploadStatus } from '../../../preload/common/types/developer'

const messages: Record<DeveloperUploadStatus, string> = {
  signedOut: '로컬에 저장했습니다. 자료실 전송은 앱 로그인 후 다음 캡처부터 시작합니다.',
  uploading: 'OCR 자료실로 전송 중입니다. 완료 후 다음 크롭을 저장할 수 있습니다.',
  uploaded: '원본 이미지와 선택한 크롭을 OCR 자료실에 업로드했습니다.',
  failed: '로컬 크롭은 저장했습니다. 서버 저장 여부를 확인하지 못했습니다. 자료실을 확인해 주세요.',
  ownerRequired: '로컬 크롭은 저장했습니다. 자료실에 등록된 계정으로 로그인해 주세요.',
  storageFull: '로컬 크롭은 저장했습니다. OCR 자료실의 저장 용량이 가득 찼습니다.'
}

export function DeveloperUploadNotice({
  status
}: {
  status?: DeveloperUploadStatus
}): React.JSX.Element {
  return (
    <Typo.txtS as="p" role="status">
      {status
        ? messages[status]
        : '앱 로그인 중 Print Screen을 누르면 게임 원본 이미지와 선택한 크롭을 OCR 자료실에 바로 전송합니다.'}
    </Typo.txtS>
  )
}
