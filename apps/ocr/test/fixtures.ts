import { randomUUID } from 'node:crypto'
import { PNG } from 'pngjs'
export function upload(id = randomUUID()) {
  const image = new PNG({ width: 8, height: 4 })
  for (let i = 0; i < image.data.length; i++) {
    image.data[i] = i % 256
  }
  return {
    id,
    capturedAt: '2026-09-25T00:00:00.000Z',
    kind: 'hud',
    uiScale: 0.75,
    uiScaleSource: 'game',
    originalPng: PNG.sync.write(image).toString('base64'),
    crops: [
      { slot: 1, x: 1, y: 1, width: 3, height: 2 },
      { slot: 3, x: 4, y: 0, width: 2, height: 2 }
    ]
  }
}

export function raidUpload(id = randomUUID()) {
  return {
    ...upload(id),
    kind: 'raid',
    crops: Array.from({ length: 12 }, (_, index) => ({
      slot: index + 1,
      x: index % 8,
      y: Math.floor(index / 8),
      width: 1,
      height: 1
    }))
  }
}
