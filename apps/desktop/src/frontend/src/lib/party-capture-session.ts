import { createPartyOcrWorker } from './ocr'
import { runSerialLoop } from './recognition'
import { SUPPORTED_WIDTH, SUPPORTED_HEIGHT } from '../constants/capture'
import type { PartyOcrWorker } from '../types/capture'

type Worker = Awaited<ReturnType<typeof createPartyOcrWorker>>

type CaptureSession = {
  controller: AbortController
  stream: MediaStream | null
  video: HTMLVideoElement | null
  worker: Worker | null
}

export type CaptureSessionInput = {
  beginSearch: (signal: AbortSignal) => Promise<string | null>
  getIntervalMs: () => number
  recognizePartyNicknames: (
    video: HTMLVideoElement,
    worker: PartyOcrWorker,
    signal: AbortSignal
  ) => Promise<void>
}

export type CaptureSessionEvent =
  | { type: 'MEDIA_REQUESTED' }
  | { type: 'OCR_START' }
  | { type: 'READY'; status: string }
  | { type: 'FAILED'; status: string }

// 호출마다 stream·video·worker를 소유하고 actor 종료 뒤 도착한 자원도 같은 수명에서 정리한다.
export function startPartyCaptureSession(
  input: CaptureSessionInput,
  report: (event: CaptureSessionEvent) => void
): () => void {
  const session: CaptureSession = {
    controller: new AbortController(),
    stream: null,
    video: null,
    worker: null
  }
  const { signal } = session.controller
  async function start(): Promise<void> {
    let failureMessage = '검색을 시작하지 못했습니다. 창을 다시 선택해 주세요.'
    try {
      const captureId = await input.beginSearch(signal)
      signal.throwIfAborted()
      const hasCapture = captureId != null
      if (!hasCapture) {
        throw new Error(failureMessage)
      }
      report({ type: 'MEDIA_REQUESTED' })
      failureMessage =
        '캡처를 시작하지 못했습니다. 게임이 최소화되지 않았는지 확인하고 창을 다시 선택해 주세요.'
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: false,
        video: {
          frameRate: { ideal: 1, max: 1 },
          height: { ideal: SUPPORTED_HEIGHT },
          width: { ideal: SUPPORTED_WIDTH }
        }
      })
      session.stream = stream
      signal.throwIfAborted()
      const track = stream.getVideoTracks()[0]
      const hasTrack = track != null
      if (!hasTrack) {
        failureMessage = '선택한 창에서 영상을 받지 못했습니다. 게임 창을 다시 선택해 주세요.'
        throw new Error(failureMessage)
      }

      track.addEventListener(
        'ended',
        () =>
          report({
            type: 'FAILED',
            status: '게임 창의 영상이 종료되었습니다. 창을 다시 선택하고 캡처를 시작해 주세요.'
          }),
        { once: true, signal }
      )

      const video = document.createElement('video')
      session.video = video
      video.muted = true
      const metadataLoaded = new Promise<void>((resolve) => {
        video.addEventListener('loadedmetadata', () => resolve(), { once: true, signal })
        signal.addEventListener('abort', () => resolve(), { once: true })
      })
      video.srcObject = stream
      failureMessage = '게임 영상을 재생하지 못했습니다. 게임 창을 확인하고 다시 시작해 주세요.'
      await video.play()
      await metadataLoaded
      signal.throwIfAborted()
      const hasSupportedWidth = video.videoWidth === SUPPORTED_WIDTH
      if (!hasSupportedWidth) {
        failureMessage = `지원하지 않는 영상 크기입니다: ${video.videoWidth}×${video.videoHeight}. 게임을 1920×1080 테두리 없는 창 모드로 설정해 주세요.`
        throw new Error(failureMessage)
      }
      const hasSupportedHeight = video.videoHeight === SUPPORTED_HEIGHT
      const hasSupportedLayout = hasSupportedWidth && hasSupportedHeight
      if (!hasSupportedLayout) {
        failureMessage = `지원하지 않는 영상 크기입니다: ${video.videoWidth}×${video.videoHeight}. 게임을 1920×1080 테두리 없는 창 모드로 설정해 주세요.`
        throw new Error(failureMessage)
      }

      failureMessage = '글자 인식을 준비하지 못했습니다. 캡처를 다시 시작해 주세요.'
      report({ type: 'OCR_START' })
      const worker = await createPartyOcrWorker(signal)
      session.worker = worker
      signal.throwIfAborted()

      void runSerialLoop({
        signal,
        getIntervalMs: input.getIntervalMs,
        runCycle: () => input.recognizePartyNicknames(video, worker, signal)
      }).catch(() => {
        const isCaptureActive = !signal.aborted
        if (isCaptureActive) {
          report({
            type: 'FAILED',
            status:
              '글자 인식에 실패해 캡처를 중지했습니다. 다시 시작하거나 캐릭터 직접 검색을 사용해 주세요.'
          })
        }
      })
      if (!signal.aborted) {
        report({ type: 'READY', status: `캡처 중 · ${video.videoWidth}×${video.videoHeight}` })
      }
    } catch {
      if (signal.aborted) {
        // 취소 후 반환된 stream/worker도 이 session에서 정리한다.
        releaseSession(session)
      } else {
        report({ type: 'FAILED', status: failureMessage })
      }
    }
  }
  void start()
  return () => releaseSession(session)
}

// 취소와 늦은 완료 양쪽에서 호출해도 각 자원을 한 번만 정리한다.
function releaseSession(session: CaptureSession): void {
  const { controller, stream, video, worker } = session
  session.stream = null
  session.video = null
  session.worker = null
  controller.abort()
  stream?.getTracks().forEach((track) => track.stop())
  const hasVideo = video != null
  if (hasVideo) {
    video.pause()
    video.srcObject = null
  }
  void worker?.terminate()
}
