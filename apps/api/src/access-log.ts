import { randomUUID } from 'node:crypto'
import type { Writable } from 'node:stream'
import type { NextFunction, Request, Response } from 'express'

/**
 * 요청마다 만든 JSON 한 줄을 받는다. 운영 기본값은 stdout이며 테스트는 직접 수집한다.
 * 쓰기 실패는 요청 처리에 영향을 주지 않도록 접근 로그 쪽에서 버린다.
 */
export type AccessLogSink = (line: string) => void

const SERVICE = 'api'
// 매칭된 route가 없으면 credential이 담길 수 있는 원문 경로 대신 고정 값을 남긴다.
const UNMATCHED_ROUTE = '<unmatched>'
const CORRELATION_ID_HEADER = 'X-Correlation-Id'
const errorCodes = new WeakMap<Response, string>()

function dropStreamError(): void {
  // 닫힌 log pipe의 EPIPE 같은 쓰기 오류는 접근 로그 한 줄을 잃는 것으로 끝낸다.
}

/**
 * Stream에 접근 로그를 한 줄씩 쓴다. 첫 쓰기 때 오류 listener를 두어, stdout pipe가 닫혀도
 * 처리되지 않은 `error` event로 서버 process가 끝나지 않게 한다.
 */
export function createStreamAccessLogSink(stream: Writable): AccessLogSink {
  let isWatchingErrors = false

  return (line) => {
    if (!isWatchingErrors) {
      stream.on('error', dropStreamError)
      isWatchingErrors = true
    }
    stream.write(`${line}\n`)
  }
}

export const writeAccessLogToStdout = createStreamAccessLogSink(process.stdout)

/** 응답에 쓴 정제 오류 code만 접근 로그에 전달한다. 오류 object, message는 받지 않는다. */
export function recordAccessLogErrorCode(response: Response, code: string): void {
  errorCodes.set(response, code)
}

function readRouteTemplate(request: Request): string {
  const route: unknown = request.route
  const isRoute = typeof route === 'object' && route !== null && 'path' in route
  if (!isRoute) {
    return UNMATCHED_ROUTE
  }

  const template = route.path
  if (typeof template !== 'string') {
    return UNMATCHED_ROUTE
  }

  return template
}

/**
 * 요청 하나당 allowlist field만 담은 JSON 한 줄을 남긴다. URL, query, header, body,
 * 오류 object는 읽지 않는다. Correlation ID는 클라이언트 값 대신 서버가 만들어
 * `X-Correlation-Id` 응답 header로도 돌려준다.
 */
export function createAccessLog(sink: AccessLogSink) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const startedAt = performance.now()
    const correlationId = randomUUID()
    response.setHeader(CORRELATION_ID_HEADER, correlationId)
    response.once('close', () => {
      // Header 전송 전에 연결이 끊기면 기본값 200은 실제 응답이 아니므로 status를 생략한다.
      const status = response.headersSent ? response.statusCode : undefined
      const aborted = response.writableFinished ? undefined : true
      const entry = {
        time: new Date().toISOString(),
        service: SERVICE,
        method: request.method,
        route: readRouteTemplate(request),
        status,
        code: errorCodes.get(response),
        durationMs: Math.round(performance.now() - startedAt),
        correlationId,
        aborted
      }
      try {
        sink(JSON.stringify(entry))
      } catch {
        // 이 listener가 가장 먼저 등록되므로, 예외를 넘기면 process가 끝나고 뒤에 등록된
        // close listener(업로드 slot 해제 등)도 실행되지 않는다. 로그 한 줄만 버린다.
      }
    })
    next()
  }
}
