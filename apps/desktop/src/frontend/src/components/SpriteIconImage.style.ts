import * as stylex from '@stylexjs/stylex'

// 칸 위치를 sprite에서 남는 폭에 대한 백분율로 바꾼다. 백분율 크기와 위치라 상자 크기와 관계없이 칸 하나가
// 상자를 꽉 채운다.
function offsetPercent(offset: number, sheet: number, size: number): number {
  if (sheet === size) {
    return 0
  }

  return (offset / (sheet - size)) * 100
}

export const styles = stylex.create({
  icon: {
    display: 'block',
    width: '100%',
    height: '100%',
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated'
  },
  at: (
    sprite: string,
    x: number,
    y: number,
    size: number,
    sheetWidth: number,
    sheetHeight: number
  ) => ({
    backgroundImage: `url("${sprite}")`,
    backgroundSize: `${(sheetWidth / size) * 100}% ${(sheetHeight / size) * 100}%`,
    backgroundPosition: `${offsetPercent(x, sheetWidth, size)}% ${offsetPercent(y, sheetHeight, size)}%`
  })
})
