import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Check, Users } from 'lucide-react'
import { useNostr } from '@/providers/NostrProvider'
import { pubkeyToNpub } from '@/lib/pubkey'
import { toast } from 'sonner'
import { useWidgets } from '@/providers/WidgetsProvider'

export default function InviteWidget() {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [copied, setCopied] = useState(false)
  const { hideWidgetTitles } = useWidgets()

  const inviteLink = useMemo(() => {
    if (!pubkey) return ''
    const npub = pubkeyToNpub(pubkey)
    return `${window.location.origin}?invite=${npub}`
  }, [pubkey])

  const handleCopy = async () => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteLink)
        setCopied(true)
        toast.success(t('Invite link copied to clipboard!'))
        setTimeout(() => setCopied(false), 2000)
      } else {
        // Fallback to older method
        const textArea = document.createElement('textarea')
        textArea.value = inviteLink
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()

        const successful = document.execCommand('copy')
        document.body.removeChild(textArea)

        if (successful) {
          setCopied(true)
          toast.success(t('Invite link copied to clipboard!'))
          setTimeout(() => setCopied(false), 2000)
        } else {
          throw new Error('Copy command was unsuccessful')
        }
      }
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error(t('Failed to copy invite link'))
    }
  }

  if (!pubkey) return null

  return (
    <div className="p-4 space-y-4">
      {!hideWidgetTitles && (
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h3 className="font-semibold">{t('Invite Friends')}</h3>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t('Share this link to invite friends to x21')}
        </p>
        <div className="flex gap-2">
          <Input
            value={inviteLink}
            readOnly
            className="flex-1 text-xs"
            onClick={(e) => e.currentTarget.select()}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
