import { useTheme } from '@/providers/ThemeProvider'
import { usePageTheme } from '@/providers/PageThemeProvider'
import { usePrimaryPage } from '@/PageManager'
import { cn } from '@/lib/utils'

export default function Logo({ className }: { className?: string }) {
  const { theme } = useTheme()
  const { pageTheme } = usePageTheme()
  const { navigate } = usePrimaryPage()

  // logo-dark.svg = white logo (for dark backgrounds)
  // logo-light.svg = black logo (for light backgrounds)
  const isDarkBackground = theme === 'dark' || pageTheme === 'pure-black'
  const logoSrc = isDarkBackground ? '/logo-dark.svg' : '/logo-light.svg'

  return (
    <img
      src={logoSrc}
      alt="x21"
      className={cn("w-full h-auto max-w-[48px] cursor-pointer", className)}
      onClick={() => navigate('home')}
    />
  )
}
