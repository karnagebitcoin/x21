import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import UserAvatar from '@/components/UserAvatar'
import { useFetchProfile, useFetchFollowings } from '@/hooks'
import { toast } from 'sonner'
import { Users, UserPlus, Eye, EyeOff, Download, Copy, Check } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import SignupProfile from '@/components/AccountManager/SignupProfile'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useFollowList } from '@/providers/FollowListProvider'
import { getPublicKey } from 'nostr-tools'
import { decode } from 'nostr-tools/nip19'
import { createFollowListDraftEvent } from '@/lib/draft-event'

interface InviteWelcomeFlowProps {
  open: boolean
  onClose: () => void
  inviterPubkey: string
}

type FlowStep = 'welcome' | 'profile' | 'keys'

export default function InviteWelcomeFlow({
  open,
  onClose,
  inviterPubkey
}: InviteWelcomeFlowProps) {
  const { t } = useTranslation()
  const { pubkey: currentPubkey, publish, updateFollowListEvent } = useNostr()
  const { profile: inviterProfile, isFetching: fetchingProfile } = useFetchProfile(inviterPubkey)
  const { followings: inviterFollowings } = useFetchFollowings(inviterPubkey)
  const { switchFeed } = useFeed()

  const [currentStep, setCurrentStep] = useState<FlowStep>('welcome')
  const [followInviterFollows, setFollowInviterFollows] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  // Store keys and profile data to pass through steps
  const [generatedKeys, setGeneratedKeys] = useState<{ nsec: string; npub: string } | null>(null)
  const [profileData, setProfileData] = useState<{ displayName: string; username: string }>({
    displayName: '',
    username: ''
  })

  const filteredInviterFollowings = useMemo(() => {
    return inviterFollowings.filter((pk) => pk !== inviterPubkey)
  }, [inviterFollowings, inviterPubkey])

  const handleJoinClick = () => {
    setCurrentStep('profile')
  }

  const handleProfileComplete = async (
    keys: { nsec: string; npub: string },
    profile: { displayName: string; username: string }
  ) => {
    setGeneratedKeys(keys)
    setProfileData(profile)

    // The account is already logged in from SignupProfile
    // Now follow the inviter and their follows
    setIsProcessing(true)
    try {
      const pubkeysToFollow: string[] = [inviterPubkey]
      if (followInviterFollows && filteredInviterFollowings.length > 0) {
        pubkeysToFollow.push(...filteredInviterFollowings)
      }

      // Create p tags for all pubkeys to follow
      const pTags = pubkeysToFollow.map(pk => ['p', pk] as [string, string])

      // Publish the follow list event directly
      const followListDraftEvent = createFollowListDraftEvent(pTags)
      const newFollowListEvent = await publish(followListDraftEvent)
      await updateFollowListEvent(newFollowListEvent)

      // Get hex pubkey from nsec for feed switching
      const decoded = decode(keys.nsec)
      const hexPubkey = getPublicKey(decoded.data as Uint8Array)

      // Switch to Following feed
      await switchFeed('following', { pubkey: hexPubkey })

      toast.success(
        followInviterFollows && filteredInviterFollowings.length > 0
          ? t('Welcome! You are now following {{count}} people', {
              count: pubkeysToFollow.length
            })
          : t('Welcome! You are now following {{name}}', {
              name: inviterProfile?.display_name || inviterProfile?.name || 'your inviter'
            })
      )

      // Move to keys display step
      setCurrentStep('keys')
    } catch (error) {
      console.error('Failed to follow users:', error)
      toast.error(t('Failed to follow users. Please try again.'))
      // Still move to keys step even if follow fails
      setCurrentStep('keys')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleKeysComplete = () => {
    onClose()
  }

  // Show welcome screen with inviter info
  if (currentStep === 'welcome') {
    return (
      <Dialog open={open} onOpenChange={(open) => !open && !isProcessing && onClose()}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="text-center">
            <DialogTitle className="text-2xl">
              {fetchingProfile ? (
                <Skeleton className="h-8 w-48 mx-auto" />
              ) : (
                t('{{name}} invites you to x21!', {
                  name: inviterProfile?.display_name || inviterProfile?.name || 'Someone'
                })
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-6 py-6">
            {/* Inviter Profile */}
            {fetchingProfile ? (
              <Skeleton className="h-24 w-24 rounded-full" />
            ) : (
              <UserAvatar userId={inviterPubkey} size="large" noLink />
            )}

            {/* Join Button */}
            <Button
              onClick={handleJoinClick}
              disabled={isProcessing}
              size="lg"
              className="w-full rounded-xl"
            >
              <UserPlus className="mr-2 h-5 w-5" />
              {t('Join and follow {{name}}', {
                name: inviterProfile?.display_name || inviterProfile?.name || 'them'
              })}
            </Button>

            {/* Follow their follows checkbox */}
            {filteredInviterFollowings.length > 0 && (
              <div className="flex items-start space-x-3 w-full">
                <Checkbox
                  id="follow-inviter-follows"
                  checked={followInviterFollows}
                  onCheckedChange={(checked) => setFollowInviterFollows(checked as boolean)}
                  disabled={isProcessing}
                />
                <Label
                  htmlFor="follow-inviter-follows"
                  className="text-sm font-normal leading-normal cursor-pointer"
                >
                  <Users className="inline h-3 w-3 mr-1" />
                  {t('Also follow {{count}} people they follow', {
                    count: filteredInviterFollowings.length
                  })}
                </Label>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Show signup profile form
  if (currentStep === 'profile') {
    return (
      <Dialog open={open} onOpenChange={(open) => !open && !isProcessing && onClose()}>
        <DialogContent
          className="sm:max-w-md max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <SignupProfile
            back={() => setCurrentStep('welcome')}
            onProfileComplete={handleProfileComplete}
            inviterPubkey={inviterPubkey}
          />
        </DialogContent>
      </Dialog>
    )
  }

  // Show keys display (imported from SignupOnboarding)
  if (currentStep === 'keys' && generatedKeys) {
    return (
      <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="sm:max-w-md max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <KeysDisplay
            keys={generatedKeys}
            profile={profileData}
            onComplete={handleKeysComplete}
          />
        </DialogContent>
      </Dialog>
    )
  }

  return null
}

// Keys display component (copied from SignupOnboarding)
function KeysDisplay({
  keys,
  profile,
  onComplete
}: {
  keys: { nsec: string; npub: string }
  profile: { displayName: string; username: string }
  onComplete: () => void
}) {
  const { t } = useTranslation()
  const [nsecRevealed, setNsecRevealed] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      const text = `Public Key (npub):\n${keys.npub}\n\nPrivate Key (nsec):\n${keys.nsec}`

      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback to older method
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()

        const successful = document.execCommand('copy')
        document.body.removeChild(textArea)

        if (!successful) {
          throw new Error('Copy command was unsuccessful')
        }
      }

      setCopied(true)
      setHasInteracted(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy keys:', error)
      // Still mark as interacted even if copy fails
      setHasInteracted(true)
    }
  }

  const handleDownload = () => {
    const content = `Nostr Account Information
========================

Display Name: ${profile.displayName || 'Not set'}
Username: ${profile.username ? '@' + profile.username : 'Not set'}

Public Key (npub):
${keys.npub}

Private Key (nsec):
${keys.nsec}

⚠️ IMPORTANT: Keep your private key (nsec) safe and NEVER share it with anyone!
Your private key is the only way to access your account. If you lose it, you lose access forever.
`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nostr-keys.txt'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()

    // Clean up
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 100)

    setHasInteracted(true)
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
          <svg
            className="w-8 h-8 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">Your Keys</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            These are your Nostr keys. Save them somewhere safe - you'll need them to access your
            account.
          </p>
        </div>

        <div className="w-full space-y-4 mt-2 text-left">
          <div className="grid gap-2">
            <Label htmlFor="npub-input">Public Identity (npub)</Label>
            <Input id="npub-input" value={keys.npub} readOnly className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground">
              Share this publicly - it's your Nostr address
            </p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="nsec-input">Private Key (nsec)</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNsecRevealed(!nsecRevealed)}
                className="h-7 px-2"
              >
                {nsecRevealed ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Input
              id="nsec-input"
              type={nsecRevealed ? 'text' : 'password'}
              value={keys.nsec}
              readOnly
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              NEVER share this - it's your secret key
            </p>
          </div>
        </div>

        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 text-left">
          <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
            ⚠️ Important: Download and save your private key (nsec) now. If you lose it, you'll
            lose access to your account forever.
          </p>
        </div>

        <div className="flex gap-2 w-full">
          <Button variant="secondary" onClick={handleCopy} className="flex-1 rounded-xl" size="lg">
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                {t('Copied!')}
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                {t('Copy')}
              </>
            )}
          </Button>
          <Button variant="secondary" onClick={handleDownload} className="flex-1 rounded-xl" size="lg">
            <Download className="h-4 w-4 mr-2" />
            {t('Download')}
          </Button>
        </div>

        {hasInteracted && (
          <Button onClick={onComplete} className="w-full rounded-xl" size="lg">
            {t('Done')}
          </Button>
        )}
      </div>
    </div>
  )
}
