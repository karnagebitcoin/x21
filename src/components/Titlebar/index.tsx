import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useScrollVisibility } from '@/providers/ScrollVisibilityProvider'
import Icon from '@/assets/Icon'

export function Titlebar({
  children,
  className,
  hideBottomBorder = false
}: {
  children?: React.ReactNode
  className?: string
  hideBottomBorder?: boolean
}) {
  const { isSmallScreen } = useScreenSize()
  const { isVisible } = useScrollVisibility()

  return (
    <div
      className={cn(
        'sticky top-0 w-full h-12 z-40 bg-card/80 backdrop-blur-xl [&_svg]:size-5 [&_svg]:shrink-0 select-none',
        !hideBottomBorder && !isSmallScreen && 'border-b',
        isSmallScreen && 'transition-transform duration-300',
        isSmallScreen && !isVisible && '-translate-y-full',
        className
      )}
    >
      {children}
    </div>
  )
}
