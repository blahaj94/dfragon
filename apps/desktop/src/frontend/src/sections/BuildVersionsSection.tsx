import * as stylex from '@stylexjs/stylex'
import { ActionButton, Typo } from '@dfragon/ui'
import { useBuildVersions } from '../hooks/useBuildVersions'
import { BuildVersionList } from '../components/BuildVersionList'
import { styles } from './BuildVersionsSection.style'

export function BuildVersionsSection(): React.JSX.Element {
  const versions = useBuildVersions()

  return (
    <>
      <div {...stylex.props(styles.heading)}>
        <Typo.h4 as="h2">버전 정보</Typo.h4>
        <ActionButton
          size="small"
          variant="neutralWeak"
          disabled={versions.status === 'loading'}
          onClick={versions.refresh}
        >
          <Typo.txtS as="span" weight={700}>
            새로고침
          </Typo.txtS>
        </ActionButton>
      </div>
      <Typo.txtS as="p" {...stylex.props(styles.description)}>
        앱과 각 서버에서 현재 실행 중인 코드의 커밋을 확인할 수 있습니다. 서버는 서로 다른 버전으로
        배포될 수 있습니다.
      </Typo.txtS>
      {versions.status === 'loading' && (
        <Typo.txtS role="status">버전 정보를 불러오는 중입니다.</Typo.txtS>
      )}
      {versions.status === 'unavailable' && (
        <Typo.txtM role="status">이 실행 환경에서는 버전 정보를 조회할 수 없습니다.</Typo.txtM>
      )}
      {versions.status === 'error' && (
        <Typo.txtM role="alert">
          버전 정보를 불러오지 못했습니다.
          {versions.snapshot != null && ' 아래 정보는 이전 조회 결과입니다.'}
        </Typo.txtM>
      )}
      {versions.snapshot != null && <BuildVersionList snapshot={versions.snapshot} />}
    </>
  )
}
