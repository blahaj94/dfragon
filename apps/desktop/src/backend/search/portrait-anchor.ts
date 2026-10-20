import type { CharacterFaceWindow } from '../../preload/common/types/search'

/** 네오플 zoom=1 캐릭터 이미지에서 파티 HUD 얼굴(정규화 26×26)이 놓이는 창의 좌상단 정수 좌표. */
export type PortraitAnchor = Readonly<{ x: number; y: number }>

// 600px 높이 기본 HUD의 얼굴 칸 크기이며 얼굴 비교가 정규화하는 크기와 같다.
const ANCHOR_FACE_SIZE = 26

/**
 * 기본 직업명별 얼굴 창 위치. 네오플 이미지는 200×230 캔버스에 캐릭터 발 위치가 고정이라 얼굴 높이는 기본
 * 체형에 따라 정해진다. 직업마다 실제 HUD 캡처 한 건을 그 캐릭터 이미지에 맞춰 잰 값이며 ±2px 오차가 있다.
 */
const PORTRAIT_ANCHORS: Readonly<Record<string, PortraitAnchor>> = {
  '거너(남)': { x: 85, y: 61 },
  '프리스트(남)': { x: 86, y: 66 },
  총검사: { x: 86, y: 70 },
  '거너(여)': { x: 83, y: 73 },
  마창사: { x: 81, y: 75 },
  '격투가(남)': { x: 89, y: 76 },
  도적: { x: 86, y: 77 },
  '귀검사(남)': { x: 84, y: 78 },
  '귀검사(여)': { x: 88, y: 87 },
  '프리스트(여)': { x: 84, y: 88 },
  '격투가(여)': { x: 88, y: 94 },
  '마법사(남)': { x: 83, y: 96 },
  아처: { x: 78, y: 98 },
  나이트: { x: 84, y: 101 },
  '마법사(여)': { x: 85, y: 108 }
}

/** 재지 않은 직업(외전, 신규 직업)이나 직업을 모르면 null이다. */
export function portraitAnchorOf(jobName: string | null): PortraitAnchor | null {
  if (jobName === null || !Object.hasOwn(PORTRAIT_ANCHORS, jobName)) {
    return null
  }

  return PORTRAIT_ANCHORS[jobName]
}

/** 색 비교 창이 없을 때 후보 줄이 대신 보일 직업별 얼굴 창. 직업 위치를 모르면 null이다. */
export function portraitFaceWindowOf(jobName: string | null): CharacterFaceWindow | null {
  const anchor = portraitAnchorOf(jobName)
  if (anchor === null) {
    return null
  }

  return { ...anchor, width: ANCHOR_FACE_SIZE, height: ANCHOR_FACE_SIZE }
}
