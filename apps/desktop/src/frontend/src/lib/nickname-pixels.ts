/** 게임 닉네임의 밝은 글자를 OCR용 반전 회색조로 바꾸며 얇은 획을 임계 처리하지 않는다. */
export function invertNicknamePixels(data: Uint8ClampedArray): void {
  for (let index = 0; index < data.length; index += 4) {
    const luminance = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]
    const value = 255 - luminance
    data[index] = value
    data[index + 1] = value
    data[index + 2] = value
    data[index + 3] = 255
  }
}
