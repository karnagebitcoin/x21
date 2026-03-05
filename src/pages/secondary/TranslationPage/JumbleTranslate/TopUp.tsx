import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import transaction from '@/services/transaction.service'
import { closeModal, launchPaymentModal } from '@getalby/bitcoin-connect-react'
import { Check, Copy, Loader } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useJumbleTranslateAccount } from './JumbleTranslateAccountProvider'
import { useTranslation } from 'react-i18next'

type TTopUpPackage = {
  characters: number
  sats: number
  estimatedUsdCost: number
}

type TTopUpQuote = {
  model: string
  priceSource: 'coingecko' | 'fallback'
  btcUsd: number
  fallbackBtcUsd: number
  marginMultiplier: number
  packages: TTopUpPackage[]
}

export default function TopUp() {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { getAccount } = useJumbleTranslateAccount()
  const [topUpLoading, setTopUpLoading] = useState(false)
  const [quoteLoading, setQuoteLoading] = useState(true)
  const [quote, setQuote] = useState<TTopUpQuote | null>(null)
  const [selectedCharacters, setSelectedCharacters] = useState<number | null>(null)
  const [latestTransactionId, setLatestTransactionId] = useState('')
  const [copiedTx, setCopiedTx] = useState(false)

  useEffect(() => {
    let mounted = true
    setQuoteLoading(true)

    transaction.getTranslationTopUpQuote()
      .then((data) => {
        if (!mounted) return
        setQuote(data)
        setSelectedCharacters(data.packages[0]?.characters ?? null)
      })
      .catch((error) => {
        if (!mounted) return
        toast.error(
          t('Failed to load top-up pricing: {{error}}', {
            error: error instanceof Error ? error.message : 'Unknown error',
            defaultValue: `Failed to load top-up pricing: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          })
        )
      })
      .finally(() => {
        if (!mounted) return
        setQuoteLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const selectedPackage =
    quote?.packages.find((item) => item.characters === selectedCharacters) ?? null

  const handleTopUp = async (pkg: TTopUpPackage | null) => {
    if (topUpLoading || !pubkey || !pkg) return

    setTopUpLoading(true)
    try {
      const { transactionId, invoiceId, sats, characters } = await transaction.createTransaction(
        pubkey,
        pkg.characters
      )
      setLatestTransactionId(transactionId)

      let checkPaymentInterval: ReturnType<typeof setInterval> | undefined = undefined
      const { setPaid } = launchPaymentModal({
        invoice: invoiceId,
        onCancelled: () => {
          clearInterval(checkPaymentInterval)
          setTopUpLoading(false)
        }
      })

      let failedCount = 0
      checkPaymentInterval = setInterval(async () => {
        try {
          const { state } = await transaction.checkTransaction(transactionId)
          if (state === 'pending') return

          clearInterval(checkPaymentInterval)
          setTopUpLoading(false)

          if (state === 'settled') {
            setPaid({ preimage: '' })
            await getAccount()
            toast.success(
              t('Top up successful: {{chars}} credits for {{sats}} sats', {
                chars: characters.toLocaleString(),
                sats: sats.toLocaleString(),
                defaultValue: `Top up successful: ${characters.toLocaleString()} credits for ${sats.toLocaleString()} sats`
              })
            )
          } else {
            closeModal()
            toast.error(t('The invoice has expired or the payment was not successful'))
          }
        } catch (err) {
          failedCount++
          if (failedCount <= 3) return

          clearInterval(checkPaymentInterval)
          setTopUpLoading(false)
          toast.error(
            'Top up failed: ' +
              (err instanceof Error ? err.message : 'An error occurred while topping up')
          )
        }
      }, 2000)
    } catch (err) {
      setTopUpLoading(false)
      toast.error(
        'Top up failed: ' +
          (err instanceof Error ? err.message : 'An error occurred while topping up')
      )
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="font-medium">{t('Top up')}</p>
        {quote && (
          <p className="text-xs text-muted-foreground">
            {t('Pricing updates with live BTC price. Model: {{model}}', {
              model: quote.model,
              defaultValue: `Pricing updates with live BTC price. Model: ${quote.model}`
            })}{' '}
            {t('BTC: ${{price}} ({{source}})', {
              price: quote.btcUsd.toLocaleString(undefined, { maximumFractionDigits: 2 }),
              source: quote.priceSource,
              defaultValue: `BTC: $${quote.btcUsd.toLocaleString(undefined, {
                maximumFractionDigits: 2
              })} (${quote.priceSource})`
            })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {quoteLoading && (
          <div className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader className="h-4 w-4 animate-spin" />
            {t('Loading pricing...', { defaultValue: 'Loading pricing...' })}
          </div>
        )}

        {!quoteLoading &&
          quote?.packages.map((item) => (
            <Button
              key={item.characters}
              variant="outline"
              onClick={() => setSelectedCharacters(item.characters)}
              className={cn(
                'flex flex-col h-auto py-3 hover:bg-primary/10',
                selectedCharacters === item.characters && 'border border-primary bg-primary/10'
              )}
            >
              <span className="text-lg font-semibold">
                {item.sats.toLocaleString()} {t('sats')}
              </span>
              <span className="text-sm text-muted-foreground">
                {item.characters.toLocaleString()} {t('characters')}
              </span>
            </Button>
          ))}
      </div>

      {latestTransactionId && (
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            {t('Latest transaction', { defaultValue: 'Latest transaction' })}
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs break-all">{latestTransactionId}</code>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(latestTransactionId)
                setCopiedTx(true)
                setTimeout(() => setCopiedTx(false), 2000)
              }}
            >
              {copiedTx ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      <Button
        className="w-full"
        disabled={topUpLoading || !selectedPackage}
        onClick={() => handleTopUp(selectedPackage)}
      >
        {topUpLoading && <Loader className="animate-spin" />}
        {selectedPackage
          ? t('Top up {n} sats', {
              n: selectedPackage.sats.toLocaleString()
            })
          : t('Select a package', { defaultValue: 'Select a package' })}
      </Button>
    </div>
  )
}
