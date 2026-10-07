import type { Request } from 'express'
import { getIpQuotaKey } from '@dfragon/lib/utils/ip-quota-key'
import { OCR_ERROR_CODE, OcrError } from './errors.js'
import { TEST_CAPTURE_LIMITS } from './test-capture.js'

/** Anonymous intake execution limits run before the image body parser. */
export class TestCaptureAdmission {
  private readonly attempts = new Map<string, number>()
  private window = { until: 0, count: 0 }

  constructor(
    private readonly enabled: boolean,
    private readonly now = Date.now
  ) {}

  require(request: Request) {
    if (!this.enabled) {
      throw new OcrError(OCR_ERROR_CODE.NOT_FOUND)
    }

    if (request.headers.authorization !== undefined || request.headers.cookie !== undefined) {
      throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
    }
    const now = this.now()
    if (now >= this.window.until) {
      this.window = { until: now + TEST_CAPTURE_LIMITS.requestWindowMs, count: 0 }
      this.attempts.clear()
    }
    const client = getIpQuotaKey(request.ip ?? request.socket.remoteAddress ?? '')
    const attempts = this.attempts.get(client) ?? 0
    if (
      attempts >= TEST_CAPTURE_LIMITS.maximumRequestsPerClient ||
      this.window.count >= TEST_CAPTURE_LIMITS.maximumRequests
    ) {
      throw new OcrError(OCR_ERROR_CODE.TEST_UPLOAD_LIMIT)
    }
    this.window.count++
    this.attempts.set(client, attempts + 1)
  }
}
