import { matchesDNFSearchNicknamePolicy } from '@dfragon/lib'

/** 수동 입력이 유효한 유니코드 문자열이고, 앞뒤 공백 없이 2~12개 코드 포인트로 이루어졌는지 확인한다. */
export function validManualNickname(nickname: string): boolean {
  return matchesDNFSearchNicknamePolicy(nickname) && nickname.isWellFormed()
}
