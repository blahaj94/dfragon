/// <reference types="electron-vite/node" />
// Renderer 통합 테스트가 캡처 IPC를 함께 검사해 web 타입 검사에도 `?asset` 선언이 필요하다.
import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import {
  cropDNFRaidParticipantNicknames,
  type DNFParticipantFrame,
  type DNFRaidParticipantCropResult
} from '@dfragon/lib'
import raidHeadingPath from './raid-heading.png?asset'

let raidHeading: DNFParticipantFrame | null = null

// 함께 보관한 UI 0% 무손실 열 제목을 한 번만, 감마와 alpha 변환 없이 읽는다.
function getRaidHeading(): DNFParticipantFrame {
  if (raidHeading == null) {
    const { width, height, data } = PNG.sync.read(readFileSync(raidHeadingPath))
    raidHeading = { width, height, rgba: data }
  }

  return raidHeading
}

/**
 * 한 프레임에서 12행 공대 상세 창을 찾고 참가 행의 닉네임 원본을 복사한다. 개발자 작업 공간의 공대원창
 * 크롭과 일반 공대 캡처가 같은 검출과 크롭을 쓴다.
 */
export function cropRaidWindowNicknames(frame: DNFParticipantFrame): DNFRaidParticipantCropResult {
  return cropDNFRaidParticipantNicknames(frame, getRaidHeading())
}
