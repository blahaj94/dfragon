// NumericText가 숫자를 올릴 시간과 곡선을 tokens.css의 --df-dur-count, --df-ease에서 읽는다.
// 동작 줄이기 설정에서는 tokens.css가 시간을 0으로 두므로 바로 최종값을 보인다.

const DURATION_PATTERN = /^(-?[\d.]+)(ms|s)$/
const CUBIC_BEZIER_PATTERN = /^cubic-bezier\(([^)]+)\)$/
// 곡선의 t를 찾는 이분 탐색 횟수. 24번이면 오차가 2^-24 아래로 줄어든다.
const BISECTION_STEPS = 24

export function parseDuration(value: string): number {
  const match = DURATION_PATTERN.exec(value.trim())
  if (match == null) {
    return 0
  }
  const amount = Number(match[1])
  const milliseconds = match[2] === 's' ? amount * 1000 : amount

  const isPositive = Number.isFinite(milliseconds) && milliseconds > 0
  if (!isPositive) {
    return 0
  }

  return milliseconds
}

function bezierPoint(t: number, first: number, second: number) {
  const inverse = 1 - t

  return 3 * inverse * inverse * t * first + 3 * inverse * t * t * second + t * t * t
}

export function parseEasing(value: string): (progress: number) => number {
  const match = CUBIC_BEZIER_PATTERN.exec(value.trim())
  const points = match?.[1].split(',').map(Number) ?? []
  const isCurve = points.length === 4 && points.every(Number.isFinite)
  if (!isCurve) {
    return (progress) => progress
  }
  const [x1, y1, x2, y2] = points

  return (progress) => {
    let low = 0
    let high = 1
    for (let step = 0; step < BISECTION_STEPS; step += 1) {
      const middle = (low + high) / 2
      if (bezierPoint(middle, x1, x2) < progress) {
        low = middle
      } else {
        high = middle
      }
    }

    return bezierPoint((low + high) / 2, y1, y2)
  }
}
