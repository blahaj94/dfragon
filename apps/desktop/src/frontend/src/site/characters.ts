import type { SelectedCharacterSummary } from '../../../preload/common/types/character'
import type { CharacterChoice, SearchSlot } from '../../../preload/common/types/search'
import type { CardCharacter, CharacterCard } from '../types/cards'
import type { ServerId } from '../types/servers'
import portrait01 from './assets/portrait-01.png'
import portrait02 from './assets/portrait-02.png'
import portrait03 from './assets/portrait-03.png'
import portrait04 from './assets/portrait-04.png'
import portrait05 from './assets/portrait-05.png'
import portrait06 from './assets/portrait-06.png'
import portrait07 from './assets/portrait-07.png'
import portrait08 from './assets/portrait-08.png'
import portrait09 from './assets/portrait-09.png'
import portrait10 from './assets/portrait-10.png'
import portrait11 from './assets/portrait-11.png'
import portrait12 from './assets/portrait-12.png'

const SCORE_VERSIONS = { package: 'dnfscore', rulesRev: 'rev12', bundleId: 'site' }

function dealerCard(value: number): CharacterCard {
  return {
    role: 'dealer',
    score: {
      calculator: 'equipment',
      value,
      skipped: null,
      approximate: null,
      versions: SCORE_VERSIONS
    }
  }
}

function bufferCard(value: number): CharacterCard {
  return {
    role: 'buffer',
    score: {
      calculator: 'buff',
      value,
      skipped: null,
      approximate: null,
      versions: SCORE_VERSIONS
    }
  }
}

const members: readonly [string, ServerId, number, CharacterCard, string][] = [
  [portrait01, 'siroco', 130000, dealerCard(614806), '웨펀마스터'],
  [portrait02, 'cain', 130000, dealerCard(581240), '넨마스터'],
  [portrait03, 'siroco', 125000, dealerCard(523410), '스트라이커'],
  [portrait04, 'siroco', 125000, bufferCard(135800), '크루세이더'],
  [portrait05, 'siroco', 125000, dealerCard(702310), '트러블슈터'],
  [portrait06, 'siroco', 125000, dealerCard(755900), '비질란테'],
  [portrait07, 'siroco', 125000, dealerCard(591760), '엘레멘탈마스터'],
  [portrait08, 'siroco', 125000, bufferCard(134200), '크루세이더'],
  [portrait09, 'siroco', 125000, dealerCard(548480), '스트리트파이터'],
  [portrait10, 'siroco', 125000, dealerCard(437150), '소울브링어'],
  [portrait11, 'siroco', 125000, dealerCard(689120), '버서커'],
  [portrait12, 'siroco', 125000, bufferCard(130900), '뮤즈']
]

export const raidCharacters: readonly CardCharacter[] = members.map(
  ([image, serverId, fame, card, job], index) => ({
    characterId: `site-${index + 1}`,
    name: `캐릭터${index + 1}`,
    adventure: `모험단${index + 1}`,
    guild: '길드',
    job,
    serverId,
    fame,
    card,
    image
  })
)

export const partyCharacters = raidCharacters.slice(0, 4)

export const changedThirdCharacter: CardCharacter = {
  ...partyCharacters[2],
  characterId: 'site-changed-3',
  adventure: '모험단13'
}

const candidateFace = { x: 76, y: 56, width: 48, height: 48 }

type SiteCandidate = CharacterChoice & {
  serverId: ServerId
  serverName: string
  adventureName: string
  image: string
}

function candidate(
  serverId: ServerId,
  serverName: string,
  fame: number,
  image: string,
  adventureName: string
): SiteCandidate {
  return {
    characterId: `site-candidate-${serverId}`,
    characterName: '캐릭터1',
    serverId,
    serverName,
    fame,
    adventureName,
    face: candidateFace,
    image
  }
}

const candidates: readonly SiteCandidate[] = [
  candidate('siroco', '시로코', 125850, portrait01, '모험단1'),
  candidate('cain', '카인', 98420, portrait02, '모험단14'),
  candidate('hilder', '힐더', 61300, portrait03, '모험단15'),
  candidate('anton', '안톤', 44120, portrait04, '모험단16')
]

export function candidateImage(choice: CharacterChoice): string {
  const found = candidates.find((candidate) => candidate.serverId === choice.serverId)
  if (found === undefined) {
    return ''
  }

  return found.image
}

export function candidateCharacter(serverId: string): CardCharacter {
  const picked = candidates.find((choice) => choice.serverId === serverId) ?? candidates[0]
  if (picked === candidates[0]) {
    return partyCharacters[0]
  }

  return {
    ...partyCharacters[0],
    characterId: picked.characterId,
    serverId: picked.serverId,
    fame: picked.fame,
    adventure: picked.adventureName,
    image: picked.image
  }
}

function selectedSummary(choice: SiteCandidate): SelectedCharacterSummary {
  return {
    serverId: choice.serverId,
    characterId: choice.characterId,
    characterName: choice.characterName,
    serverName: choice.serverName,
    adventureName: choice.adventureName,
    jobName: null,
    jobGrowName: null,
    level: null,
    fame: choice.fame,
    imageUrl: '',
    guildName: null,
    equipmentScore: null,
    card: null
  }
}

export function candidateSlot(round: number, shownServerId: string): SearchSlot {
  const shown = candidates.find((choice) => choice.serverId === shownServerId) ?? candidates[0]

  return {
    slot: 0,
    observationRevision: round,
    requestId: `site-candidate-${round}`,
    nickname: null,
    state: 'success',
    rows: candidates,
    error: null,
    selected: selectedSummary(shown),
    choices: candidates
  }
}
