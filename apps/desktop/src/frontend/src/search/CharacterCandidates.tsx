import { SupportingText } from '@ldb/ui'
import type { CharacterSearchRow } from '../../../preload/common/types/search'
import './character-candidates.css'

const fameFormat = new Intl.NumberFormat('ko-KR', { maximumSignificantDigits: 21 })

export function CharacterCandidates({
  rows
}: {
  rows: readonly CharacterSearchRow[]
}): React.JSX.Element {
  return (
    <ol className="character-candidates__list" role="list" aria-label="캐릭터 검색 후보">
      {rows.map((row, index) => (
        <li className="character-candidates__item" key={`${index}:${row.characterId}`}>
          <div className="character-candidates__overview">
            <div className="character-candidates__identity">
              <SupportingText>
                <strong className="character-candidates__name">{row.characterName}</strong>
              </SupportingText>
              <SupportingText>{row.serverName ?? row.serverId}</SupportingText>
            </div>
            <dl className="character-candidates__fame">
              <dt>명성</dt>
              <dd>{row.fame == null ? '정보 없음' : fameFormat.format(row.fame)}</dd>
            </dl>
          </div>
          <details className="character-candidates__details">
            <summary
              aria-label={`${row.characterName} · ${row.serverName ?? row.serverId} 식별 정보`}
            >
              식별 정보
            </summary>
            <dl className="character-candidates__identifiers">
              <div>
                <dt>서버 ID</dt>
                <dd>{row.serverId}</dd>
              </div>
              <div>
                <dt>캐릭터 ID</dt>
                <dd>{row.characterId}</dd>
              </div>
            </dl>
          </details>
        </li>
      ))}
    </ol>
  )
}
