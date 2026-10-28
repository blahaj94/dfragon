import { Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import type { NameFieldTone } from '../lib/name-field-tone'
import { styles } from './NameField.style'

export type NameFieldProps = Omit<ComponentPropsWithoutRef<'input'>, 'size'> & {
  tone?: NameFieldTone
  end?: ReactNode
}

export function NameField({
  tone = 'default',
  end,
  ...inputProps
}: NameFieldProps): React.JSX.Element {
  return (
    <div
      {...stylex.props(
        styles.field,
        tone === 'selected' && styles.fieldSelected,
        tone === 'waiting' && styles.fieldWaiting,
        tone === 'failure' && styles.fieldFailure,
        tone === 'vacant' && styles.fieldVacant
      )}
    >
      <Typo.caption as="input" weight={700} {...inputProps} {...stylex.props(styles.name)} />
      {end}
    </div>
  )
}
