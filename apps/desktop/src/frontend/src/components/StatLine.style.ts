import * as stylex from '@stylexjs/stylex'
import { colors, font, space } from '@dfragon/ui/tokens.stylex'

// 명성과 점수를 한 줄에 두는 12px 글자(Typo.caption 크기, 행간은 시안의 14px). 마루미냐 한글 비트맵 글꼴은
// 굵기가 하나뿐이라 라벨과 값 모두 400으로 두어 가짜 굵게를 피한다.
export const styles = stylex.create({
  line: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    minWidth: 0,
    margin: 0,
    fontFamily: font.ui,
    fontSize: 12,
    lineHeight: '14px',
    whiteSpace: 'nowrap'
  },
  stat: { display: 'flex', alignItems: 'center', gap: space.s4, minWidth: 0, margin: 0 },
  label: { margin: 0, fontWeight: 400, color: colors.cardFg },
  value: { margin: 0, fontWeight: 400, color: colors.cardFg },
  divider: { flexShrink: 0, width: 1, height: 10, backgroundColor: colors.cardBorderStrong },
  dealer: { color: colors.scoreDealer },
  buffer: { color: colors.scoreBuffer },
  top: { color: colors.tierTop },
  ranker: { color: colors.tierRanker },
  missing: { color: colors.cardBorderStrong },
  vacant: { color: colors.cardBorder }
})
