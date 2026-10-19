import * as stylex from '@stylexjs/stylex'
import { colors, font } from '@dfragon/ui/tokens.stylex'

// 카드 머리의 서버 칩 뒤에 두는 칩. 면 없이 안쪽 1px 선과 같은 색 글자로 보이고 오른쪽 위를 자른다
// (shapes.cutTopRight). 숫자 단계(dfragon-design typography.md)는 행간 1에 자릿수 폭을 고정한다.
export const styles = stylex.create({
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    fontFamily: font.num,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 700,
    lineHeight: 1
  },
  moved: { boxShadow: `inset 0 0 0 1px ${colors.cardSignal}`, color: colors.cardSignal },
  // 카드는 라이트 모드에서도 어두우므로 카드 위 경고색 bracketDanger를 쓰고, 면은 그 16%다.
  absent: {
    backgroundColor: `color-mix(in srgb, ${colors.bracketDanger} 16%, transparent)`,
    boxShadow: `inset 0 0 0 1px ${colors.bracketDanger}`,
    color: colors.bracketDanger
  },
  // 파티 카드: 높이 24, 글자 16.
  party: { height: 24, gap: 4, paddingInlineEnd: 9, fontSize: 16 },
  partyMoved: { paddingInlineStart: 6 },
  partyAbsent: { paddingInlineStart: 7 },
  // 공대 카드: 높이 20, 글자 14.
  raid: { height: 20, gap: 3, paddingInlineEnd: 8, fontSize: 14 },
  raidMoved: { paddingInlineStart: 5 },
  raidAbsent: { paddingInlineStart: 6 }
})
