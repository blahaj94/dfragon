import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import * as stylex from '@stylexjs/stylex'
import { type ComponentType, createContext, useContext } from 'react'
import { controlStyles } from './control.style'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import type { ControlSurface } from './surface'
import { styles } from './tabs.style'

// List가 받은 면을 안의 Tab에 넘긴다.
const TabsSurfaceContext = createContext<ControlSurface>('default')

export type TabsListProps = PublicProps<typeof BaseTabs.List> & {
  /**
   * `card`는 캐릭터 카드 아래의 면 탭이다. 탭이 폭을 나눠 채우고 현재 탭 선이 위쪽에 있으며
   * card* 토큰으로 그린다. @default 'default'
   */
  surface?: ControlSurface
}

// 탭 줄과 현재 탭 선. 선은 Base UI Indicator가 현재 탭 위치를 따라간다.
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
      {...withForwardedStyle(stylex.props(styles.list, onCard && styles.cardList), {
        className,
        style
      })}
    >
      <TabsSurfaceContext value={surface}>{children}</TabsSurfaceContext>
      <BaseTabs.Indicator {...stylex.props(styles.indicator, onCard && styles.cardIndicator)} />
    </BaseTabs.List>
  )
}

const TabsList: ComponentType<TabsListProps> = TabsListImpl

export type TabsTabProps = PublicProps<typeof BaseTabs.Tab>

function TabsTabImpl({ className, style, ...props }: TabsTabProps & ForwardedStyle) {
  const onCard = useContext(TabsSurfaceContext) === 'card'

  return (
    <BaseTabs.Tab
      {...props}
      data-surface={onCard ? 'card' : 'default'}
      {...withForwardedStyle(
        stylex.props(
          styles.tab,
          controlStyles.focusRing,
          controlStyles.hoverTransition,
          onCard && styles.cardTab
        ),
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
