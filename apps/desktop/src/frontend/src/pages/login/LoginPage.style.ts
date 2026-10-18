import * as stylex from '@stylexjs/stylex'
import { colors } from '../../constants/theme.stylex'

// 이전 공용 LayoutBlock의 머리, 본문, 바닥 세 칸 배치를 이 화면에서 그대로 그린다.
export const styles = stylex.create({
  page: { display: 'flex', flexDirection: 'column', gap: 24, paddingBlock: 24 },
  bar: {
    display: 'flex',
    alignItems: 'center',
    paddingInline: 24,
    paddingBlock: 16,
    backgroundColor: colors.bgSurface
  },
  title: { fontSize: 18, lineHeight: '26px', fontWeight: 700 },
  footer: { fontSize: 14, lineHeight: '20px', color: colors.fgSubtle },
  content: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    paddingInline: 24,
    paddingBlock: 40,
    backgroundColor: colors.bgSurface
  }
})
