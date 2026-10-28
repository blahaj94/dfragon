import { describe, expect, it } from 'vitest'
import { matchJobName, normalizeJobName } from './raid-job-name'

// 합성 직업명만 쓰며 표본이나 플레이어 식별자는 넣지 않는다.
describe('직업명 비교 규칙', () => {
  it('공백, 앞의 眞, 한글이 아닌 글자를 지운 뒤 같으면 exact다', () => {
    expect(normalizeJobName(' 眞 크루세이더 ')).toBe('크루세이더')
    expect(matchJobName('眞크루세이더', '眞 크루세이더')).toBe('exact')
    expect(matchJobName('크루세이더', '眞 크루세이더')).toBe('exact')
    expect(matchJobName('眞크루세이더-', '眞 크루세이더')).toBe('exact')
  })

  it('잘린 이름은 읽은 앞부분이나 마지막 한 글자를 뺀 앞부분이 4자 이상 같으면 clipped-prefix다', () => {
    expect(matchJobName('眞데몬슬레이', '眞 데몬슬레이어')).toBe('clipped-prefix')
    expect(matchJobName('眞소드마스E-', '眞 소드마스터')).toBe('clipped-prefix')
    expect(matchJobName('眞소드마스트', '眞 소드마스터')).toBe('clipped-prefix')
  })

  it('읽은 문자열이 眞으로 시작하지 않으면 첫 글자를 표식 오인식으로 보고 뺀 문자열로도 비교한다', () => {
    expect(matchJobName('핀소드마스터', '眞 소드마스터')).toBe('exact')
    expect(matchJobName('핀데몬슬레이', '眞 데몬슬레이어')).toBe('clipped-prefix')
    expect(matchJobName('眞핀소드마스터', '眞 소드마스터')).toBeNull()
  })

  it('앞부분 비교는 4자부터, 마지막 한 글자를 뺀 비교는 5자부터 허용한다', () => {
    expect(matchJobName('眞데몬슬레', '眞 데몬슬레이어')).toBe('clipped-prefix')
    expect(matchJobName('眞데몬슬', '眞 데몬슬레이어')).toBeNull()
    expect(matchJobName('眞데몬슬레아', '眞 데몬슬레이어')).toBe('clipped-prefix')
    expect(matchJobName('眞데몬슬래', '眞 데몬슬레이어')).toBeNull()
  })

  it('짧은 앞부분, 다른 직업, 후보보다 긴 문자열은 맞지 않는다', () => {
    expect(matchJobName('眞검', '眞 검귀')).toBeNull()
    expect(matchJobName('眞아수리', '眞 아수라')).toBeNull()
    expect(matchJobName('眞크루세이', '眞 크리에이터')).toBeNull()
    expect(matchJobName('眞소드마스터즈', '眞 소드마스터')).toBeNull()
    expect(matchJobName('眞', '眞 검귀')).toBeNull()
  })
})
