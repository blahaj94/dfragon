import type { WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { registerCapturePermissions } from './permission-policy'

const documentUrl = 'file:///fixture/index.html'

type Fixture = {
  check: ReturnType<typeof vi.fn>
  request: ReturnType<typeof vi.fn>
  consume: ReturnType<typeof vi.fn<() => boolean>>
  contents: WebContents
}

function createFixture(configured = true): Fixture {
  const check = vi.fn()
  const request = vi.fn()
  const consume = vi.fn(() => true)
  const contents = {} as WebContents
  registerCapturePermissions(
    { setPermissionCheckHandler: check, setPermissionRequestHandler: request },
    configured ? consume : undefined
  )
  return { check, request, consume, contents }
}

function ask(
  fixture: ReturnType<typeof createFixture>,
  changes: Record<string, unknown> = {},
  permission = 'media'
): ReturnType<typeof vi.fn> {
  const callback = vi.fn()
  fixture.request.mock.calls[0][0](fixture.contents, permission, callback, {
    isMainFrame: true,
    requestingUrl: documentUrl,
    mediaTypes: [],
    ...changes
  })
  return callback
}

describe('capture permission policy', () => {
  it('keeps unconfigured product media request and every check denied', () => {
    const fixture = createFixture(false)

    expect(ask(fixture)).toHaveBeenCalledExactlyOnceWith(false)
    expect(fixture.check.mock.calls[0][0]()).toBe(false)
    expect(fixture.consume).not.toHaveBeenCalled()
  })

  it('delegates an empty media request to the current capture boundary once', () => {
    const fixture = createFixture()

    expect(ask(fixture)).toHaveBeenCalledExactlyOnceWith(true)
    expect(fixture.consume).toHaveBeenCalledExactlyOnceWith(fixture.contents, documentUrl)
    expect(fixture.check.mock.calls[0][0]()).toBe(false)
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
  ])('rejects invalid request metadata without consuming capture: %j', (changes) => {
    const fixture = createFixture()

    expect(ask(fixture, changes)).toHaveBeenCalledExactlyOnceWith(false)
    expect(fixture.consume).not.toHaveBeenCalled()
  })

  it('rejects other permissions without consuming capture', () => {
    const fixture = createFixture()

    expect(ask(fixture, {}, 'notifications')).toHaveBeenCalledExactlyOnceWith(false)
    expect(fixture.consume).not.toHaveBeenCalled()
  })

  it('denies when the capture boundary rejects the request', () => {
    const fixture = createFixture()
    fixture.consume.mockReturnValue(false)

    expect(ask(fixture)).toHaveBeenCalledExactlyOnceWith(false)
  })
})
