import { Button } from '@/components/ui/button'
import { useNostr } from '@/providers/NostrProvider'
import { usePaymentsEnabled } from '@/providers/PaymentsEnabledProvider'
import { Zap } from 'lucide-react'
import { useState } from 'react'
import ZapDialog from '../ZapDialog'

export default function ProfileZapButton({ pubkey }: { pubkey: string }) {
  const { checkLogin } = useNostr()
  const { paymentsEnabled } = usePaymentsEnabled()
  const [open, setOpen] = useState(false)

  // Don't render if payments are not enabled
  if (!paymentsEnabled) {
    return null
  }

  return (
    <>
      <Button
        variant="secondary"
        size="icon"
        className="rounded-full"
        onClick={() => checkLogin(() => setOpen(true))}
      >
        <Zap className="text-yellow-400" />
      </Button>
      <ZapDialog open={open} setOpen={setOpen} pubkey={pubkey} />
    </>
  )
}
