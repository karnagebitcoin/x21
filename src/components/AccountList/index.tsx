import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { isSameAccount } from '@/lib/account'
import { formatPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { TAccountPointer, TSignerType } from '@/types'
import { Loader, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { SimpleUserAvatar } from '../UserAvatar'
import { SimpleUsername } from '../Username'

export default function AccountList({
  className,
  afterSwitch
}: {
  className?: string
  afterSwitch: () => void
}) {
  const { accounts, account, switchAccount, removeAccount } = useNostr()
  const [switchingAccount, setSwitchingAccount] = useState<TAccountPointer | null>(null)

  return (
    <div className={cn('space-y-2', className)}>
      {accounts.map((act) => (
        <div
          key={`${act.pubkey}-${act.signerType}`}
          className={cn(
            'relative rounded-3xl',
            isSameAccount(act, account) ? 'border border-primary' : 'clickable'
          )}
          onClick={() => {
            if (isSameAccount(act, account)) return
            setSwitchingAccount(act)
            switchAccount(act)
              .then(() => afterSwitch())
              .finally(() => setSwitchingAccount(null))
          }}
        >
          <div className="flex justify-between items-center p-2">
            <div className="flex-1 flex items-center gap-2 relative">
              <SimpleUserAvatar userId={act.pubkey} />
              <div className="flex-1 w-0">
                <SimpleUsername userId={act.pubkey} className="font-semibold truncate" />
                <div className="text-sm rounded-full bg-muted px-2 w-fit">
                  {formatPubkey(act.pubkey)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-2 items-center">
                <SignerTypeBadge signerType={act.signerType} />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  removeAccount(act)
                }}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
          {switchingAccount && isSameAccount(act, switchingAccount) && (
            <div className="absolute top-0 left-0 flex w-full h-full items-center justify-center rounded-3xl bg-muted/60">
              <Loader size={16} className="animate-spin" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function SignerTypeBadge({ signerType }: { signerType: TSignerType }) {
  if (signerType === 'nip-07') {
    return <Badge className="rounded-full bg-blue-500 hover:bg-blue-500/80 text-white border-0">Extension</Badge>
  } else if (signerType === 'bunker') {
    return <Badge className="rounded-full bg-purple-500 hover:bg-purple-500/80 text-white border-0">Signer</Badge>
  } else if (signerType === 'ncryptsec') {
    return <Badge className="rounded-full bg-orange-500 hover:bg-orange-500/80 text-white border-0">Key</Badge>
  } else if (signerType === 'nsec') {
    return <Badge className="rounded-full bg-orange-500 hover:bg-orange-500/80 text-white border-0">Key</Badge>
  } else if (signerType === 'npub') {
    return <Badge className="rounded-full bg-yellow-500 hover:bg-yellow-500/80 text-white border-0">Public key</Badge>
  }
}
