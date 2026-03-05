import { Button, buttonVariants } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { VariantProps } from 'class-variance-authority'
import { Shield, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function HideUntrustedContentButton({
  type,
  size = 'icon'
}: {
  type: 'interactions' | 'notifications'
  size?: VariantProps<typeof buttonVariants>['size']
}) {
  const { t } = useTranslation()
  const {
    hideUntrustedInteractions,
    hideUntrustedNotifications,
    updateHideUntrustedInteractions,
    updateHideUntrustedNotifications
  } = useUserTrust()

  const enabled = type === 'interactions' ? hideUntrustedInteractions : hideUntrustedNotifications

  const updateEnabled =
    type === 'interactions' ? updateHideUntrustedInteractions : updateHideUntrustedNotifications

  const contentLabel = type === 'notifications' ? t('notifications') : t('activity')
  const title =
    type === 'notifications' ? t('Notification trust filter') : t('Activity trust filter')
  const toggleLabel =
    type === 'notifications'
      ? t('Hide untrusted notifications')
      : t('Hide untrusted activity')
  const description = t(
    'When this is on, {{content}} from people outside your network is hidden. Trusted people are people you follow and people they follow.',
    { content: contentLabel }
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size={size}>
          {enabled ? (
            <ShieldCheck className="text-green-400" />
          ) : (
            <Shield className="text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="space-y-1.5">
          <h4 className="font-semibold">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{toggleLabel}</p>
            <p className="text-xs text-muted-foreground">
              {enabled ? t('On') : t('Off')}
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={updateEnabled} />
        </div>
      </PopoverContent>
    </Popover>
  )
}
