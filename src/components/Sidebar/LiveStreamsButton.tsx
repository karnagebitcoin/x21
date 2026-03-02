import { usePrimaryPage } from '@/PageManager'
import { useCompactSidebar } from '@/providers/CompactSidebarProvider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Radio } from 'lucide-react'
import SidebarItem from './SidebarItem'
import { useTranslation } from 'react-i18next'

export default function LiveStreamsButton() {
  const { t } = useTranslation()
  const { navigate, current } = usePrimaryPage()
  const { compactSidebar } = useCompactSidebar()
  const isActive = current === 'livestreams'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <SidebarItem
            onClick={() => navigate('livestreams')}
            className={cn(isActive && 'bg-primary/10')}
            aria-label={t('Live Streams')}
            title={t('Live Streams')}
          >
            <Radio className={cn('size-6', isActive && 'text-primary')} />
            {!compactSidebar && (
              <span className={cn('text-lg', isActive && 'font-semibold')}>
                {t('Live Streams')}
              </span>
            )}
          </SidebarItem>
        </div>
      </TooltipTrigger>
      {compactSidebar && (
        <TooltipContent side="right">
          <p>{t('Live Streams')}</p>
        </TooltipContent>
      )}
    </Tooltip>
  )
}
