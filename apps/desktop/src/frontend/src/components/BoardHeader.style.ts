import * as stylex from '@stylexjs/stylex'
import { colors, font, space } from '@dfragon/ui/tokens.stylex'

// 축소 시안은 파티, 공대 머리를 높이 44 상단 바 안 한 줄에 둔다. 제목은 12px 한글이고 인원수와 회차만
// Barlow Condensed 숫자다. 머리는 상단 바의 내비와 알림 사이 남는 폭을 채운다.
export const styles = stylex.create({
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s16,
    flexGrow: 1,
    minWidth: 0
  },
  title: { display: 'flex', alignItems: 'baseline', gap: space.s8, minWidth: 0 },
  heading: {
    flexShrink: 0,
    margin: 0,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: '14px',
    color: colors.fgDefault
  },
  number: {
    flexShrink: 0,
    color: colors.fgDefault,
    fontFamily: font.num,
    fontSize: 16,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1
  },
  // 스냅샷 회차 번호(`#2`). 색은 신호색이라 크림이다.
  round: { color: colors.signal },
  total: { color: colors.fgSubtle },
  // 안내가 길면 한 줄에서 말줄임하고 전체 문구는 title과 status 영역으로 전한다. title 툴팁이 뜨도록 상단
  // 바의 끌기 영역에서 뺀다. 한글 12px, 행간 14px은 Typo.caption의 행간 18px 대신 직접 준다.
  notice: {
    position: 'relative',
    WebkitAppRegion: 'no-drag',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: colors.fgMuted,
    fontSize: 12,
    lineHeight: '14px'
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s12,
    flexShrink: 0,
    marginInlineStart: 'auto'
  }
})
