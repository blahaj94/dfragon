import { useEffect, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { ProgressCircle, Typo } from '@dfragon/ui'
import type {
  DeveloperPartyCollectionStatus,
  DeveloperUploadStatus
} from '../../../preload/common/types/developer'
import { getDeveloperCollectionErrorMessage } from '../lib/developer-party'
import { CheckIcon } from './CheckIcon'
import { styles } from './DeveloperUploadNotice.style'

const titles: Record<DeveloperUploadStatus, string> = {
  signedOut: '로컬 저장 완료 · 서버 전송 안 됨',
  uploading: '서버 업로드 중',
  uploaded: '서버 업로드 완료',
  failed: '서버 업로드 확인 실패',
  ownerRequired: '서버 전송 안 됨 · 계정 확인 필요',
  storageFull: '서버 전송 안 됨 · 저장 공간 부족'
}

const messages: Record<DeveloperUploadStatus, string> = {
  signedOut: '로컬에 저장했습니다. 자료실 전송은 앱 로그인 후 다음 캡처부터 시작합니다.',
  uploading: 'OCR 자료실로 전송 중입니다. 완료 후 다음 크롭을 저장할 수 있습니다.',
  uploaded: '원본 이미지와 선택한 크롭을 OCR 자료실에 업로드했습니다.',
  failed: '로컬 크롭은 저장했습니다. 서버 저장 여부를 확인하지 못했습니다. 자료실을 확인해 주세요.',
  ownerRequired: '로컬 크롭은 저장했습니다. 자료실에 등록된 계정으로 로그인해 주세요.',
  storageFull: '로컬 크롭은 저장했습니다. OCR 자료실의 저장 용량이 가득 찼습니다.'
}

export function DeveloperUploadNotice({
  collection
}: {
  collection: DeveloperPartyCollectionStatus | null
}): React.JSX.Element {
  const status = collection?.upload
  const capture = collection?.capture
  const busy = capture != null ? capture.phase !== 'finished' : status === 'uploading'
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!busy) {
      return
    }
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [busy, capture?.startedAt])
  const elapsed = capture
    ? Math.max(0, Math.floor((now - Date.parse(capture.startedAt)) / 1000))
    : 0
  let title = status ? titles[status] : '캡처 대기'
  let detail = status
    ? messages[status]
    : '앱 로그인 중 Print Screen을 누르면 게임 원본 이미지와 선택한 크롭을 OCR 자료실에 바로 전송합니다.'
  let tone: 'idle' | 'busy' | 'success' | 'warning' =
    status === 'uploaded' ? 'success' : status ? 'warning' : 'idle'
  if (busy) {
    tone = 'busy'
    if (capture?.phase === 'capturing' || capture?.phase === 'saving') {
      title =
        capture.phase === 'capturing' ? 'Print Screen 입력 확인 · 캡처 중' : '로컬 크롭 저장 중'
      detail =
        '이번 캡처를 처리하고 있습니다. 완료 전까지 추가 Print Screen 입력은 저장하지 않습니다.'
    }
  } else if (collection?.error && status !== 'failed') {
    tone = 'warning'
    title = capture ? '캡처·저장 실패' : '캡처 준비 확인 필요'
    detail = getDeveloperCollectionErrorMessage(collection.error)
  }

  return (
    <section aria-label="캡처 및 업로드 상태" {...stylex.props(styles.notice, styles[tone])}>
      <div aria-hidden="true" {...stylex.props(styles.icon)}>
        {busy ? (
          <ProgressCircle size="24" tone="brand" />
        ) : tone === 'success' ? (
          <CheckIcon width={24} height={24} />
        ) : tone === 'warning' ? (
          '!'
        ) : (
          '↑'
        )}
      </div>
      <div {...stylex.props(styles.content)}>
        <div role="status" aria-atomic="true">
          <Typo.txtM as="p" weight={700}>
            {title}
          </Typo.txtM>
          <Typo.txtS as="p">{detail}</Typo.txtS>
        </div>
        {capture && (
          <div {...stylex.props(styles.metadata)}>
            <Typo.caption>
              캡처 #{capture.attempt} ·{' '}
              {new Date(capture.startedAt).toLocaleTimeString('ko-KR', { hour12: false })}
            </Typo.caption>
            {busy ? (
              <Typo.caption>처리 중 · {elapsed}초 경과</Typo.caption>
            ) : (
              (collection?.lastSavedCount ?? 0) > 0 && (
                <Typo.caption>로컬 크롭 {collection?.lastSavedCount}개 저장</Typo.caption>
              )
            )}
          </div>
        )}
        {busy && elapsed >= 5 && (
          <Typo.caption role="status">
            처리가 오래 걸리고 있습니다. 완료 전까지 추가 캡처는 저장되지 않습니다.
          </Typo.caption>
        )}
      </div>
    </section>
  )
}
