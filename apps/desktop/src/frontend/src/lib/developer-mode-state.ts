import type { SnapshotFrom } from 'xstate'
import type { developerModeMachine } from './developer-mode-machine'

/** 설정 저장 중에도 기존 화면 상태를 유지하도록 machine 상태를 화면 상태로 변환한다. */
export function getDeveloperModeStatus(
  value: SnapshotFrom<typeof developerModeMachine>['value']
): 'loading' | 'ready' | 'unavailable' | 'error' {
  return value === 'updating' ? 'ready' : value
}
