import { createPartyOcrWorker } from './ocr'
import { runSerialLoop } from './recognition'
import type { PartyOcrWorker } from '../types/capture'
import type { PartyFrameSource } from './party'
import type { WindowFrameResult } from '../../../preload/common/types/capture'
import { reportRendererDiagnostic } from './runtime-diagnostics'
import type { RendererDiagnosticCode } from '../../../preload/common/types/diagnostics'

type Worker = Awaited<ReturnType<typeof createPartyOcrWorker>>

export type CaptureSessionInput = {
  beginSearch: (signal: AbortSignal) => Promise<string | null>
  readFrame: (captureId: string) => Promise<WindowFrameResult>
  getIntervalMs: () => number
  recognizePartyNicknames: (
    frame: PartyFrameSource,
    worker: PartyOcrWorker,
    signal: AbortSignal
  ) => Promise<void>
}

export type CaptureSessionEvent =
  | { type: 'FRAME_REQUESTED' }
  | { type: 'OCR_START' }
  | { type: 'READY'; status: string }
  | { type: 'FAILED'; status: string }

/** 프레임 획득 상태를 캡처 화면의 고정 안내로 바꾼다. */
function frameStatus(result: WindowFrameResult): string {
  if (result.kind === 'frame') {
    return `캡처 중, ${result.image.width}×${result.image.height}`
  }

  if (result.kind === 'waiting') {
    if (result.reason === 'covered') {
      return '게임 창이 다른 창에 가려져 있습니다. 게임 창을 앞으로 가져오면 캡처를 이어갑니다.'
    }

    return '게임 화면을 기다리고 있습니다. 창이 최소화되거나 닫히지 않았는지 확인해 주세요.'
  }

  return '화면 캡처는 Windows에서 사용할 수 있습니다.'
}

/** 한 캡처 수명에서 네이티브 프레임을 직렬로 읽고 OCR과 검색에 전달한다. */
export function startPartyCaptureSession(
  input: CaptureSessionInput,
  report: (event: CaptureSessionEvent) => void
): () => void {
  const controller = new AbortController()
  const { signal } = controller
  let worker: Worker | null = null

  function release(): void {
    controller.abort()
    const ownedWorker = worker
    worker = null
    void ownedWorker?.terminate()
  }

  async function start(): Promise<void> {
    let failureMessage = '검색을 시작하지 못했습니다. 창을 다시 선택해 주세요.'
    let diagnostic: RendererDiagnosticCode = 'CAPTURE_START_FAILED'
    try {
      const captureId = await input.beginSearch(signal)
      signal.throwIfAborted()
      if (captureId === null) {
        throw new Error(failureMessage)
      }
      report({ type: 'FRAME_REQUESTED' })
      failureMessage = '캡처 연결이 종료되었습니다. 창을 다시 선택해 주세요.'
      diagnostic = 'CAPTURE_READ_FAILED'
      const initialFrame = await input.readFrame(captureId)
      signal.throwIfAborted()
      if (initialFrame.kind === 'unsupported') {
        failureMessage = frameStatus(initialFrame)
        throw new Error(failureMessage)
      }
      report({ type: 'OCR_START' })
      diagnostic = 'OCR_FAILED'
      failureMessage = '글자 인식을 준비하지 못했습니다. 캡처를 다시 시작해 주세요.'
      worker = await createPartyOcrWorker(signal)
      signal.throwIfAborted()
      const activeWorker = worker
      const status = frameStatus(initialFrame)
      report({ type: 'READY', status })
      failureMessage =
        '글자 인식에 실패해 캡처를 중지했습니다. 다시 시작하거나 캐릭터 직접 검색을 사용해 주세요.'

      await runSerialLoop({
        signal,
        getIntervalMs: input.getIntervalMs,
        runCycle: async () => {
          if (signal.aborted) {
            return
          }
          failureMessage = '캡처 연결이 종료되었습니다. 창을 다시 선택해 주세요.'
          diagnostic = 'CAPTURE_READ_FAILED'
          const result = await input.readFrame(captureId)
          if (signal.aborted) {
            return
          }

          if (result.kind === 'unsupported') {
            failureMessage = frameStatus(result)
            throw new Error(failureMessage)
          }
          failureMessage =
            '글자 인식에 실패해 캡처를 중지했습니다. 다시 시작하거나 캐릭터 직접 검색을 사용해 주세요.'
          diagnostic = 'OCR_FAILED'
          if (result.kind === 'waiting') {
            await input.recognizePartyNicknames(null, activeWorker, signal)
            if (signal.aborted) {
              return
            }
            const status = frameStatus(result)
            report({ type: 'READY', status })

            return
          }
          const frame = { ...result.image, captureId, frameId: result.frameId }
          await input.recognizePartyNicknames(frame, activeWorker, signal)
          if (signal.aborted) {
            return
          }
          report({ type: 'READY', status: `캡처 중, ${result.image.width}×${result.image.height}` })
        }
      })
    } catch {
      if (signal.aborted) {
        release()
      } else {
        reportRendererDiagnostic(diagnostic)
        report({ type: 'FAILED', status: failureMessage })
      }
    }
  }
  void start()

  return release
}
