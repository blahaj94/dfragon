import type { WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { registerCapturePermissions } from './permission-policy'

const documentUrl = 'file:///fixture/index.html'

type Fixture = {
  check: ReturnType<typeof vi.fn>
  request: ReturnType<typeof vi.fn>
}

function createFixture(): Fixture {
  const check = vi.fn()
  const request = vi.fn()
  registerCapturePermissions({
    setPermissionCheckHandler: check,
    setPermissionRequestHandler: request
  })

  return { check, request }
}

function ask(
  fixture: Fixture,
  changes: Record<string, unknown> = {},
  permission = 'media'
): ReturnType<typeof vi.fn> {
  const callback = vi.fn()
  fixture.request.mock.calls[0][0]({} as WebContents, permission, callback, {
    isMainFrame: true,
    requestingUrl: documentUrl,
    mediaTypes: [],
    ...changes
  })

  return callback
}

describe('capture permission policy', () => {
  it.each(['media', 'notifications', 'clipboard-read', 'display-capture'])(
    'denies %s checks',
    (permission) => {
      const fixture = createFixture()

      expect(
        fixture.check.mock.calls[0][0]({} as WebContents, permission, documentUrl, {
          isMainFrame: true,
          mediaType: 'video',
          requestingUrl: documentUrl
        })
      ).toBe(false)
    }
  )

  // 예전 제품이 캡처 수명마다 한 번 허용하던 main frame의 빈 mediaTypes 요청이다.
  it('denies the former capture candidate media request', () => {
    const fixture = createFixture()

    expect(ask(fixture)).toHaveBeenCalledExactlyOnceWith(false)
  })

  it.each([
    { isMainFrame: false },
    { isMainFrame: undefined },
    { mediaTypes: undefined },
    { mediaTypes: null },
    { mediaTypes: {} },
    { mediaTypes: '' },
    { mediaTypes: ['audio'] },
    { mediaTypes: ['video'] },
    { mediaTypes: ['audio', 'video'] }
  ])('denies media request metadata variants: %j', (changes) => {
    const fixture = createFixture()

    expect(ask(fixture, changes)).toHaveBeenCalledExactlyOnceWith(false)
  })

  it.each(['notifications', 'clipboard-read', 'display-capture'])(
    'denies %s requests',
    (permission) => {
      const fixture = createFixture()

      expect(ask(fixture, {}, permission)).toHaveBeenCalledExactlyOnceWith(false)
    }
  )
})
