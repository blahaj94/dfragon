import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import type { Sample } from '../src/model.js'
import { useSampleWorkspace } from './hooks/use-sample-workspace.js'
import { INITIAL_SAMPLE_FILTERS } from './sample-query.js'
import { App } from './App.js'

const mounted = vi.hoisted(() => vi.fn())
vi.mock('./hooks/use-ocr-session.js', () => ({
  useOcrSession: () => ({ authenticated: true, logout: {}, error: null })
}))
vi.mock('./hooks/use-color-mode.js', () => ({
  useColorMode: () => ({ mode: 'light', toggle: vi.fn() })
}))
vi.mock('./hooks/use-sample-workspace.js', () => ({ useSampleWorkspace: vi.fn() }))
vi.mock('./CaptureUpload.js', () => ({ CaptureUpload: () => null }))
vi.mock('./SplitPlanner.js', () => ({ SplitPlanner: () => null }))
vi.mock('./ModelLibrary.js', () => ({ ModelLibrary: () => null }))
vi.mock('./SampleEditor.js', () => ({
  SampleEditor: () => {
    useEffect(() => {
      mounted()
    }, [])

    return null
  }
}))

afterEach(() => vi.unstubAllGlobals())

it('retains the editor identity on metadata refresh and replaces it for another sample', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const root = createRoot(document.createElement('div'))
  const sample: Sample = {
    id: 'one',
    captureId: 'capture',
    capturedAt: '2026-10-01T00:00:00.000Z',
    kind: 'hud',
    slot: 1,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    frameWidth: 1,
    frameHeight: 1,
    uiScale: 1,
    uiScaleSource: 'game',
    text: '기존정답',
    excluded: false,
    split: 'unassigned'
  }
  async function render(value: Sample) {
    vi.mocked(useSampleWorkspace).mockReturnValue({
      filters: INITIAL_SAMPLE_FILTERS,
      setFilter: vi.fn(),
      setOffset: vi.fn(),
      setSelected: vi.fn(),
      sample: value,
      samples: [value],
      next: null,
      stats: undefined,
      error: null
    })
    await act(async () => root.render(<App />))
  }
  try {
    await render(sample)
    expect(mounted).toHaveBeenCalledTimes(1)
    await render({ ...sample, text: '서버정답', excluded: true, split: 'train' })
    expect(mounted).toHaveBeenCalledTimes(1)
    await render({ ...sample, id: 'two' })
    expect(mounted).toHaveBeenCalledTimes(2)
  } finally {
    await act(async () => root.unmount())
  }
})
