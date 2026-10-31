import * as stylex from '@stylexjs/stylex'
import type { ChangeEvent } from 'react'
import { styles } from './SnapshotAdventureField.style'

export function SnapshotAdventureField({
  slot,
  value,
  notice,
  onChange
}: {
  slot: number
  value: string
  notice: string
  onChange: (value: string) => void
}): React.JSX.Element {
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.value)
  }

  return (
    <input
      type="text"
      aria-label={`${slot}번 모험단`}
      placeholder="모험단 입력"
      title={notice || undefined}
      value={value}
      onChange={handleChange}
      {...stylex.props(styles.field)}
    />
  )
}
