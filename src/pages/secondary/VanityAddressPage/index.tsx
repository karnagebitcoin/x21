import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useNostr } from '@/providers/NostrProvider'
import vanityAddress from '@/services/vanity-address.service'
import { closeModal, launchPaymentModal } from '@getalby/bitcoin-connect-react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { forwardRef, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

type TVanityAccountState = {
  domain: string
  claimable: boolean
  eligibility?: {
    eligible: boolean
    source?: string | null
  }
  assignment?: {
    name: string
    expiresAt: number | null
  } | null
  pricing?: {
    minSats: number
    maxSats: number
    termDays: number
    currentSats?: number | null
  }
}

const HANDLE_MIN = 1
const HANDLE_MAX = 20
const HANDLE_REGEX = /^[a-z0-9_]+$/

function normalizeHandle(value: string) {
  return value.trim().toLowerCase()
}

const VanityAddressPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { pubkey, startLogin } = useNostr()
  const [account, setAccount] = useState<TVanityAccountState | null>(null)
  const [loading, setLoading] = useState(false)
  const [handle, setHandle] = useState('')
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availability, setAvailability] = useState<{
    available: boolean
    reason?: string
    sats?: number
  } | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [claimId, setClaimId] = useState('')
  const [claimStatus, setClaimStatus] = useState('')
  const [copiedClaimId, setCopiedClaimId] = useState(false)

  const normalizedHandle = useMemo(() => normalizeHandle(handle), [handle])
  const currentName = account?.assignment?.name || ''
  const domain = account?.domain || 'x21.social'
  const selectedAddress = normalizedHandle ? `${normalizedHandle}@${domain}` : ''
  const isRenew = Boolean(currentName && normalizedHandle === currentName)
  const quotedSats = useMemo(() => {
    if (!normalizedHandle) return 0
    if (isRenew) {
      const renewSats = Number(
        account?.pricing?.currentSats ??
          account?.pricing?.maxSats ??
          account?.pricing?.minSats ??
          0
      )
      return Number.isFinite(renewSats) ? Math.max(renewSats, 0) : 0
    }

    if (typeof availability?.sats === 'number' && Number.isFinite(availability.sats)) {
      return Math.max(availability.sats, 0)
    }

    const fallbackSats = Number(account?.pricing?.maxSats ?? account?.pricing?.minSats ?? 0)
    return Number.isFinite(fallbackSats) ? Math.max(fallbackSats, 0) : 0
  }, [normalizedHandle, isRenew, availability?.sats, account?.pricing?.currentSats, account?.pricing?.maxSats, account?.pricing?.minSats])

  const validationError = useMemo(() => {
    if (!normalizedHandle) return ''
    if (normalizedHandle.length < HANDLE_MIN || normalizedHandle.length > HANDLE_MAX) {
      return `Handle must be ${HANDLE_MIN}-${HANDLE_MAX} characters`
    }
    if (!HANDLE_REGEX.test(normalizedHandle)) {
      return 'Use lowercase letters, numbers, and underscores only'
    }
    return ''
  }, [normalizedHandle])

  const loadAccount = async () => {
    if (!pubkey) return
    setLoading(true)
    try {
      const next = await vanityAddress.getAccount()
      setAccount(next)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load vanity address')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!pubkey) {
      setAccount(null)
      return
    }
    void loadAccount()
  }, [pubkey])

  useEffect(() => {
    if (!normalizedHandle || validationError) {
      setAvailability(null)
      return
    }
    if (normalizedHandle === currentName) {
      setAvailability({
        available: true,
        sats: Number(account?.pricing?.currentSats ?? account?.pricing?.maxSats ?? account?.pricing?.minSats ?? 0)
      })
      return
    }

    let ignore = false
    const timer = setTimeout(() => {
      setAvailabilityLoading(true)
      vanityAddress
        .checkAvailability(normalizedHandle)
        .then((result) => {
          if (ignore) return
          setAvailability({ available: Boolean(result.available), reason: result.reason, sats: result.sats })
        })
        .catch((error) => {
          if (ignore) return
          setAvailability({ available: false, reason: error instanceof Error ? error.message : 'Unavailable' })
        })
        .finally(() => {
          if (!ignore) setAvailabilityLoading(false)
        })
    }, 320)

    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [normalizedHandle, validationError, currentName, account?.pricing?.currentSats, account?.pricing?.maxSats, account?.pricing?.minSats])

  const pollClaimUntilSettled = async (id: string, initialHandle: string) => {
    let settled = false
    let failedCount = 0
    const interval = setInterval(async () => {
      try {
        const status = await vanityAddress.checkClaim(id)
        if (status.state === 'pending') return

        if (status.state === 'settled') {
          settled = true
          clearInterval(interval)
          closeModal()
          await loadAccount()
          setClaimStatus(`Claimed ${status.handle || initialHandle}`)
          setClaiming(false)
          toast.success('Vanity address claimed successfully')
          return
        }

        clearInterval(interval)
        closeModal()
        setClaiming(false)
        setClaimStatus('Payment failed or expired')
      } catch {
        failedCount += 1
        if (failedCount <= 4) return
        clearInterval(interval)
        setClaiming(false)
        setClaimStatus('Could not verify payment. Use Check status below.')
      }
    }, 2200)

    return () => {
      if (!settled) clearInterval(interval)
    }
  }

  const runClaim = async () => {
    if (!pubkey) {
      startLogin()
      return
    }
    if (!account?.claimable) {
      toast.error('Only x21-created accounts can claim a vanity address right now')
      return
    }
    if (!normalizedHandle || validationError) return
    if (!isRenew && availability && !availability.available) {
      toast.error(availability.reason || 'That handle is not available')
      return
    }

    setClaiming(true)
    setClaimStatus('')
    try {
      const claim = await vanityAddress.createClaim(normalizedHandle)
      setClaimId(claim.claimId)
      setClaimStatus('Waiting for payment confirmation...')
      void pollClaimUntilSettled(claim.claimId, claim.handle)

      launchPaymentModal({
        invoice: claim.invoiceId,
        paymentMethods: 'all',
        onPaid: async () => {
          try {
            const status = await vanityAddress.checkClaim(claim.claimId)
            if (status.state === 'settled') {
              await loadAccount()
              setClaiming(false)
              setClaimStatus(`Claimed ${status.handle || claim.handle}`)
              toast.success('Vanity address claimed successfully')
              return
            }
            setClaimStatus('Payment sent. Waiting for settlement confirmation...')
          } catch {
            setClaimStatus('Payment sent. Waiting for settlement confirmation...')
          }
        },
        onCancelled: () => {
          setClaiming(false)
        }
      })
    } catch (error) {
      setClaiming(false)
      setClaimStatus('')
      toast.error(error instanceof Error ? error.message : 'Failed to create claim')
    }
  }

  const checkLatestClaim = async () => {
    if (!claimId) return
    setClaiming(true)
    try {
      const status = await vanityAddress.checkClaim(claimId)
      if (status.state === 'settled') {
        await loadAccount()
        setClaimStatus(`Claimed ${status.handle || selectedAddress}`)
        toast.success('Payment confirmed')
      } else if (status.state === 'failed') {
        setClaimStatus('Payment failed or expired')
      } else {
        setClaimStatus('Still waiting for payment confirmation...')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to check claim status')
    } finally {
      setClaiming(false)
    }
  }

  if (!pubkey) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title="Vanity Address">
        <div className="px-4 py-4">
          <Button onClick={() => startLogin()}>Log in to claim a vanity address</Button>
        </div>
      </SecondaryPageLayout>
    )
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title="Vanity Address">
      <div className="px-4 pt-3 space-y-4">
        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="text-sm text-muted-foreground">Current address</p>
          <p className="text-lg font-semibold">
            {account?.assignment?.name ? `${account.assignment.name}@${domain}` : `Not claimed yet`}
          </p>
          {account?.assignment?.expiresAt ? (
            <p className="text-xs text-muted-foreground mt-1">
              Expires {new Date(account.assignment.expiresAt).toLocaleString()}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground mt-2">
            Claims last {account?.pricing?.termDays || 365} days. Renew before expiry to keep your handle.
          </p>
        </div>

        {!account?.claimable ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            Vanity addresses are currently available to accounts created through x21 signup.
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-medium">Choose your handle</label>
          <div className="flex items-center rounded-lg border px-3 py-2">
            <Input
              value={handle}
              onChange={(event) =>
                setHandle(event.target.value.toLowerCase().replace(/\s+/g, ''))
              }
              placeholder="god"
              className="border-none shadow-none px-0 focus-visible:ring-0"
            />
            <span className="text-sm text-muted-foreground">@{domain}</span>
          </div>
          {validationError ? (
            <p className="text-xs text-red-400">{validationError}</p>
          ) : availabilityLoading ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking availability...
            </p>
          ) : availability?.available ? (
            <p className="text-xs text-emerald-400">
              {isRenew ? 'This is your current handle. Renew to extend it.' : 'Available'}
            </p>
          ) : availability ? (
            <p className="text-xs text-red-400">{availability.reason || 'Unavailable'}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Use {HANDLE_MIN}-{HANDLE_MAX} characters: lowercase letters, numbers, or underscores.
            </p>
          )}
        </div>

        <Button
          className="w-full"
          disabled={
            loading ||
            claiming ||
            !account?.claimable ||
            !normalizedHandle ||
            Boolean(validationError) ||
            (!isRenew && availability?.available === false)
          }
          onClick={() => void runClaim()}
        >
          {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isRenew
            ? `Renew for ${quotedSats.toLocaleString()} sats`
            : `Claim for ${quotedSats.toLocaleString()} sats`}
        </Button>

        {claimId ? (
          <div className="rounded-xl border bg-muted/10 p-3 space-y-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Latest claim</div>
            <div className="flex items-center gap-2">
              <code className="text-xs break-all">{claimId}</code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(claimId)
                  setCopiedClaimId(true)
                  setTimeout(() => setCopiedClaimId(false), 2000)
                }}
              >
                {copiedClaimId ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            {claimStatus ? <p className="text-xs text-muted-foreground">{claimStatus}</p> : null}
            <Button variant="outline" className="w-full" disabled={claiming} onClick={() => void checkLatestClaim()}>
              {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Check payment status
            </Button>
          </div>
        ) : null}
      </div>
    </SecondaryPageLayout>
  )
})

VanityAddressPage.displayName = 'VanityAddressPage'
export default VanityAddressPage
