import { Button } from '@/components/ui/button'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Loader } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function MuteButton({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey, checkLogin } = useNostr()
  const { mutePubkeySet, changing, mutePubkey, unmutePubkey } = useMuteList()
  const [updating, setUpdating] = useState(false)
  const isMuted = useMemo(() => mutePubkeySet.has(pubkey), [mutePubkeySet, pubkey])

  if (!accountPubkey || (pubkey && pubkey === accountPubkey)) return null

  const handleMute = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (isMuted) return

      setUpdating(true)
      try {
        await mutePubkey(pubkey)
      } catch (error) {
        toast.error(`${t('Mute failed')}: ${(error as Error).message}`)
      } finally {
        setUpdating(false)
      }
    })
  }

  const handleUnmute = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (!isMuted) return

      setUpdating(true)
      try {
        await unmutePubkey(pubkey)
      } catch (error) {
        toast.error(`${t('Unmute failed')}: ${(error as Error).message}`)
      } finally {
        setUpdating(false)
      }
    })
  }

  if (isMuted) {
    return (
      <Button
        className="w-20 min-w-20 rounded-full"
        variant="secondary"
        onClick={handleUnmute}
        disabled={updating || changing}
        aria-label={t('Unmute')}
        aria-pressed="true"
      >
        {updating ? <Loader className="animate-spin" aria-hidden="true" /> : t('Unmute')}
      </Button>
    )
  }

  return (
    <Button
      variant="destructive"
      className="w-20 min-w-20 rounded-full"
      onClick={handleMute}
      disabled={updating || changing}
      aria-label={t('Mute')}
      aria-pressed="false"
    >
      {updating ? <Loader className="animate-spin" aria-hidden="true" /> : t('Mute')}
    </Button>
  )
}
