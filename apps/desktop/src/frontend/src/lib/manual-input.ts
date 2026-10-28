import { matchesDNFSearchNicknamePolicy } from '@dfragon/lib'

export function validManualNickname(nickname: string): boolean {
  return matchesDNFSearchNicknamePolicy(nickname) && nickname.isWellFormed()
}
