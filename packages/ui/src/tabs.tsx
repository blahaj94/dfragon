import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import * as stylex from '@stylexjs/stylex'
import type { ComponentType } from 'react'
import { controlStyles } from './control.style'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { styles } from './tabs.style'

export type TabsListProps = PublicProps<typeof BaseTabs.List>

// 탭 줄과 현재 탭 아래 선. 선은 Base UI Indicator가 현재 탭 위치를 따라간다.
function TabsListImpl({ children, className, style, ...props }: TabsListProps & ForwardedStyle) {
  return (
    <BaseTabs.List
      {...props}
      {...withForwardedStyle(stylex.props(styles.list), { className, style })}
    >
      {children}
      <BaseTabs.Indicator {...stylex.props(styles.indicator)} />
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
        stylex.props(styles.tab, controlStyles.focusRing, controlStyles.hoverTransition),
        { className, style }
      )}
    />
  )
}

const TabsTab: ComponentType<TabsTabProps> = TabsTabImpl

/** Base UI Tabs 부품. Root와 Panel은 Base UI 그대로이고 List와 Tab만 외형을 그린다. */
export const Tabs = {
  Root: BaseTabs.Root,
  List: TabsList,
  Tab: TabsTab,
  Panel: BaseTabs.Panel
}
