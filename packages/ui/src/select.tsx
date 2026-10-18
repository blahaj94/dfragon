import { Select as BaseSelect } from '@base-ui/react/select'
import * as stylex from '@stylexjs/stylex'
import { type ComponentType, createContext, useContext } from 'react'
import { controlStyles } from './control.style'
import { ChevronDownIcon } from './icons'
import { listboxStyles } from './listbox.style'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { styles } from './select.style'
import type { ControlSurface } from './surface'

// 목록은 body portal에 그리므로 Popup이 받은 면을 항목, 그룹 라벨, 구분선에 넘긴다.
const SelectSurfaceContext = createContext<ControlSurface>('default')

export type SelectTriggerProps = PublicProps<typeof BaseSelect.Trigger> & {
  /** xs 24, sm 32, md 40px 높이. @default 'sm' */
  size?: 'xs' | 'sm' | 'md'
  /** 캐릭터 카드 위의 칩은 `card`. 같은 Select의 `Popup`에도 같은 값을 넘긴다. @default 'default' */
  surface?: ControlSurface
}

function SelectTriggerImpl({
  size = 'sm',
  surface = 'default',
  children,
  className,
  style,
  ...props
}: SelectTriggerProps & ForwardedStyle) {
  return (
    <BaseSelect.Trigger
      {...props}
      data-surface={surface}
      {...withForwardedStyle(
        stylex.props(
          styles.trigger,
          controlStyles.focusRing,
          controlStyles.hoverTransition,
          styles[size],
          surface === 'card' && styles.cardTrigger
        ),
        { className, style }
      )}
    >
      {children}
      <BaseSelect.Icon {...stylex.props(styles.icon)}>
        <ChevronDownIcon />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  )
}

const SelectTrigger: ComponentType<SelectTriggerProps> = SelectTriggerImpl

export type SelectValueProps = PublicProps<typeof BaseSelect.Value>

function SelectValueImpl({ className, style, ...props }: SelectValueProps & ForwardedStyle) {
  return (
    <BaseSelect.Value
      {...props}
      {...withForwardedStyle(stylex.props(styles.value), { className, style })}
    />
  )
}

const SelectValue: ComponentType<SelectValueProps> = SelectValueImpl

export type SelectPopupProps = PublicProps<typeof BaseSelect.Popup> &
  Pick<BaseSelect.Portal.Props, 'container'> &
  Pick<BaseSelect.Positioner.Props, 'side' | 'align' | 'sideOffset'> & {
    /** 캐릭터 카드에서 연 목록은 `card`. @default 'default' */
    surface?: ControlSurface
  }

// Portal, Positioner, Popup, List를 묶은 목록. trigger 바로 아래에서 위쪽을 기준으로 펼친다.
function SelectPopupImpl({
  container,
  side = 'bottom',
  align = 'start',
  sideOffset = 4,
  surface = 'default',
  children,
  className,
  style,
  'aria-label': label,
  'aria-labelledby': labelledBy,
  ...props
}: SelectPopupProps & ForwardedStyle) {
  return (
    <BaseSelect.Portal container={container}>
      <BaseSelect.Positioner
        alignItemWithTrigger={false}
        side={side}
        align={align}
        sideOffset={sideOffset}
        {...stylex.props(listboxStyles.positioner)}
      >
        <BaseSelect.Popup
          {...props}
          data-surface={surface}
          {...withForwardedStyle(
            stylex.props(listboxStyles.popup, surface === 'card' && listboxStyles.cardPopup),
            { className, style }
          )}
        >
          {/* Popup은 presentation이고 listbox 역할은 List가 가지므로 이름은 List에 붙인다. */}
          <BaseSelect.List aria-label={label} aria-labelledby={labelledBy}>
            <SelectSurfaceContext value={surface}>{children}</SelectSurfaceContext>
          </BaseSelect.List>
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  )
}

const SelectPopup: ComponentType<SelectPopupProps> = SelectPopupImpl

export type SelectItemProps = PublicProps<typeof BaseSelect.Item>

function SelectItemImpl({
  children,
  className,
  style,
  ...props
}: SelectItemProps & ForwardedStyle) {
  const surface = useContext(SelectSurfaceContext)
  const onCard = surface === 'card'

  return (
    <BaseSelect.Item
      {...props}
      data-surface={surface}
      {...withForwardedStyle(
        stylex.props(listboxStyles.item, styles.item, onCard && listboxStyles.cardItem),
        { className, style }
      )}
    >
      {/* 기본 글자(체크 이모지) 대신 빈 막대로 그린다. */}
      <BaseSelect.ItemIndicator
        {...stylex.props(listboxStyles.marker, onCard && listboxStyles.cardMarker)}
      >
        {null}
      </BaseSelect.ItemIndicator>
      {children}
    </BaseSelect.Item>
  )
}

const SelectItem: ComponentType<SelectItemProps> = SelectItemImpl

export type SelectGroupLabelProps = PublicProps<typeof BaseSelect.GroupLabel>

function SelectGroupLabelImpl({
  className,
  style,
  ...props
}: SelectGroupLabelProps & ForwardedStyle) {
  const onCard = useContext(SelectSurfaceContext) === 'card'

  return (
    <BaseSelect.GroupLabel
      {...props}
      {...withForwardedStyle(
        stylex.props(listboxStyles.groupLabel, onCard && listboxStyles.cardGroupLabel),
        { className, style }
      )}
    />
  )
}

const SelectGroupLabel: ComponentType<SelectGroupLabelProps> = SelectGroupLabelImpl

export type SelectSeparatorProps = PublicProps<typeof BaseSelect.Separator>

function SelectSeparatorImpl({
  className,
  style,
  ...props
}: SelectSeparatorProps & ForwardedStyle) {
  const onCard = useContext(SelectSurfaceContext) === 'card'

  return (
    <BaseSelect.Separator
      {...props}
      {...withForwardedStyle(
        stylex.props(listboxStyles.separator, onCard && listboxStyles.cardSeparator),
        { className, style }
      )}
    />
  )
}

const SelectSeparator: ComponentType<SelectSeparatorProps> = SelectSeparatorImpl

/**
 * Base UI Select 부품. Root, ItemText, Group은 Base UI 그대로이고 나머지는 외형만 그린다.
 * 항목 글자는 `Select.ItemText`로 감싸야 trigger의 `Select.Value`에 같은 글자가 보인다.
 */
export const Select = {
  Root: BaseSelect.Root,
  Trigger: SelectTrigger,
  Value: SelectValue,
  Popup: SelectPopup,
  Item: SelectItem,
  ItemText: BaseSelect.ItemText,
  Group: BaseSelect.Group,
  GroupLabel: SelectGroupLabel,
  Separator: SelectSeparator
}
