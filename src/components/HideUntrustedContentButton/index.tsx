import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
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
  const title = enabled
    ? type === 'notifications'
      ? t('Show all notifications?')
      : t('Show all activity?')
    : type === 'notifications'
      ? t('Hide untrusted notifications?')
      : t('Hide untrusted activity?')
  const description = enabled
    ? t(
        'Right now, {{content}} from people outside your network is hidden. Trusted people are people you follow and people they follow. Continue to show all {{content}}.',
        { content: contentLabel }
      )
    : t(
        'Right now, you see all {{content}}. Trusted people are people you follow and people they follow. Continue to hide {{content}} from people outside your network.',
        { content: contentLabel }
      )

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size={size}>
          {enabled ? (
            <ShieldCheck className="text-green-400" />
          ) : (
            <Shield className="text-muted-foreground" />
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => updateEnabled(!enabled)}>
            {t('Continue')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
