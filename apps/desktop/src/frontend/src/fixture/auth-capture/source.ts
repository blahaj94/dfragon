const canvas = document.getElementById('source')
const isCanvas = canvas instanceof HTMLCanvasElement
if (!isCanvas) {
  throw new Error('Synthetic source canvas missing')
}
// 게임처럼 물리 픽셀에 글자를 그려 Retina에서 저해상도 Canvas가 확대되는 것을 피한다.
const pixelRatio = window.devicePixelRatio
canvas.width = Math.round(1920 * pixelRatio)
canvas.height = Math.round(1080 * pixelRatio)
const context = canvas.getContext('2d')
const hasContext = context != null
if (!hasContext) {
  throw new Error('Synthetic source context missing')
}
context.scale(pixelRatio, pixelRatio)
context.fillStyle = 'black'
context.fillRect(0, 0, canvas.width, canvas.height)
// FHD 표본에서 관측한 배율의 HP, MP 쌍을 합성한다. 제품 검출 좌표를 정답으로 쓰지 않는다.
for (const anchorX of [55, 236, 417, 598]) {
  context.fillStyle = 'white'
  // 여백을 포함한 원본 크롭에서 standalone OCR fixture와 같은 고정폭 글꼴을 사용한다.
  context.font = '16px monospace'
  context.textBaseline = 'top'
  context.fillText('ALICE', anchorX + 2, 15)
  context.fillStyle = 'rgb(194, 15, 11)'
  context.fillRect(anchorX, 35, 126, 3)
  context.fillStyle = 'rgb(18, 124, 209)'
  context.fillRect(anchorX, 43, 126, 3)
}
