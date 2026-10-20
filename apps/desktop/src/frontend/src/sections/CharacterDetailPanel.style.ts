import * as stylex from '@stylexjs/stylex'
import { colors, font, motion, radius, space } from '@dfragon/ui/tokens.stylex'

// DFragon 디자인 캔버스 상세 창 보드의 540 × 650 패널. 창 전체를 채우고, 머리 40, 캐릭터 칸, 탭 40 아래의
// 탭 내용만 스크롤한다. 카드 면 색이라 라이트 테마에서도 다크다.
export const styles = stylex.create({
  // 카드 테두리의 모서리 꺾쇠는 1px 바깥에 놓여 창 밖으로 나간다. 그 1px이 문서를 넘쳐 Windows에서 창 전체
  // 스크롤바가 생기지 않도록 패널 밖을 자른다.
  panel: {
    display: 'grid',
    gridTemplateRows: 'minmax(0, 1fr)',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: colors.cardBg
  },
  header: {
    position: 'relative',
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    gap: space.s8,
    height: 40,
    paddingLeft: space.s16,
    paddingRight: space.s4,
    backgroundColor: colors.bgWell
  },
  // 머리 전체를 덮는 빈 요소가 끌기 영역이고, 서버와 순위, 시각, 닫기 버튼은 그 위에 놓인다.
  dragArea: { position: 'absolute', inset: 0, WebkitAppRegion: 'drag' },
  server: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    height: 22,
    paddingInline: space.s8,
    borderRadius: radius.control,
    backgroundColor: colors.cardControl,
    fontSize: 12,
    fontWeight: 600,
    lineHeight: '16px',
    whiteSpace: 'nowrap'
  },
  rank: {
    position: 'relative',
    fontFamily: font.num,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 16,
    fontWeight: 600,
    lineHeight: '20px',
    color: colors.cardFgMuted
  },
  spacer: { flex: 1 },
  fetched: {
    position: 'relative',
    fontSize: 12,
    lineHeight: '16px',
    color: colors.cardFgSubtle,
    whiteSpace: 'nowrap',
    // 마우스 설명(날짜와 시각)이 뜨도록 끌기 영역에서 뺀다.
    WebkitAppRegion: 'no-drag'
  },
  close: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 32,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: { default: colors.cardFgSubtle, ':hover': colors.cardFg },
    cursor: 'pointer',
    WebkitAppRegion: 'no-drag',
    outline: { default: 'none', ':focus-visible': `2px solid ${colors.cardSignal}` },
    outlineOffset: -2,
    transitionProperty: 'color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  profile: {
    display: 'grid',
    flexShrink: 0,
    gridTemplateColumns: '112px minmax(0, 1fr)',
    gap: 20,
    paddingBlock: 14,
    paddingInline: 20
  },
  portrait: { height: 120, overflow: 'hidden' },
  identity: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  affiliation: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    minWidth: 0,
    fontSize: 12,
    fontWeight: 600,
    lineHeight: '16px'
  },
  adventure: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: colors.cardFgAdventure
  },
  // 길드 이름은 유니크 희귀도 색이다(dfragon-design colors.md, 메인 카드와 같음).
  guild: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: colors.rarityUnique
  },
  affiliationMissing: { color: colors.cardBorderStrong },
  affiliationDivider: {
    flexShrink: 0,
    width: 1,
    height: 10,
    backgroundColor: colors.cardBorderStrong
  },
  nameLine: { display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0, marginTop: 2 },
  name: {
    minWidth: 0,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 24,
    lineHeight: '32px'
  },
  job: {
    flexShrink: 0,
    fontSize: 13,
    lineHeight: '18px',
    color: colors.cardFgMuted,
    whiteSpace: 'nowrap'
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: space.s16,
    margin: 0,
    marginTop: 'auto'
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.cardBorder
  },
  statLabel: { fontSize: 12, lineHeight: '16px', color: colors.cardFgSubtle },
  statValue: {
    margin: 0,
    fontFamily: font.num,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 32,
    fontWeight: 700,
    lineHeight: '32px'
  },
  statMissing: { color: colors.cardBorderStrong },
  statDealer: { color: colors.scoreDealer },
  statBuffer: { color: colors.scoreBuffer },
  tabs: { display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 },
  // 공용 탭의 외형을 그대로 쓰고, 첫 탭 글자가 패널 안쪽 여백 20에 맞도록 줄 양옆만 띄운다.
  tabList: { flexShrink: 0, paddingInline: space.s4 },
  tabPanel: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    boxSizing: 'border-box',
    paddingTop: space.s12,
    paddingInline: 20,
    paddingBottom: space.s16,
    scrollbarWidth: 'thin',
    scrollbarColor: `${colors.cardBorderStrong} transparent`,
    outline: { default: 'none', ':focus-visible': `2px solid ${colors.cardSignal}` },
    outlineOffset: -2
  },
  equipment: {
    display: { default: 'grid', ':is([hidden])': 'none' },
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    alignItems: 'start',
    gap: 20
  },
  column: { display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 },
  skills: { display: { default: 'block', ':is([hidden])': 'none' } },
  skillNotice: {
    display: 'block',
    paddingBlock: space.s24,
    textAlign: 'center',
    color: colors.cardFgSubtle
  }
})
