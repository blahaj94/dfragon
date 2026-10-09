import { readChannelNameFromEnvironment } from './build/channels'
import { createBuilderConfig } from './build/electron-builder-config'

// 기본 진입 파일. DFRAGON_CHANNEL 환경변수로 채널을 고르고 비우면 배포 채널을 만든다.
export default createBuilderConfig(readChannelNameFromEnvironment())
