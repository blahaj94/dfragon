import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProgressCircle, StatusChip, StepDots, type StatusChipTone } from '../src/index'
import { colors, motion } from '../src/tokens.stylex'

// StyleX의 atomic class 이름은 속성과 값에서 정해지므로, 같은 선언을 여기서 만들면 같은 class가 나온다.
// jsdom은 CSS를 계산하지 않으므로 화면이 기대하는 토큰 선언의 class가 실제로 붙었는지로 확인한다.
const expected = stylex.create({
  neutral: { color: colors.fgSubtle },
  success: { color: colors.fgSuccess, backgroundColor: colors.bgSuccessWeak },
  danger: { color: colors.fgDanger, backgroundColor: colors.bgDangerWeak },
  warning: { color: colors.fgWarning, backgroundColor: colors.bgWarningWeak },
  signal: { color: colors.signal }
})

const blip = stylex.keyframes({
  '0%': { opacity: 1 },
  '33%': { opacity: 0.25 }
})

const expectedDot = stylex.create({
  animated: {
    animationName: { default: blip, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationDuration: motion.beat,
    animationTimingFunction: 'steps(1, end)',
    animationIterationCount: 'infinite'
  }
})

function classesOf(style: stylex.StyleXStyles): string[] {
  return (stylex.props(style).className ?? '').split(' ').filter(Boolean)
}

function render(node: ReactNode): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(node)

  return container
}

describe('StatusChip tone의 색 토큰', () => {
  it.each(['neutral', 'success', 'danger', 'warning', 'signal'] as const)(
    '%s 칩은 그 tone의 글자색과 면 토큰을 쓰고 다른 tone의 색은 쓰지 않는다',
    (tone: StatusChipTone) => {
      const chip = render(<StatusChip tone={tone}>상태</StatusChip>).firstElementChild!
      const classes = chip.className.split(' ')

      for (const name of classesOf(expected[tone])) {
        expect(classes).toContain(name)
      }
      for (const other of ['success', 'danger', 'warning'] as const) {
        if (other === tone) {
          continue
        }
        const [colorClass] = classesOf(expected[other])
        expect(classes).not.toContain(colorClass)
      }
    }
  )
})

describe('StepDots의 움직임', () => {
  it('세 점 모두 한 박자 주기의 steps() 깜박임을 걸고 동작 줄이기에서는 끈다', () => {
    const dots = render(<StepDots />).firstElementChild!

    for (const dot of dots.children) {
      for (const name of classesOf(expectedDot.animated)) {
        expect(dot.className.split(' ')).toContain(name)
      }
    }
  })
})

describe('ProgressCircle의 호가 범위가 유효하지 않을 때', () => {
  it.each([
    ['minValue가 NaN', { minValue: Number.NaN }],
    ['maxValue가 NaN', { maxValue: Number.NaN }],
    ['maxValue가 minValue 이하', { minValue: 10, maxValue: 10 }]
  ])('%s이면 호가 0이다', (_name, range) => {
    const circle = render(<ProgressCircle value={50} {...range} />).querySelectorAll('circle')

    expect(circle[1].getAttribute('stroke-dasharray')).toMatch(/^0 /)
  })
})
