import { ipcRenderer } from 'electron'
import type { AsyncIPCFunctions } from '../common/types/ipc'
import { SEARCH_SLOT_COUNTS, type SearchCommandResult } from '../common/types/search'
import { parseSearchResult } from '../common/search/snapshot'

type SearchChannel =
  | 'controlCharacterSearch'
  | 'notifyStableNicknameDetected'
  | 'notifyOcrCandidatesDetected'
  | 'controlManualSearch'
  | 'notifyManualNickname'
  | 'controlRaidSearch'
  | 'notifyRaidOcrCandidatesDetected'

export async function invokeSearchCommand<Channel extends SearchChannel>(
  channel: Channel,
  ...args: Parameters<AsyncIPCFunctions[Channel]>
): Promise<SearchCommandResult> {
  const value: unknown = await ipcRenderer.invoke(channel, ...args)
  // 공대 수명의 채널만 12자리이고 나머지 검색 채널은 파티 4자리다.
  const isRaidChannel =
    channel === 'controlRaidSearch' || channel === 'notifyRaidOcrCandidatesDetected'
  const slotCount = isRaidChannel ? SEARCH_SLOT_COUNTS.raid : SEARCH_SLOT_COUNTS.party
  const result = parseSearchResult(value, slotCount)
  const isValid = result != null
  if (!isValid) {
    throw new Error('검색 연결의 응답을 확인하지 못했습니다.')
  }

  return result
}
