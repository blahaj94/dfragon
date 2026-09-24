export const DEVELOPER_EVENTS = {
  RETRY: 'RETRY',
  SET_ENABLED: 'SET_ENABLED',
  REFRESH: 'REFRESH',
  SAVE_LABEL: 'SAVE_LABEL',
  SET_SAMPLE_EXCLUDED: 'SET_SAMPLE_EXCLUDED',
  EVALUATE: 'EVALUATE',
  PREPROCESSING_CHANGED: 'PREPROCESSING_CHANGED',
  CANCEL: 'CANCEL',
  IMAGE_EVALUATED: 'IMAGE_EVALUATED'
} as const

export const DEVELOPER_ERRORS = {
  PREVIEW_FAILED: 'preview-failed',
  INVALID_SETTINGS: 'Invalid developer settings response',
  SETTINGS_API_UNAVAILABLE: 'Developer settings API unavailable',
  SAVE_REQUEST_MISSING: 'Developer sample save request missing',
  IMAGE_TOO_WIDE: 'Image aspect ratio too wide.',
  LOAD_SAMPLES: '테스트 이미지를 불러오지 못했습니다. 다시 불러와 주세요.',
  SAVE_SAMPLE: '저장하지 못했습니다. 입력은 유지됩니다. 다시 시도해 주세요.',
  PREPARE_MODEL: '모델을 준비하지 못했습니다. 다시 평가해 주세요.'
} as const
