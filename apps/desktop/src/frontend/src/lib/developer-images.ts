import type { Rectangle } from '../types/capture'

const MAX_PIXELS = 33_000_000

/** 가져온 파일과 캡처 프레임을 같은 크기 제한의 PNG 캔버스로 읽는다. */
export async function readDeveloperImage(dataUrl: string): Promise<HTMLCanvasElement> {
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  if (
    image.naturalWidth < 1 ||
    image.naturalHeight < 1 ||
    image.naturalWidth > 8192 ||
    image.naturalHeight > 8192 ||
    image.naturalWidth * image.naturalHeight > MAX_PIXELS
  ) {
    throw new Error('이미지는 한 변 8192px, 총 3300만 픽셀 이하여야 합니다.')
  }
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (context == null) {
    throw new Error('이미지를 읽을 수 없습니다.')
  }
  context.drawImage(image, 0, 0)
  return canvas
}

/** 허용한 래스터 파일만 읽고 임의 SVG나 외부 URL은 이미지 입력으로 사용하지 않는다. */
export async function readDeveloperFile(file: File): Promise<HTMLCanvasElement> {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size > 16 * 1024 * 1024
  ) {
    throw new Error('16MB 이하의 PNG, JPEG, WebP 이미지를 선택해 주세요.')
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('이미지를 읽을 수 없습니다.'))
    reader.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'))
    reader.readAsDataURL(file)
  })
  return readDeveloperImage(dataUrl)
}

/** 정수 좌표가 원본 안에 완전히 들어오는지 검사하며 잘못된 영역을 조용히 보정하지 않는다. */
export function validDeveloperCrop(region: Rectangle, width: number, height: number): boolean {
  return (
    [region.x, region.y, region.width, region.height].every(Number.isSafeInteger) &&
    region.x >= 0 &&
    region.y >= 0 &&
    region.width > 0 &&
    region.height > 0 &&
    region.x + region.width <= width &&
    region.y + region.height <= height
  )
}

/** 크기 변경이나 필터 없이 원본 픽셀을 복사해 테스트 이미지를 만든다. */
export function cropDeveloperImage(
  source: HTMLCanvasElement,
  region: Rectangle
): HTMLCanvasElement {
  if (!validDeveloperCrop(region, source.width, source.height)) {
    throw new Error('원본 안의 유효한 영역을 지정해 주세요.')
  }
  const result = document.createElement('canvas')
  result.width = region.width
  result.height = region.height
  const sourceContext = source.getContext('2d')
  const targetContext = result.getContext('2d')
  if (sourceContext == null || targetContext == null) {
    throw new Error('이미지를 자를 수 없습니다.')
  }
  targetContext.putImageData(
    sourceContext.getImageData(region.x, region.y, region.width, region.height),
    0,
    0
  )
  return result
}

/** 화면상의 드래그 양 끝을 원본 이미지의 정수 픽셀 사각형으로 환산한다. */
export function developerDragRegion(
  start: { x: number; y: number },
  end: { x: number; y: number }
): Rectangle {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  }
}
