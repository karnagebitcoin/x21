import { createContext, useContext, useEffect, useRef, useState } from 'react'

type TScrollVisibilityContext = {
  isVisible: boolean
}

const ScrollVisibilityContext = createContext<TScrollVisibilityContext | undefined>(undefined)

export const useScrollVisibility = () => {
  const context = useContext(ScrollVisibilityContext)
  if (!context) {
    throw new Error('useScrollVisibility must be used within a ScrollVisibilityProvider')
  }
  return context
}

export function ScrollVisibilityProvider({
  children,
  isSmallScreen
}: {
  children: React.ReactNode
  isSmallScreen: boolean
}) {
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollYRef = useRef(0)
  const scrollDirectionRef = useRef<'up' | 'down'>('up')
  const scrollAccumulatorRef = useRef(0)

  useEffect(() => {
    if (!isSmallScreen) {
      setIsVisible(true)
      return
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollDelta = currentScrollY - lastScrollYRef.current

      // Determine scroll direction
      const newDirection = scrollDelta > 0 ? 'down' : 'up'

      // Reset accumulator if direction changed
      if (newDirection !== scrollDirectionRef.current) {
        scrollAccumulatorRef.current = 0
        scrollDirectionRef.current = newDirection
      }

      // Accumulate scroll distance
      scrollAccumulatorRef.current += Math.abs(scrollDelta)

      // Show when at top
      if (currentScrollY < 50) {
        setIsVisible(true)
      }
      // Hide when scrolling down with enough accumulated distance (50px threshold)
      else if (newDirection === 'down' && scrollAccumulatorRef.current > 50) {
        setIsVisible(false)
        scrollAccumulatorRef.current = 0
      }
      // Show when scrolling up with enough accumulated distance (30px threshold - easier to show)
      else if (newDirection === 'up' && scrollAccumulatorRef.current > 30) {
        setIsVisible(true)
        scrollAccumulatorRef.current = 0
      }

      lastScrollYRef.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [isSmallScreen])

  return (
    <ScrollVisibilityContext.Provider value={{ isVisible }}>
      {children}
    </ScrollVisibilityContext.Provider>
  )
}
