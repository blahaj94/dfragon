import { Select } from '@seed-design/react'
import * as stylex from '@stylexjs/stylex'
import { styles } from './ServerSelect.style'

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
      placement="bottom-start"
      strategy="fixed"
      gutter={6}
    >
      <Select.Trigger aria-label={label} {...stylex.props(styles.trigger)}>
        <Select.Value {...stylex.props(styles.value)} />
        <Select.Placeholder {...stylex.props(styles.value)}>서버 선택</Select.Placeholder>
        <Select.SuffixIcon
          svg={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          }
          {...stylex.props(styles.chevron)}
        />
      </Select.Trigger>
      <Select.Positioner {...stylex.props(styles.positioner)}>
        <Select.Content aria-label={label} {...stylex.props(styles.content)}>
          <Select.ScrollArea {...stylex.props(styles.scroll)}>
            <Select.Group>
              <Select.GroupLabel {...stylex.props(styles.groupLabel)}>서버 선택</Select.GroupLabel>
              {options.map((option) => (
                <Select.Item
                  key={option.id}
                  value={option.id}
                  label={option.label}
                  {...stylex.props(styles.option, option.id === value && styles.selected)}
                >
                  <Select.ItemLabel {...stylex.props(styles.itemLabel)} />
                  <Select.ItemIndicator
                    selected={
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m5 12 4 4L19 6" />
                      </svg>
                    }
                    {...stylex.props(styles.check)}
                  />
                </Select.Item>
              ))}
            </Select.Group>
          </Select.ScrollArea>
        </Select.Content>
      </Select.Positioner>
    </Select.Root>
  )
}
