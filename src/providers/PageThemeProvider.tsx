import storage from '@/services/local-storage.service'
import { TPageTheme } from '@/types'
import { createContext, useContext, useEffect, useState } from 'react'

type PageThemeProviderProps = {
  children: React.ReactNode
}

type PageThemeProviderState = {
  pageTheme: TPageTheme
  setPageTheme: (pageTheme: TPageTheme) => Promise<void>
}

const PageThemeProviderContext = createContext<PageThemeProviderState | undefined>(undefined)

export function PageThemeProvider({ children, ...props }: PageThemeProviderProps) {
  const [pageTheme, setPageTheme] = useState<TPageTheme>('default')

  useEffect(() => {
    const init = async () => {
      const savedPageTheme = storage.getPageTheme()
      setPageTheme(savedPageTheme)
    }

    init()
  }, [])

  useEffect(() => {
    const updatePageTheme = () => {
      const root = window.document.documentElement
      // Remove all page theme classes
      root.classList.remove('page-theme-default', 'page-theme-pure-black', 'page-theme-white')
      // Add the current page theme class
      root.classList.add(`page-theme-${pageTheme}`)
    }
    updatePageTheme()
  }, [pageTheme])

  return (
    <PageThemeProviderContext.Provider
      {...props}
      value={{
        pageTheme,
        setPageTheme: async (pageTheme: TPageTheme) => {
          storage.setPageTheme(pageTheme)
          setPageTheme(pageTheme)
        }
      }}
    >
      {children}
    </PageThemeProviderContext.Provider>
  )
}

export const usePageTheme = () => {
  const context = useContext(PageThemeProviderContext)

  if (context === undefined) throw new Error('usePageTheme must be used within a PageThemeProvider')

  return context
}
