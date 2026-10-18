import * as stylex from '@stylexjs/stylex'
import { colors, font, space } from '@dfragon/ui/tokens.stylex'

// dfragon-design layout.md의 보조 창: 1280×800, 상단 바 56, 콘텐츠 여백 24와 12열 그리드(열 88, 거터 16).
// 캐릭터 카드는 주 영역 8열(816), 기본 정보는 보조 패널 4열(400)이다. 최소 창 1024에서는 같은 비율로
// 줄어든다. 그림 칸 높이는 작업자가 정했다.
export const styles = stylex.create({
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    boxSizing: 'border-box',
    backgroundColor: colors.bgCanvas,
    color: colors.fgDefault
  },
  content: { flex: 1, minHeight: 0, overflowY: 'auto', padding: space.s24 },
  error: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: space.s16 },
  body: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    alignItems: 'start',
    gap: space.s16
  },
  card: { gridColumn: 'span 8', minWidth: 0 },
  well: { height: 360, margin: space.s12, marginBottom: 0, overflow: 'hidden' },
  identity: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s4,
    paddingInline: space.s24,
    paddingTop: space.s16,
    paddingBottom: space.s24
  },
  adventure: { color: colors.cardFgAdventure },
  name: { overflowWrap: 'anywhere', color: colors.cardFg },
  job: { color: colors.cardFgMuted },
  // 보조 패널은 테두리 없이 면으로 구분한다.
  panel: {
    gridColumn: 'span 4',
    display: 'flex',
    flexDirection: 'column',
    gap: space.s24,
    padding: space.s16,
    backgroundColor: colors.bgSurface
  },
  fields: { display: 'flex', flexDirection: 'column', margin: 0 },
  field: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.s12,
    minWidth: 0,
    paddingBlock: space.s12,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  label: { flexShrink: 0, color: colors.fgSubtle },
  value: { minWidth: 0, margin: 0, textAlign: 'end', overflowWrap: 'anywhere' },
  missing: { color: colors.fgMuted },
  // 숫자 단계(dfragon-design typography.md)의 값 글자를 줄인 24 700이다.
  number: {
    fontFamily: font.num,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1
  },
  freshness: { display: 'flex', flexDirection: 'column', gap: space.s8, color: colors.fgMuted }
})
