import * as stylex from '@stylexjs/stylex'
import { Typo } from '@dfragon/ui'
import {
  BUILD_VERSION_SERVICES,
  type BuildVersions,
  type BuildVersionService,
  type ServerVersion
} from '../../../preload/common/types/build-versions'
import { styles } from './BuildVersionList.style'

const serviceNames = {
  api: '게임 API',
  accounts: '계정 서버 (accounts)',
  ocr: 'OCR 서버'
} as const satisfies Record<BuildVersionService, string>

function serverLabel(server: ServerVersion): string {
  if (server.status === 'unsupported') {

    return '버전 조회 미지원'
  }
  if (server.status === 'unavailable') {

    return '연결 확인 필요'
  }

  return server.commit ?? '커밋 정보 없음 (개발 빌드)'
}

export function BuildVersionList({ snapshot }: { snapshot: BuildVersions }): React.JSX.Element {

  return (
    <dl {...stylex.props(styles.list)}>
      <div {...stylex.props(styles.row)}>
        <Typo.txtS as="dt" weight={700}>
          Desktop 앱
        </Typo.txtS>
        <dd {...stylex.props(styles.value)}>
          <Typo.txtM as="p">버전 {snapshot.desktop.version}</Typo.txtM>
          <Typo.txtS as="p" {...stylex.props(styles.commit)}>
            {snapshot.desktop.commit ?? '소스 커밋 정보 없음'}
          </Typo.txtS>
          {snapshot.desktop.dirty && (
            <Typo.caption as="p" {...stylex.props(styles.notice)}>
              로컬 변경 포함 — 표시된 커밋 이후 수정된 코드가 있습니다.
            </Typo.caption>
          )}
        </dd>
      </div>
      {BUILD_VERSION_SERVICES.map((service) => (
        <div key={service} {...stylex.props(styles.row)}>
          <Typo.txtS as="dt" weight={700}>
            {serviceNames[service]}
          </Typo.txtS>
          <Typo.txtS as="dd" {...stylex.props(styles.value, styles.commit)}>
            {serverLabel(snapshot.servers[service])}
          </Typo.txtS>
        </div>
      ))}
    </dl>
  )
}
