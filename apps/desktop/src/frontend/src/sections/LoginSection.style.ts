import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

// 브라우저 대기 중 점은 DFragon 디자인 캔버스의 로그인 버튼 보드대로 크림색이다. 버튼 글자색과 별개로 칠한다.
export const styles = stylex.create({
  waitingDots: { display: 'inline-flex', color: colors.brandCream }
})
