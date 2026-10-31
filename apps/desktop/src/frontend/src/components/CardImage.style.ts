import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'
import { PORTRAIT_CANVAS_WIDTH } from '../../../preload/common/search/portrait-anchor'

function percentOfFace(value: number, faceWidth: number): string {
  return `${(value / faceWidth) * 100}%`
}

export const styles = stylex.create({
  image: { width: '100%', height: '100%', objectFit: 'contain' },
  zoom: { transform: 'scale(1.7)' },
  // 칸이 정사각형이라 얼굴 칸 폭을 기준으로 한 비율을 가로, 세로 위치에 함께 쓴다.
  faceWindow: (x: number, y: number, faceWidth: number) => ({
    position: 'absolute',
    left: percentOfFace(-x, faceWidth),
    top: percentOfFace(-y, faceWidth),
    width: percentOfFace(PORTRAIT_CANVAS_WIDTH, faceWidth),
    maxWidth: 'none',
    height: 'auto',
    imageRendering: 'pixelated'
  }),
  placeholder: {
    display: 'grid',
    placeItems: 'center',
    width: '100%',
    height: '100%',
    color: colors.cardFgMuted
  }
})
