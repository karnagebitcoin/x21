import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react'

type RelayFetchMode = 'loading' | 'slow' | 'not-found'

export default function RelayFetchState({
  mode,
  relayCount,
  onRetry,
  className
}: {
  mode: RelayFetchMode
  relayCount?: number
  onRetry?: () => void
  className?: string
}) {
  const relayLabel =
    relayCount && relayCount > 0 ? `Querying ${relayCount} relays.` : 'Querying relays.'

  const title =
    mode === 'loading'
      ? 'Loading from relays...'
      : mode === 'slow'
        ? 'Still loading from relays...'
        : 'Not found yet on relays.'

  const description =
    mode === 'loading'
      ? `${relayLabel} Nostr can take a moment to sync.`
      : mode === 'slow'
        ? `${relayLabel} This is taking longer than usual on Nostr.`
        : `${relayLabel} This content may still be propagating.`

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center gap-2 py-8 px-4 text-muted-foreground',
        className
      )}
    >
      {mode === 'not-found' ? (
        <AlertCircle className="w-5 h-5 opacity-80" />
      ) : (
        <Loader2 className="w-5 h-5 animate-spin opacity-80" />
      )}
      <div className="font-medium text-foreground">{title}</div>
      <div className="text-sm text-muted-foreground max-w-md">{description}</div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          Retry
        </Button>
      )}
    </div>
  )
}
