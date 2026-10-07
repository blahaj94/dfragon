const ALPHA_VERSION_PATTERN = /^\d+\.\d+\.\d+-alpha(?:\.[0-9A-Za-z-]+)*(?:\+[0-9A-Za-z.-]+)?$/

/** 실전 표본 수집은 개발 실행과 alpha 패키지에서만 기본 활성화한다. */
export function isOcrCollectionEnabled(input: { isPackaged: boolean; version: string }): boolean {
  return !input.isPackaged || ALPHA_VERSION_PATTERN.test(input.version)
}
