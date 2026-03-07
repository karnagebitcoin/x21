import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import relayHealthService, { TRelayHealthResult, TRelayHealthStatus } from '@/services/relay-health.service'
import { Loader } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

type RelayHealthBadgeProps = {
  url: string
  autoCheck?: boolean
  result?: TRelayHealthResult
}

const STATUS_CONFIG: Record<
  Exclude<TRelayHealthStatus, 'checking'>,
  { label: string; color: string; bgColor: string }
> = {
  great: {
    label: 'Great',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30'
  },
  good: {
    label: 'Good',
    color: 'text-lime-700 dark:text-lime-400',
    bgColor: 'bg-lime-100 dark:bg-lime-900/30'
  },
  average: {
    label: 'Average',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30'
  },
  poor: {
    label: 'Poor',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30'
  },
  unreachable: {
    label: 'Offline',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30'
  }
}

export default function RelayHealthBadge({ url, autoCheck = true, result }: RelayHealthBadgeProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<TRelayHealthStatus>('checking')
  const [latency, setLatency] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (result) {
      setStatus(result.status)
      setLatency(result.latency)
      return
    }

    if (!autoCheck) return

    const cachedResult = relayHealthService.getCachedHealth(url)
    if (cachedResult) {
      setStatus(cachedResult.status)
      setLatency(cachedResult.latency)
      return
    }

    setStatus('checking')
    relayHealthService.checkRelayHealth(url).then((result) => {
      setStatus(result.status)
      setLatency(result.latency)
    })
  }, [url, autoCheck, result])

  if (status === 'checking') {
    return (
      <div className="flex items-center justify-center w-16">
        <Loader className="w-3 h-3 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const config = STATUS_CONFIG[status]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`px-2 py-0.5 rounded text-xs font-medium cursor-help ${config.color} ${config.bgColor}`}
          >
            {t(config.label)}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            {latency !== undefined ? (
              <p className="font-medium">
                {t('Latency')}: {latency}ms
              </p>
            ) : (
              <p className="font-medium">{t('Unable to connect')}</p>
            )}
            <p className="text-muted-foreground">
              {t('Relay latency tooltip')}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
