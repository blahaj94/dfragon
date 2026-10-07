import { randomUUID } from 'node:crypto'
import { PNG } from 'pngjs'
import type { TestCollection } from '../src/model.js'
export function upload(id = randomUUID()) {
  const image = new PNG({ width: 8, height: 4 })
  for (let i = 0; i < image.data.length; i++) {
    image.data[i] = i % 256
  }

  const originalPng = PNG.sync.write(image).toString('base64')

  return {
    id,
    capturedAt: '2026-09-25T00:00:00.000Z',
    kind: 'hud',
    uiScale: 0.75,
    uiScaleSource: 'game',
    originalPng,
    crops: [
      { slot: 1, x: 1, y: 1, width: 3, height: 2 },
      { slot: 3, x: 4, y: 0, width: 2, height: 2 }
    ]
  }
}

export function raidUpload(id = randomUUID()) {
  const fixture = { ...upload(id), kind: 'raid' }
  const crops = Array.from({ length: 12 }, (_, index) => {
    const slot = index + 1
    const x = index % 8
    const y = Math.floor(index / 8)

    return { slot, x, y, width: 1, height: 1 }
  })
  fixture.crops = crops

  return fixture
}

export function testCapture(id = randomUUID()) {
  const source = upload(id)
  const testCollection: Pick<TestCollection, 'trigger' | 'slots'> = {
    trigger: 'ocr',
    slots: [
      { slot: 1, x: 0, y: 0, width: 4, height: 4, prediction: '잘못된예측' },
      { slot: 3, x: 4, y: 0, width: 4, height: 4, prediction: null }
    ]
  }

  return { ...source, testCollection }
}

export function syntheticUpload(id = randomUUID(), text = '합성고래') {
  const image = new PNG({ width: 8, height: 4 })
  image.data.fill(255)

  const png = PNG.sync.write(image).toString('base64')

  return {
    id,
    generatedAt: '2026-09-30T00:00:00.000Z',
    png,
    text,
    rendering: {
      rendererVersion: '0.1.2',
      profile: 'dotum',
      scale: 1.8,
      foregroundRgb: [75, 209, 255],
      backgroundRgb: [255, 255, 255]
    }
  }
}
