import { useLayoutEffect } from 'react'
import { useMachine } from '@xstate/react'
import { waitFor } from 'xstate'
import { DEVELOPER_EVENTS, DEVELOPER_ERRORS } from '../constants/developer'
import type { DeveloperSample } from '../../../preload/common/types/developer'
import type { DeveloperEvaluation, EvaluationPreprocessing } from '../lib/developer-evaluation'
import { developerEvaluationMachine } from '../lib/developer-evaluation-machine'

export function useDeveloperEvaluation(): {
  results: Record<string, DeveloperEvaluation>
  running: boolean
  canceled: boolean
  preprocessing: EvaluationPreprocessing
  progress: { done: number; total: number }
  error: string
  setPreprocessing: (value: EvaluationPreprocessing) => void
  evaluate: (samples: readonly DeveloperSample[]) => Promise<void>
  cancel: () => void
} {
  const [snapshot, send, actor] = useMachine(developerEvaluationMachine)
  // React가 actor 구독을 정리하기 전에 실행을 종료하여 기다리는 호출도 완료한다.
  useLayoutEffect(
    () => () => {
      send({ type: DEVELOPER_EVENTS.CANCEL })
    },
    [send]
  )

  async function evaluate(samples: readonly DeveloperSample[]): Promise<void> {
    const request = {}
    send({ type: DEVELOPER_EVENTS.EVALUATE, samples, request })
    await waitFor(
      actor,
      (state) =>
        state.status !== 'active' || state.context.request !== request || !state.matches('running')
    )
  }

  return {
    results: snapshot.context.results,
    running: snapshot.matches('running'),
    canceled: snapshot.matches('canceled'),
    preprocessing: snapshot.context.preprocessing,
    progress: snapshot.context.progress,
    error: snapshot.matches('failed') ? DEVELOPER_ERRORS.PREPARE_MODEL : '',
    setPreprocessing: (value) => send({ type: DEVELOPER_EVENTS.PREPROCESSING_CHANGED, value }),
    evaluate,
    cancel: () => send({ type: DEVELOPER_EVENTS.CANCEL })
  }
}
