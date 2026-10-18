import { Menu as BaseMenu } from '@base-ui/react/menu'
import * as stylex from '@stylexjs/stylex'
import type { ComponentType } from 'react'
import { listboxStyles } from './listbox.style'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { styles } from './menu.style'

export type MenuPopupProps = PublicProps<typeof BaseMenu.Popup> &
  Pick<BaseMenu.Portal.Props, 'container'> &
  Pick<BaseMenu.Positioner.Props, 'side' | 'align' | 'sideOffset'>

// Portal, Positioner, Popup을 묶은 메뉴 목록. Select 목록과 같은 모양으로 trigger 아래에 펼친다.
function MenuPopupImpl({
  container,
  side = 'bottom',
  align = 'start',
  sideOffset = 4,
  className,
  style,
  ...props
}: MenuPopupProps & ForwardedStyle) {
  return (
    <BaseMenu.Portal container={container}>
      <BaseMenu.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        {...stylex.props(listboxStyles.positioner)}
      >
        <BaseMenu.Popup
          {...props}
          {...withForwardedStyle(stylex.props(listboxStyles.popup), { className, style })}
        />
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  )
}

const MenuPopup: ComponentType<MenuPopupProps> = MenuPopupImpl

export type MenuItemProps = PublicProps<typeof BaseMenu.Item>

function MenuItemImpl({ className, style, ...props }: MenuItemProps & ForwardedStyle) {
  return (
    <BaseMenu.Item
      {...props}
      {...withForwardedStyle(stylex.props(listboxStyles.item, styles.item), { className, style })}
    />
  )
}

const MenuItem: ComponentType<MenuItemProps> = MenuItemImpl

export type MenuRadioItemProps = PublicProps<typeof BaseMenu.RadioItem>

// 선택 상태를 알리는 menuitemradio. 현재 항목은 왼쪽 2px 막대와 신호색 글자로 보인다.
function MenuRadioItemImpl({
  children,
  className,
  style,
  ...props
}: MenuRadioItemProps & ForwardedStyle) {
  return (
    <BaseMenu.RadioItem
      {...props}
      {...withForwardedStyle(stylex.props(listboxStyles.item, styles.item), { className, style })}
    >
      <BaseMenu.RadioItemIndicator {...stylex.props(listboxStyles.marker)}>
        {null}
      </BaseMenu.RadioItemIndicator>
      {children}
    </BaseMenu.RadioItem>
  )
}

const MenuRadioItem: ComponentType<MenuRadioItemProps> = MenuRadioItemImpl

export type MenuGroupLabelProps = PublicProps<typeof BaseMenu.GroupLabel>

function MenuGroupLabelImpl({ className, style, ...props }: MenuGroupLabelProps & ForwardedStyle) {
  return (
    <BaseMenu.GroupLabel
      {...props}
      {...withForwardedStyle(stylex.props(listboxStyles.groupLabel), { className, style })}
    />
  )
}

const MenuGroupLabel: ComponentType<MenuGroupLabelProps> = MenuGroupLabelImpl

export type MenuSeparatorProps = PublicProps<typeof BaseMenu.Separator>

function MenuSeparatorImpl({ className, style, ...props }: MenuSeparatorProps & ForwardedStyle) {
  return (
    <BaseMenu.Separator
      {...props}
      {...withForwardedStyle(stylex.props(listboxStyles.separator), { className, style })}
    />
  )
}

const MenuSeparator: ComponentType<MenuSeparatorProps> = MenuSeparatorImpl

/**
 * Base UI Menu 부품. Root, Trigger, RadioGroup, Group은 Base UI 그대로다. Trigger는 화면마다
 * 모양이 달라 외형을 두지 않으며 `render`로 화면의 버튼을 연결한다.
 */
export const Menu = {
  Root: BaseMenu.Root,
  Trigger: BaseMenu.Trigger,
  Popup: MenuPopup,
  Item: MenuItem,
  RadioGroup: BaseMenu.RadioGroup,
  RadioItem: MenuRadioItem,
  Group: BaseMenu.Group,
  GroupLabel: MenuGroupLabel,
  Separator: MenuSeparator
}
