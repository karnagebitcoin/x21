import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useScrollVisibility } from '@/providers/ScrollVisibilityProvider'
import { ReactNode, useEffect, useRef, useState } from 'react'
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

  const updateIndicatorPosition = () => {
    const activeIndex = tabs.findIndex((tab) => tab.value === value)
    if (activeIndex >= 0 && tabRefs.current[activeIndex]) {
      const activeTab = tabRefs.current[activeIndex]
      const { offsetWidth, offsetLeft } = activeTab
      setIndicatorStyle({
        width: offsetWidth,
        left: offsetLeft
      })
    }
  }

  useEffect(() => {
    const animationId = requestAnimationFrame(() => {
      updateIndicatorPosition()
    })

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [tabs, value])

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
  }, [tabs, value])

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
        <div className="relative my-1 ml-1 flex w-fit rounded-2xl border border-border/70 bg-muted/70 p-1">
          {tabs.map((tab, index) => (
            <div
              key={tab.value}
              ref={(el) => (tabRefs.current[index] = el)}
              className={cn(
                'relative z-10 w-fit whitespace-nowrap rounded-xl px-6 py-2 text-center font-semibold clickable cursor-pointer',
                value === tab.value ? 'text-foreground' : 'text-muted-foreground'
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
            className="absolute inset-y-1 rounded-xl border border-border/70 bg-card shadow-sm transition-all duration-300"
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
