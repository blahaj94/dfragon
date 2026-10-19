import { colors } from '@dfragon/ui/tokens.stylex'
import * as stylex from '@stylexjs/stylex'

// StyleX의 atomic class 이름은 속성과 값에서 정해지므로, 같은 선언을 여기서 만들면 컴포넌트가 점수나 명성 숫자에
// 칠한 색과 같은 class가 나온다. jsdom은 색을 계산하지 않으므로 숫자가 어느 색 class를 가졌는지로 확인한다.
const tones = stylex.create({
  dealer: { color: colors.scoreDealer },
  buffer: { color: colors.scoreBuffer },
  top: { color: colors.tierTop },
  ranker: { color: colors.tierRanker }
})

function toneClass(tone: keyof typeof tones): string {
  const { className } = stylex.props(tones[tone])
  if (className === undefined) {
    throw new Error(`${tone} 톤의 class가 없습니다.`)
  }

  return className
}

/** 숫자 칸이 역할 색(딜러 파랑, 버퍼 초록)과 단계 색(상위, 랭커) 가운데 어느 색 class를 가졌는지. */
export function toneClassesOf(element: Element): (keyof typeof tones)[] {
  const classes = element.className.split(' ')

  return (['dealer', 'buffer', 'top', 'ranker'] as const).filter((tone) =>
    classes.includes(toneClass(tone))
  )
}
