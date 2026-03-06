import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createProfileDraftEvent } from '@/lib/draft-event'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useNostr } from '@/providers/NostrProvider'
import vanityAddress from '@/services/vanity-address.service'
import { closeModal, launchPaymentModal } from '@getalby/bitcoin-connect-react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { forwardRef, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

type TVanityAccountState = {
  domain: string
  ownerCanClaimFree?: boolean
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
  const { pubkey, profile, profileEvent, publish, updateProfileEvent, startLogin } = useNostr()
  const [account, setAccount] = useState<TVanityAccountState | null>(null)
  const [loading, setLoading] = useState(false)
  const [applyingProfile, setApplyingProfile] = useState(false)
  const [handle, setHandle] = useState('')
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availability, setAvailability] = useState<{
    available: boolean
    reason?: string
    sats?: number
    ownerPubkey?: string | null
  } | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [activeClaimSats, setActiveClaimSats] = useState<number | null>(null)
  const [claimId, setClaimId] = useState('')
  const [claimStatus, setClaimStatus] = useState('')
  const [copiedClaimId, setCopiedClaimId] = useState(false)

  const normalizedHandle = useMemo(() => normalizeHandle(handle), [handle])
  const currentName = account?.assignment?.name || ''
  const ownerCanClaimFree = Boolean(account?.ownerCanClaimFree)
  const domain = account?.domain || 'x21.social'
  const selectedAddress = normalizedHandle ? `${normalizedHandle}@${domain}` : ''
  const assignedAddress = currentName ? `${currentName}@${domain}` : ''
  const isAppliedToProfile = Boolean(
    assignedAddress &&
      profile?.nip05 &&
      profile.nip05.toLowerCase() === assignedAddress.toLowerCase()
  )
  const isRenew = Boolean(currentName && normalizedHandle === currentName)
  const renewalWindowOpen = useMemo(() => {
    const expiresAt = Number(account?.assignment?.expiresAt || 0)
    if (!expiresAt) return false
    return expiresAt - Date.now() <= 30 * 24 * 60 * 60 * 1000
  }, [account?.assignment?.expiresAt])
  const quotedSats = useMemo(() => {
    if (!normalizedHandle) return 0
    if (ownerCanClaimFree) return 0
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
  }, [normalizedHandle, ownerCanClaimFree, isRenew, availability?.sats, account?.pricing?.currentSats, account?.pricing?.maxSats, account?.pricing?.minSats])
  const buttonSats = useMemo(() => {
    if (claiming && typeof activeClaimSats === 'number' && activeClaimSats >= 0) {
      return activeClaimSats
    }
    return quotedSats
  }, [claiming, activeClaimSats, quotedSats])
  const availabilityBlocked = useMemo(() => {
    if (!availability || availability.available !== false) return false
    if (!ownerCanClaimFree) return true
    return Boolean(availability.ownerPubkey)
  }, [availability, ownerCanClaimFree])
  const priceReady = useMemo(() => {
    if (!normalizedHandle) return false
    if (isRenew) return ownerCanClaimFree || buttonSats > 0
    if (ownerCanClaimFree) {
      return !availabilityLoading && !availabilityBlocked
    }
    return (
      !availabilityLoading &&
      !availabilityBlocked &&
      typeof availability?.sats === 'number' &&
      availability.sats > 0
    )
  }, [normalizedHandle, isRenew, ownerCanClaimFree, buttonSats, availabilityLoading, availabilityBlocked, availability])

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
          setAvailability({
            available: Boolean(result.available),
            reason: result.reason,
            sats: result.sats,
            ownerPubkey: result.ownerPubkey ?? null
          })
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

  const applySettledClaimToState = (claimedHandle: string, expiresAt?: number | null) => {
    const claimedName = normalizeHandle(String(claimedHandle || '').split('@')[0] || '')
    if (!claimedName) return

    setAccount((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        assignment: {
          name: claimedName,
          expiresAt: Number(expiresAt || 0) || prev.assignment?.expiresAt || null
        }
      }
    })
    setAvailability({
      available: true,
      sats: ownerCanClaimFree
        ? 0
        : Number(account?.pricing?.currentSats ?? account?.pricing?.maxSats ?? account?.pricing?.minSats ?? 0)
    })
  }

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
          applySettledClaimToState(status.handle || initialHandle, status.expiresAt)
          void loadAccount()
          setClaimStatus(`Claimed ${status.handle || initialHandle}`)
          setClaiming(false)
          setActiveClaimSats(null)
          toast.success('Vanity address claimed successfully')
          return
        }

        clearInterval(interval)
        closeModal()
        setClaiming(false)
        setActiveClaimSats(null)
        setClaimStatus('Payment failed or expired')
      } catch {
        failedCount += 1
        if (failedCount <= 4) return
        clearInterval(interval)
        setClaiming(false)
        setActiveClaimSats(null)
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
    if (!normalizedHandle || validationError) return
    if (!isRenew && availabilityBlocked) {
      toast.error(availability?.reason || 'That handle is not available')
      return
    }
    if (!priceReady || (!ownerCanClaimFree && buttonSats <= 0)) {
      toast.error('Still fetching claim price. Please try again in a moment.')
      return
    }

    setClaiming(true)
    setActiveClaimSats(buttonSats)
    setClaimStatus('')
    try {
      const claim = await vanityAddress.createClaim(normalizedHandle)
      setActiveClaimSats(Number.isFinite(Number(claim.sats)) ? Math.max(Number(claim.sats), 0) : buttonSats)
      setClaimId(claim.claimId)
      if (claim.state === 'settled' || claim.paymentRequired === false || !claim.invoiceId) {
        applySettledClaimToState(claim.handle, claim.expiresAt)
        void loadAccount()
        setClaiming(false)
        setActiveClaimSats(null)
        setClaimStatus(`Claimed ${claim.handle}`)
        toast.success('Vanity address claimed successfully')
        return
      }

      setClaimStatus('Waiting for payment confirmation...')
      void pollClaimUntilSettled(claim.claimId, claim.handle)

      launchPaymentModal({
        invoice: claim.invoiceId,
        paymentMethods: 'all',
        onPaid: async () => {
          try {
            const status = await vanityAddress.checkClaim(claim.claimId)
            if (status.state === 'settled') {
              applySettledClaimToState(status.handle || claim.handle, status.expiresAt)
              void loadAccount()
              setClaiming(false)
              setActiveClaimSats(null)
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
          setActiveClaimSats(null)
        }
      })
    } catch (error) {
      setClaiming(false)
      setActiveClaimSats(null)
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
        applySettledClaimToState(status.handle || selectedAddress, status.expiresAt)
        void loadAccount()
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
      setActiveClaimSats(null)
    }
  }

  const applyClaimedAddressToProfile = async () => {
    if (!assignedAddress || isAppliedToProfile) return

    setApplyingProfile(true)
    try {
      const baseProfile =
        profileEvent?.content && profileEvent.content.trim()
          ? JSON.parse(profileEvent.content)
          : {}
      const profileContent = {
        ...baseProfile,
        nip05: assignedAddress
      }

      const profileDraftEvent = createProfileDraftEvent(
        JSON.stringify(profileContent),
        profileEvent?.tags
      )
      const newProfileEvent = await publish(profileDraftEvent)
      await updateProfileEvent(newProfileEvent)
      toast.success(`Applied ${assignedAddress} to your profile`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to apply vanity address to profile')
    } finally {
      setApplyingProfile(false)
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
          {assignedAddress ? (
            <Button
              variant="outline"
              className="mt-3"
              disabled={applyingProfile || isAppliedToProfile}
              onClick={() => void applyClaimedAddressToProfile()}
            >
              {applyingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isAppliedToProfile ? 'Applied to profile' : 'Apply to profile'}
            </Button>
          ) : null}
        </div>

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
          ) : availability?.available || (ownerCanClaimFree && availability && !availabilityBlocked) ? (
            <p className="text-xs text-emerald-400">
              {isRenew
                ? ownerCanClaimFree
                  ? 'This is your current handle. You can renew it for free.'
                  : 'This is your current handle. Renew to extend it.'
                : ownerCanClaimFree
                  ? 'Available to you'
                  : 'Available'}
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
            !normalizedHandle ||
            (isRenew && !renewalWindowOpen) ||
            !priceReady ||
            Boolean(validationError) ||
            (!isRenew && availabilityBlocked)
          }
          onClick={() => void runClaim()}
        >
          {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {!priceReady && !claiming
            ? 'Fetching claim price...'
            : isRenew && !renewalWindowOpen
              ? 'Already claimed'
              : isRenew
              ? ownerCanClaimFree
                ? 'Renew for free'
                : `Renew for ${buttonSats.toLocaleString()} sats`
              : ownerCanClaimFree
                ? 'Claim for free'
                : `Claim for ${buttonSats.toLocaleString()} sats`}
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
