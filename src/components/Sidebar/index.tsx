import Icon from '@/assets/Icon'
import Logo from '@/assets/Logo'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useCompactSidebar } from '@/providers/CompactSidebarProvider'
import { useLogoStyle } from '@/providers/LogoStyleProvider'
import { useLogoFontSize } from '@/providers/LogoFontSizeProvider'
import { useMenuItems } from '@/providers/MenuItemsProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useLayoutMode } from '@/providers/LayoutModeProvider'
import { usePrimaryPage } from '@/PageManager'
import { LAYOUT_MODE } from '@/constants'
import { cn } from '@/lib/utils'
import AccountButton from './AccountButton'
import RelaysButton from './ExploreButton'
import HomeButton from './HomeButton'
import NotificationsButton from './NotificationButton'
import PostButton from './PostButton'
import ReadsButton from './ReadsButton'
import ListsButton from './ListsButton'
import SearchButton from './SearchButton'
import LiveStreamsButton from './LiveStreamsButton'
import MultiColumnToggle from './MultiColumnToggle'
import { forwardRef } from 'react'

// Wrapper component to add opacity effect to nav items
const NavItemWrapper = forwardRef<HTMLDivElement, { children: React.ReactNode; dimmed?: boolean; active?: boolean }>(
  ({ children, dimmed = false, active = false }, ref) => {
    if (!dimmed) {
      return <>{children}</>
    }
    return (
      <div ref={ref} className={cn(
        "transition-opacity duration-300",
        active ? "opacity-100" : "opacity-40 hover:opacity-100"
      )}>
        {children}
      </div>
    )
  }
)
NavItemWrapper.displayName = 'NavItemWrapper'

export default function PrimaryPageSidebar() {
  const { isSmallScreen } = useScreenSize()
  const { compactSidebar } = useCompactSidebar()
  const { logoStyle, customLogoText } = useLogoStyle()
  const { logoFontSize } = useLogoFontSize()
  const { menuItems } = useMenuItems()
  const { layoutMode } = useLayoutMode()
  const { current, navigate } = usePrimaryPage()

  if (isSmallScreen) return null

  const isIslandMode = layoutMode === LAYOUT_MODE.ISLAND

  // Get visible menu items sorted by order
  const visibleMenuItems = menuItems
    .filter(item => item.visible && item.canReorder)
    .sort((a, b) => a.order - b.order)

  // Get deck toggle visibility
  const deckItem = menuItems.find(item => item.id === 'deck')
  const showDeck = deckItem?.visible ?? true

  // Map menu item IDs to components
  const menuItemComponents: Record<string, JSX.Element> = {
    home: <HomeButton />,
    reads: <ReadsButton />,
    lists: <ListsButton />,
    explore: <RelaysButton />,
    notifications: <NotificationsButton />,
    search: <SearchButton />,
    livestreams: <LiveStreamsButton />,
    post: <PostButton />
  }

  return (
    <TooltipProvider>
      <nav
        className={cn(
          "flex flex-col pb-2 pt-4 px-2 h-full shrink-0 transition-all duration-300",
          compactSidebar ? "w-16" : "w-16 xl:w-52 xl:px-4",
          isIslandMode && "bg-card/80 backdrop-blur-sm shadow-lg",
          isIslandMode ? "justify-start" : "justify-between"
        )}
        aria-label="Primary navigation"
      >
      <div className={cn(
        "mb-6 w-full transition-all duration-300",
        compactSidebar ? "" : "xl:px-4",
        "opacity-50 hover:opacity-100 transition-opacity duration-300"
      )}>
        <Icon className={cn(compactSidebar ? "" : "xl:hidden")} />
        {logoStyle === 'image' ? (
          <Logo className={cn(compactSidebar ? "hidden" : "max-xl:hidden")} />
        ) : (
          <div
            className={cn(
              "font-bold max-xl:hidden cursor-pointer",
              compactSidebar && "hidden"
            )}
            style={{ fontSize: `${logoFontSize}px` }}
            onClick={() => navigate('home')}
          >
            {customLogoText}
          </div>
        )}
      </div>
      <div className={cn(
        "space-y-2",
        isIslandMode && "flex-1 flex flex-col justify-center"
      )}>
        {visibleMenuItems.map((item) => {
          const component = menuItemComponents[item.id]
          if (!component) return null

          return (
            <NavItemWrapper
              key={item.id}
              dimmed
              active={current === item.id}
            >
              {component}
            </NavItemWrapper>
          )
        })}
      </div>
      <div className="space-y-2 mt-auto">
        {showDeck && (
          <NavItemWrapper dimmed>
            <MultiColumnToggle />
          </NavItemWrapper>
        )}
        <AccountButton />
      </div>
      </nav>
    </TooltipProvider>
  )
}
