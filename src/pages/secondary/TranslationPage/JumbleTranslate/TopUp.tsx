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

function formatCompactChars(value: number) {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}m`
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`
  }
  return value.toString()
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
  const [latestInvoiceComment, setLatestInvoiceComment] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [canAutoVerifyPayment, setCanAutoVerifyPayment] = useState<boolean | null>(null)
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

  const refreshTransactionStatus = async () => {
    if (!latestTransactionId) return
    try {
      setTopUpLoading(true)
      const { state, canVerify, characters } = await transaction.checkTransaction(latestTransactionId)
      setCanAutoVerifyPayment(canVerify ?? canAutoVerifyPayment)
      if (state === 'settled') {
        await getAccount()
        const confirmedCredits = typeof characters === 'number' ? characters : 0
        setPaymentStatus(confirmedCredits > 0
          ? `Payment received. ${confirmedCredits.toLocaleString()} credits added.`
          : t('Payment received. Credits added.', {
              defaultValue: 'Payment received. Credits added.'
            }))
        toast.success(
          t('Payment confirmed', {
            defaultValue: 'Payment confirmed'
          })
        )
      } else if (state === 'failed') {
        setPaymentStatus(
          t('Payment failed or expired', { defaultValue: 'Payment failed or expired' })
        )
        toast.error(t('The invoice has expired or the payment was not successful'))
      } else {
        setPaymentStatus(
          t('Still waiting for payment confirmation...', {
            defaultValue: 'Still waiting for payment confirmation...'
          })
        )
      }
    } catch (error) {
      toast.error(
        t('Could not refresh payment status', {
          defaultValue: 'Could not refresh payment status'
        })
      )
      console.error('refresh payment status failed', error)
    } finally {
      setTopUpLoading(false)
    }
  }

  const handleTopUp = async (pkg: TTopUpPackage | null) => {
    if (topUpLoading || !pubkey || !pkg) return

    setTopUpLoading(true)
    setPaymentStatus('')
    try {
      const { transactionId, invoiceId, sats, characters, canVerify, invoiceComment } =
        await transaction.createTransaction(pubkey, pkg.characters)
      setLatestTransactionId(transactionId)
      setLatestInvoiceComment(invoiceComment || '')
      setCanAutoVerifyPayment(canVerify)
      setPaymentStatus(
        t('Waiting for payment confirmation...', {
          defaultValue: 'Waiting for payment confirmation...'
        })
      )

      let checkPaymentInterval: ReturnType<typeof setInterval> | undefined = undefined
      let settled = false

      const finalizeSettled = async (confirmedCharacters = characters, confirmedSats = sats) => {
        if (settled) return
        settled = true
        clearInterval(checkPaymentInterval)
        setTopUpLoading(false)
        setPaymentStatus(
          `Payment received. ${confirmedCharacters.toLocaleString()} credits added.`
        )
        await getAccount()
        toast.success(
          t('Top up successful: {{chars}} credits for {{sats}} sats', {
            chars: confirmedCharacters.toLocaleString(),
            sats: confirmedSats.toLocaleString(),
            defaultValue: `Top up successful: ${confirmedCharacters.toLocaleString()} credits for ${confirmedSats.toLocaleString()} sats`
          })
        )
      }

      const { setPaid } = launchPaymentModal({
        invoice: invoiceId,
        paymentMethods: 'all',
        onPaid: async (response) => {
          try {
            if (response?.preimage) {
              const result = await transaction.confirmTransaction(transactionId, response.preimage)
              if (result.state === 'settled') {
                await finalizeSettled(result.characters ?? characters, result.sats ?? sats)
                return
              }
            }

            const result = await transaction.checkTransaction(transactionId)
            if (result.state === 'settled') {
              await finalizeSettled(result.characters ?? characters, result.sats ?? sats)
              return
            }

            setCanAutoVerifyPayment(result.canVerify ?? canVerify)
            setTopUpLoading(false)
            setPaymentStatus(
              t('Payment sent. Waiting for settlement confirmation...', {
                defaultValue: 'Payment sent. Waiting for settlement confirmation...'
              })
            )
          } catch (error) {
            setTopUpLoading(false)
            toast.error(
              t('Payment received but confirmation failed. Refresh status.', {
                defaultValue: 'Payment received but confirmation failed. Refresh status.'
              })
            )
            console.error('payment confirm failed', error)
          }
        },
        onCancelled: () => {
          clearInterval(checkPaymentInterval)
          setTopUpLoading(false)
        }
      })

      let failedCount = 0
      checkPaymentInterval = setInterval(async () => {
        try {
          const {
            state,
            canVerify: nextCanVerify,
            characters: settledCharacters,
            sats: settledSats
          } = await transaction.checkTransaction(transactionId)
          setCanAutoVerifyPayment(nextCanVerify ?? canVerify)
          if (state === 'pending') return

          if (state === 'settled') {
            setPaid({ preimage: '' })
            await finalizeSettled(settledCharacters ?? characters, settledSats ?? sats)
          } else {
            closeModal()
            clearInterval(checkPaymentInterval)
            setTopUpLoading(false)
            setPaymentStatus(
              t('Payment failed or expired', { defaultValue: 'Payment failed or expired' })
            )
            toast.error(t('The invoice has expired or the payment was not successful'))
          }
        } catch (err) {
          failedCount++
          if (failedCount <= 3) return

          clearInterval(checkPaymentInterval)
          setTopUpLoading(false)
          setPaymentStatus(
            t('Unable to confirm payment automatically', {
              defaultValue: 'Unable to confirm payment automatically'
            })
          )
          toast.error(
            'Top up failed: ' +
              (err instanceof Error ? err.message : 'An error occurred while topping up')
          )
        }
      }, 2000)
    } catch (err) {
      setTopUpLoading(false)
      setPaymentStatus('')
      toast.error(
        'Top up failed: ' +
          (err instanceof Error ? err.message : 'An error occurred while topping up')
      )
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="font-medium">{t('Top up', { defaultValue: 'Top up' })}</p>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
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
                'flex flex-col h-auto rounded-xl py-2.5 px-2 hover:bg-primary/10',
                selectedCharacters === item.characters && 'border border-primary bg-primary/10'
              )}
            >
              <span className="text-base font-semibold leading-tight">
                {item.sats.toLocaleString()} {t('sats', { defaultValue: 'sats' })}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatCompactChars(item.characters)}{' '}
                {t('characters', { defaultValue: 'characters' })}
              </span>
            </Button>
          ))}
      </div>

      {latestTransactionId && (
        <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1.5">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
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

      {latestInvoiceComment && (
        <p className="text-xs text-muted-foreground">
          {t('Invoice memo', { defaultValue: 'Invoice memo' })}: {latestInvoiceComment}
        </p>
      )}

      {paymentStatus && <p className="text-xs text-muted-foreground">{paymentStatus}</p>}

      {latestTransactionId && (
        <Button
          variant="outline"
          className="w-full"
          disabled={topUpLoading}
          onClick={refreshTransactionStatus}
        >
          {topUpLoading && <Loader className="animate-spin" />}
          {t('Check payment status', { defaultValue: 'Check payment status' })}
        </Button>
      )}

      {canAutoVerifyPayment === false && (
        <p className="text-xs text-amber-500/90">
          {t('External QR payments may not auto-confirm with this lightning address. Connected wallet payment confirms instantly.', {
            defaultValue:
              'External QR payments may not auto-confirm with this lightning address. Connected wallet payment confirms instantly.'
          })}
        </p>
      )}

      <Button
        className="w-full"
        disabled={topUpLoading || !selectedPackage}
        onClick={() => handleTopUp(selectedPackage)}
      >
        {topUpLoading && <Loader className="animate-spin" />}
        {selectedPackage
          ? t('Top up {n} sats', {
              n: selectedPackage.sats.toLocaleString(),
              defaultValue: `Top up ${selectedPackage.sats.toLocaleString()} sats`
            })
          : t('Select a package', { defaultValue: 'Select a package' })}
      </Button>
    </div>
  )
}
