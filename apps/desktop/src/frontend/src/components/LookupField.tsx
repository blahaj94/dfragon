import * as stylex from '@stylexjs/stylex'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { serverOptions } from '../constants/server-options'
import type { LookupDraft } from '../hooks/useLookupDraft'
import { useServerMenu } from '../hooks/useServerMenu'
import type { NameFieldTone } from '../lib/name-field-tone'
import { NameField } from './NameField'
import { ServerSelect } from './ServerSelect'
import { styles } from './LookupField.style'

export function LookupField({
  slot,
  tone,
  draft,
  size
}: {
  slot: number
  tone: NameFieldTone
  draft: Pick<
    LookupDraft,
    'name' | 'serverId' | 'changeName' | 'changeServer' | 'focusName' | 'blurName' | 'submit'
  >
  size: 'party' | 'raid'
}): React.JSX.Element {
  const serverMenu = useServerMenu()

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>): void => {
    draft.changeName(event.target.value)
  }

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      draft.submit()

      return
    }

    serverMenu.openOnTab(event)
  }

  return (
    <div {...stylex.props(styles.field, size === 'party' && styles.party)}>
      <NameField
        tone={tone}
        aria-label={`${slot}번 캐릭터 이름`}
        value={draft.name}
        onFocus={draft.focusName}
        onBlur={draft.blurName}
        onChange={handleNameChange}
        onKeyDown={handleNameKeyDown}
        end={
          <ServerSelect
            label={`${slot}번 서버`}
            value={draft.serverId}
            options={serverOptions}
            open={serverMenu.open}
            onOpenChange={serverMenu.setOpen}
            onValueChange={draft.changeServer}
          />
        }
      />
    </div>
  )
}
