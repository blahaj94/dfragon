import { typographyVariants } from '@dfragon/ui'
import { ChevronDownIcon } from './ChevronDownIcon'
import { CheckIcon } from './CheckIcon'
import { Select } from '@seed-design/react'
import * as stylex from '@stylexjs/stylex'
import { styles } from './ServerSelect.style'

// The typography variant sets font-weight inline, so the selected weight has to be inline too.
const selectedLabelTypography = { ...typographyVariants.txtS, fontWeight: 700 }

type ServerSelectProps = {
  label: string
  value: string
  options: readonly { id: string; label: string }[]
  disabled?: boolean
  onValueChange: (id: string) => void
}

export function ServerSelect({
  label,
  value,
  options,
  disabled = false,
  onValueChange
}: ServerSelectProps): React.JSX.Element {
  return (
    <Select.Root
      value={value ? [value] : []}
      onValueChange={(values) => {
        if (values[0] != null) {
          onValueChange(values[0])
        }
      }}
      disabled={disabled}
      size="medium"
      placement="bottom-start"
      strategy="fixed"
      gutter={6}
    >
      <Select.Trigger aria-label={label} {...stylex.props(styles.trigger)}>
        <Select.Value style={typographyVariants.caption} {...stylex.props(styles.value)} />
        <Select.Placeholder style={typographyVariants.caption} {...stylex.props(styles.value)}>
          서버
        </Select.Placeholder>
        <Select.SuffixIcon svg={<ChevronDownIcon />} {...stylex.props(styles.chevron)} />
      </Select.Trigger>
      <Select.Positioner {...stylex.props(styles.positioner)}>
        <Select.Content aria-label={label} {...stylex.props(styles.content)}>
          <Select.ScrollArea {...stylex.props(styles.scroll)}>
            {options.map((option) => {
              const selected = option.id === value

              return (
                <Select.Item
                  key={option.id}
                  value={option.id}
                  label={option.label}
                  {...stylex.props(styles.option, selected && styles.selected)}
                >
                  <Select.ItemLabel
                    style={selected ? selectedLabelTypography : typographyVariants.txtS}
                    {...stylex.props(styles.itemLabel, selected && styles.selectedLabel)}
                  />
                  <Select.ItemIndicator selected={<CheckIcon />} {...stylex.props(styles.check)} />
                </Select.Item>
              )
            })}
          </Select.ScrollArea>
        </Select.Content>
      </Select.Positioner>
    </Select.Root>
  )
}
