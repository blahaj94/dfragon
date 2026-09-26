import type { Capture } from '../src/model.js'

export const OCR_MESSAGES = {
  uploaded: '업로드했습니다. 정답을 입력할 수 있습니다.',
  saved: '저장했습니다.',
  splitAssigned: '같은 닉네임의 분할을 변경했습니다.',
  selectPng: '원본 PNG를 선택해 주세요.',
  pngTooLarge: '원본 PNG는 16 MiB 이하로 선택해 주세요.',
  fileReadFailed: '파일을 읽지 못했습니다.',
  confirmLabelChange:
    '정답을 바꾸면 새 닉네임의 분할을 따릅니다. 배정이 없으면 미배정으로 바뀝니다. 저장할까요?',
  confirmSplit: (split: string) => `같은 정답의 모든 이미지를 ${split}에 배정합니다. 계속할까요?`
} as const

export const OCR_CACHE = { staleTimeMs: 30_000, gcTimeMs: 5 * 60_000 } as const

export const OCR_CAPTURE_LABELS = {
  hud: 'HUD',
  participants: '파티원창',
  raid: '공대원창'
} as const satisfies Record<Capture['kind'], string>
