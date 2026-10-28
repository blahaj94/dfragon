import { Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { styles } from './NameField.style'

export type NameFieldTone = 'default' | 'selected' | 'waiting' | 'failure' | 'vacant'

export type NameFieldProps = Omit<ComponentPropsWithoutRef<'input'>, 'size'> & {
  tone?: NameFieldTone
  left?: ReactNode
  right?: ReactNode
}

export function NameField({
  tone = 'default',
  left,
  right,
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
      {left}
      <Typo.caption as="input" weight={700} {...inputProps} {...stylex.props(styles.name)} />
      {right}
    </div>
  )
}
