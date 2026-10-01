// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readDeveloperImage } from './developer-images'
import { isValidImageDimensions } from '../../../backend/developer/validation'

const originalContext = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')!
beforeEach(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({ drawImage: vi.fn() })
  })
})
afterEach(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', originalContext)
  vi.unstubAllGlobals()
})

it.each([
  [8192, 1, true],
  [8193, 1, false],
  [1, 8192, true],
  [1, 8193, false],
  [6600, 5000, true],
  [6601, 5000, false]
] as const)('renderer and storage agree on %i × %i pixels', async (width, height, allowed) => {
  vi.stubGlobal(
    'Image',
    class {
      src = ''
      naturalWidth = width
      naturalHeight = height
      async decode(): Promise<void> {}
    }
  )

  expect(isValidImageDimensions(width, height)).toBe(allowed)
  const reading = readDeveloperImage('data:image/png;base64,synthetic')
  if (allowed) {
    const canvas = await reading
    expect([canvas.width, canvas.height]).toEqual([width, height])
  } else {
    await expect(reading).rejects.toThrow('한 변 8192px, 총 3300만 픽셀')
  }
})
