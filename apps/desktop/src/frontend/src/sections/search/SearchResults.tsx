import { ContentStack, SupportingText } from '@ldb/ui'
import { SlotNicknameEditor, type SlotEditing } from '../../components/search/SlotNicknameEditor'
import type { SearchView } from './capture-search'
import { SlotResult } from './SlotResult'

export function SearchResults({
  view,
  retry,
  editing
}: {
  view: SearchView
  editing?: SlotEditing
  retry: (slot: number) => void
}): React.JSX.Element {
  return (
    <ContentStack>
      {view.connectionFailed && (
        <SupportingText>검색 연결을 확인할 수 없습니다. 앱 화면을 다시 열어 주세요.</SupportingText>
      )}
      {view.slots.map((slot) => (
        <SlotResult
          key={slot.slot}
          slot={slot}
          retryPending={view.retryPending[slot.slot]}
          retry={retry}
          editor={
            editing != null && (
              <SlotNicknameEditor
                slot={slot}
                active={view.captureActive === true}
                editing={editing}
              />
            )
          }
        />
      ))}
    </ContentStack>
  )
}
