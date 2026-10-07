import { detectPartyFrameGeometry, type PartyFrameRegion } from '@dfragon/lib'
import { OCR_DATA_LIMITS } from '@dfragon/lib/ocr-contract'
import { PNG } from 'pngjs'
import type { CharacterImage } from '../../preload/common/types/character'
import type { CollectOcrSample } from '../../preload/common/types/ocr-collection'

const RGBA_CHANNELS = 4
// 1067×600, UI 50 표본의 이름 왼쪽에 얼굴이 있고 아래에 HP/MP가 있다.
const CONTEXT_LEFT_REFERENCE_PX = 32
const CONTEXT_TOP_REFERENCE_PX = 12
const CONTEXT_BOTTOM_REFERENCE_PX = 6

export type CollectionFrame = {
  id: string
  capturedAt: string
  image: CharacterImage
}
export type CollectionJob = {
  frame: CollectionFrame
  trigger: 'ocr' | 'shortcut'
  predictions: Map<CollectOcrSample['slot'], string | null>
}
type Crop = { slot: CollectOcrSample['slot']; x: number; y: number; width: number; height: number }

/** 자료실의 원본 제한을 넘는 프레임은 캡처 검색과 별개로 수집에서 제외한다. */
export function isCollectableFrame(image: CharacterImage): boolean {
  return (
    Number.isSafeInteger(image.width) &&
    Number.isSafeInteger(image.height) &&
    image.width > 0 &&
    image.height > 0 &&
    image.width <= OCR_DATA_LIMITS.maximumDimension &&
    image.height <= OCR_DATA_LIMITS.maximumDimension &&
    image.width * image.height <= OCR_DATA_LIMITS.maximumPixels &&
    image.rgba.byteLength === image.width * image.height * RGBA_CHANNELS
  )
}

function contextRegion(region: PartyFrameRegion, scale: number, image: CharacterImage): Crop {
  const x = Math.max(0, region.x - Math.round(CONTEXT_LEFT_REFERENCE_PX * scale))
  const y = Math.max(0, region.y - Math.ceil(CONTEXT_TOP_REFERENCE_PX * scale))
  const right = Math.min(image.width, region.coverage.x + region.coverage.width)
  const bottom = Math.min(
    image.height,
    region.coverage.y + region.coverage.height + Math.ceil(CONTEXT_BOTTOM_REFERENCE_PX * scale)
  )
  const width = right - x
  const height = bottom - y

  return { slot: region.slot, x, y, width, height }
}

function isVisible(image: CharacterImage, region: Crop): boolean {
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      const alpha = image.rgba[(y * image.width + x) * RGBA_CHANNELS + 3]
      if (alpha !== 255) {
        return false
      }
    }
  }

  return true
}

/** 슬롯 전체는 검토 문맥으로 보관하고 학습용 닉네임 좌표는 별도로 유지한다. */
export function detectCollectionCrops(
  image: CharacterImage
): { scale: number; slots: { nickname: Crop; context: Crop }[] } | null {
  if (!isCollectableFrame(image)) {
    return null
  }
  try {
    const geometry = detectPartyFrameGeometry(image)
    const slots = geometry.slots.flatMap((region) => {
      const context = contextRegion(region, geometry.scale, image)
      if (!isVisible(image, context)) {
        return []
      }
      const { slot, x, y, width, height } = region
      const nickname = { slot, x, y, width, height }

      return [{ nickname, context }]
    })
    const scale = geometry.scale

    return { scale, slots }
  } catch {
    return null
  }
}

function encodePng(image: CharacterImage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const png = new PNG({ width: image.width, height: image.height })
    png.data = Buffer.from(image.rgba.buffer, image.rgba.byteOffset, image.rgba.byteLength)
    const chunks: Buffer[] = []
    let size = 0
    png.on('data', (chunk: Buffer) => {
      size += chunk.byteLength
      if (size > OCR_DATA_LIMITS.maximumPngBytes) {
        png.destroy()
        reject(new Error('OCR_COLLECTION_IMAGE_TOO_LARGE'))

        return
      }
      chunks.push(chunk)
    })
    png.on('error', reject)
    png.on('end', () => resolve(Buffer.concat(chunks)))
    png.pack()
  })
}

/** PNG 압축은 비동기로 실행하여 OCR 요청의 응답을 기다리게 하지 않는다. */
export async function createCollectionPayload(
  job: CollectionJob,
  id: string
): Promise<string | null> {
  const geometry = detectCollectionCrops(job.frame.image)
  if (geometry === null) {
    return null
  }
  const selected = geometry.slots.filter(({ nickname }) => job.predictions.has(nickname.slot))
  if (selected.length === 0) {
    return null
  }
  const png = await encodePng(job.frame.image)
  const originalPng = png.toString('base64')
  const crops = selected.map(({ nickname }) => nickname)
  const slots = selected.map(({ context }) => {
    const prediction = job.predictions.get(context.slot) ?? null

    return { ...context, prediction }
  })

  return JSON.stringify({
    id,
    capturedAt: job.frame.capturedAt,
    kind: 'hud',
    uiScale: geometry.scale,
    uiScaleSource: 'estimated',
    originalPng,
    crops,
    testCollection: { trigger: job.trigger, slots }
  })
}
