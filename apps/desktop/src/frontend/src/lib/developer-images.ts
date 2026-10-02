import {
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS
} from '../../../preload/common/developer-image-limits'

/** 가져온 파일과 캡처 프레임을 같은 크기 제한의 PNG 캔버스로 읽는다. */
export async function readDeveloperImage(dataUrl: string): Promise<HTMLCanvasElement> {
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  if (
    image.naturalWidth < 1 ||
    image.naturalHeight < 1 ||
    image.naturalWidth > MAX_IMAGE_DIMENSION ||
    image.naturalHeight > MAX_IMAGE_DIMENSION ||
    image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS
  ) {
    throw new Error(
      `이미지는 한 변 ${MAX_IMAGE_DIMENSION}px, 총 ${MAX_IMAGE_PIXELS / 10_000}만 픽셀 이하여야 합니다.`
    )
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
