import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useScrollVisibility } from '@/providers/ScrollVisibilityProvider'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollArea, ScrollBar } from '../ui/scroll-area'

type TabDefinition = {
  value: string
  label: string
}

export default function Tabs({
  tabs,
  value,
  onTabChange,
  threshold = 800,
  options = null,
  isInDeckView = false
}: {
  tabs: TabDefinition[]
  value: string
  onTabChange?: (tab: string) => void
  threshold?: number
  options?: ReactNode
  isInDeckView?: boolean
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { isVisible } = useScrollVisibility()

  const tabRefs = useRef<(HTMLDivElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 })
  const tabsKey = useMemo(() => tabs.map((tab) => tab.value).join('|'), [tabs])

  const updateIndicatorPosition = () => {
    const activeIndex = tabs.findIndex((tab) => tab.value === value)
    if (activeIndex >= 0 && tabRefs.current[activeIndex]) {
      const activeTab = tabRefs.current[activeIndex]
      const { offsetWidth, offsetLeft } = activeTab
      const padding = 24 // 12px padding on each side
      const nextStyle = {
        width: offsetWidth - padding,
        left: offsetLeft + padding / 2
      }
      setIndicatorStyle((current) =>
        current.width === nextStyle.width && current.left === nextStyle.left ? current : nextStyle
      )
    }
  }

  useEffect(() => {
    const animationId = requestAnimationFrame(() => {
      updateIndicatorPosition()
    })

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [tabsKey, value])

  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      updateIndicatorPosition()
    })

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            requestAnimationFrame(() => {
              updateIndicatorPosition()
            })
          }
        })
      },
      { threshold: 0 }
    )

    intersectionObserver.observe(containerRef.current)

    tabRefs.current.forEach((tab) => {
      if (tab) resizeObserver.observe(tab)
    })

    return () => {
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
    }
  }, [tabsKey, value])

  return (
    <div
      ref={containerRef}
      className={cn(
        'sticky flex justify-between bg-card/80 backdrop-blur-xl z-30 px-1 w-full',
        !isSmallScreen && 'border-b',
        isInDeckView ? 'top-0' : 'top-12',
        isSmallScreen && 'transition-transform duration-300',
        isSmallScreen && !isVisible && (isInDeckView ? '-translate-y-full' : '-translate-y-[calc(100%+3rem)]')
      )}
    >
      <ScrollArea className="flex-1 w-0">
        <div className="flex w-fit relative">
          {tabs.map((tab, index) => (
            <div
              key={tab.value}
              ref={(el) => (tabRefs.current[index] = el)}
              className={cn(
                `w-fit text-center py-2 px-6 my-1 font-semibold whitespace-nowrap clickable cursor-pointer rounded-lg`,
                value === tab.value ? '' : 'text-muted-foreground'
              )}
              onClick={() => {
                onTabChange?.(tab.value)
              }}
              style={{ fontSize: 'var(--font-size, 14px)' }}
            >
              {t(tab.label)}
            </div>
          ))}
          <div
            className="absolute bottom-0 h-1 bg-primary rounded-full transition-all duration-500"
            style={{
              width: `${indicatorStyle.width}px`,
              left: `${indicatorStyle.left}px`
            }}
          />
        </div>
        <ScrollBar orientation="horizontal" className="opacity-0 pointer-events-none" />
      </ScrollArea>
      {options && <div className="py-1 flex items-center">{options}</div>}
    </div>
  )
}
