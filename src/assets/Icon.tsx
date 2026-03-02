import { useTheme } from '@/providers/ThemeProvider'
import { usePageTheme } from '@/providers/PageThemeProvider'
import { usePrimaryPage } from '@/PageManager'
import { cn } from '@/lib/utils'

export default function Icon({ className }: { className?: string }) {
  const { theme } = useTheme()
  const { pageTheme } = usePageTheme()
  const { navigate } = usePrimaryPage()

  // logo-dark.svg = white icon (for dark backgrounds)
  // logo-light.svg = black icon (for light backgrounds)
  const isDarkBackground = theme === 'dark' || pageTheme === 'pure-black'
  const iconSrc = isDarkBackground ? '/logo-dark.svg' : '/logo-light.svg'

  return (
    <div
      className={cn("flex items-center justify-center w-12 h-12 cursor-pointer", className)}
      onClick={() => navigate('home')}
    >
      <img
        src={iconSrc}
        alt="x21"
        className="w-12 h-12 object-contain"
      />
    </div>
  )
}
