import { useEffect, useRef, useState } from 'react'
import { createPartyOcrWorker } from './ocr'
import { runSerialLoop } from './recognition'

const SUPPORTED_WIDTH = 1920
const SUPPORTED_HEIGHT = 1080

type Worker = Awaited<ReturnType<typeof createPartyOcrWorker>>

type CaptureSession = {
  controller: AbortController
  stream: MediaStream | null
  video: HTMLVideoElement | null
  worker: Worker | null
}

type Options = {
  beginSearch: (signal: AbortSignal) => Promise<string | null>
  endSearch: () => void
  isSelectedSourceRegistered: () => boolean
  intervalSecondsRef: React.RefObject<number>
  setStatus: (status: string) => void
  recognizePartyNicknames: (
    video: HTMLVideoElement,
    worker: Worker,
    signal: AbortSignal
  ) => Promise<void>
  resetRecognition: () => void
}

export function usePartyCaptureSession({
  isSelectedSourceRegistered,
  beginSearch,
  endSearch,
  intervalSecondsRef,
  setStatus,
  recognizePartyNicknames,
  resetRecognition
}: Options): {
  starting: boolean
  startCapture: () => Promise<void>
  stopCapture: (nextStatus?: string) => void
} {
  const [starting, setStarting] = useState(false)
  const startingRef = useRef(false)
  const sessionRef = useRef<CaptureSession | null>(null)

  function stopCapture(nextStatus = '캡처를 중지했습니다.'): void {
    releaseSession(sessionRef.current)
    sessionRef.current = null
    startingRef.current = false
    setStarting(false)
    endSearch()
    resetRecognition()
    setStatus(nextStatus)
  }

  useEffect(() => {
    return () => {
      releaseSession(sessionRef.current)
      sessionRef.current = null
      endSearch()
    }
  }, [endSearch])

  async function startCapture(): Promise<void> {
    if (startingRef.current) {
      return
    }
    const isSourceRegistered = isSelectedSourceRegistered()
    if (!isSourceRegistered) {
      setStatus('게임 창 선택을 확인하고 있습니다. 잠시 후 캡처를 시작해 주세요.')
      return
    }

    stopCapture()
    const session: CaptureSession = {
      controller: new AbortController(),
      stream: null,
      video: null,
      worker: null
    }
    sessionRef.current = session
    startingRef.current = true
    setStarting(true)
    const { signal } = session.controller
    let failureMessage = '검색을 시작하지 못했습니다. 창을 다시 선택해 주세요.'
    setStatus('캡처를 준비하고 있습니다.')
    try {
      const captureId = await beginSearch(signal)
      signal.throwIfAborted()
      const hasCapture = captureId != null
      if (!hasCapture) {
        throw new Error(failureMessage)
      }
      startingRef.current = false
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
          stopCapture('게임 창의 영상이 종료되었습니다. 창을 다시 선택하고 캡처를 시작해 주세요.'),
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
      setStatus('글자 인식을 준비하고 있습니다. 잠시 기다려 주세요.')
      const worker = await createPartyOcrWorker(signal)
      session.worker = worker
      signal.throwIfAborted()

      void runSerialLoop({
        signal,
        getIntervalMs: () => intervalSecondsRef.current * 1000,
        runCycle: () => recognizePartyNicknames(video, worker, signal)
      }).catch(() => {
        const isCaptureActive = !signal.aborted
        if (isCaptureActive) {
          stopCapture(
            '글자 인식에 실패해 캡처를 중지했습니다. 다시 시작하거나 캐릭터 직접 검색을 사용해 주세요.'
          )
        }
      })
      startingRef.current = false
      setStarting(false)
      setStatus(`캡처 중 · ${video.videoWidth}×${video.videoHeight}`)
    } catch {
      if (signal.aborted) {
        // 취소 후 반환된 stream/worker도 이 session에서 정리한다.
        releaseSession(session)
      } else {
        stopCapture(failureMessage)
      }
    }
  }

  return { starting, startCapture, stopCapture }
}

function releaseSession(session: CaptureSession | null): void {
  const hasSession = session != null
  if (!hasSession) {
    return
  }
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
