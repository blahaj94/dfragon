import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  // 설정 메뉴 아래쪽의 로그인 버튼. DFragon 디자인 캔버스의 설정 보드대로 메뉴 폭을 채우는 40 높이의
  // bg.control 면이다.
  button: {
    width: '100%',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    // 공용 보조 버튼의 투명 면과 같은 속성을 피해 배경 이미지로 채운다.
    backgroundImage: {
      default: `linear-gradient(${colors.bgControl}, ${colors.bgControl})`,
      ':hover:not(:disabled)': `linear-gradient(${colors.bgControlHover}, ${colors.bgControlHover})`
    }
  },
  // 브라우저 대기 중 점은 DFragon 디자인 캔버스의 로그인 버튼 보드대로 크림색이다. 버튼 글자색과 별개로 칠한다.
  waitingDots: { display: 'inline-flex', color: colors.brandCream }
})
