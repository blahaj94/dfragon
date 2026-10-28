import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import * as stylex from '@stylexjs/stylex'
import type { ComponentType } from 'react'
import { controlStyles } from './control.style'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import type { ControlSurface } from './surface'
import { styles } from './tabs.style'

export type TabsListProps = PublicProps<typeof BaseTabs.List> & {
  surface?: ControlSurface
}

function TabsListImpl({
  surface = 'default',
  children,
  className,
  style,
  ...props
}: TabsListProps & ForwardedStyle) {
  const onCard = surface === 'card'

  return (
    <BaseTabs.List
      {...props}
      data-surface={surface}
      {...withForwardedStyle(
        stylex.props(styles.list, onCard && styles.cardList, stylex.defaultMarker()),
        { className, style }
      )}
    >
      {children}
      <BaseTabs.Indicator {...stylex.props(styles.indicator, onCard && styles.cardIndicator)} />
    </BaseTabs.List>
  )
}

const TabsList: ComponentType<TabsListProps> = TabsListImpl

export type TabsTabProps = PublicProps<typeof BaseTabs.Tab>

function TabsTabImpl({ className, style, ...props }: TabsTabProps & ForwardedStyle) {
  return (
    <BaseTabs.Tab
      {...props}
      {...withForwardedStyle(
        stylex.props(
          styles.tab,
          controlStyles.focusRing,
          controlStyles.hoverTransition,
          styles.focusRing
        ),
        { className, style }
      )}
    />
  )
}

const TabsTab: ComponentType<TabsTabProps> = TabsTabImpl

export const Tabs = {
  Root: BaseTabs.Root,
  List: TabsList,
  Tab: TabsTab,
  Panel: BaseTabs.Panel
}
