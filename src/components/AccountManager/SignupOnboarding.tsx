import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Eye, EyeOff, Download, Copy, Check } from 'lucide-react'
import SignupProfile from './SignupProfile'

type OnboardingStep = 'intro1' | 'intro2' | 'profile' | 'complete'
type ProfileData = { displayName: string; username: string }

export default function SignupOnboarding({
  back,
  onComplete
}: {
  back: () => void
  onComplete: () => void
}) {
  const { t } = useTranslation()
  const [step, setStep] = useState<OnboardingStep>('intro1')
  const [generatedKeys, setGeneratedKeys] = useState<{ nsec: string; npub: string } | null>(null)
  const [profileData, setProfileData] = useState<ProfileData>({ displayName: '', username: '' })

  if (step === 'intro1') {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-300">
        <Button
          variant="ghost"
          onClick={back}
          className="w-fit text-muted-foreground -ml-2"
        >
          ← {t('Back')}
        </Button>

        <div className="flex flex-col gap-6 items-center text-center py-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">Earn Bitcoin</h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              The only social network that pays you in the best money ever created
            </p>
          </div>

          <Button
            onClick={() => setStep('intro2')}
            className="w-full max-w-xs mt-4"
            size="lg"
          >
            {t('Next')}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'intro2') {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-300">
        <Button
          variant="ghost"
          onClick={() => setStep('intro1')}
          className="w-fit text-muted-foreground -ml-2"
        >
          ← {t('Back')}
        </Button>

        <div className="flex flex-col gap-6 items-center text-center py-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">An identity you truly own</h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              No accounts, no emails, no kingmakers. Just keys. "Sign" messages with your keys to prove it's you.
            </p>
          </div>

          <Button
            onClick={() => setStep('profile')}
            className="w-full max-w-xs mt-4"
            size="lg"
          >
            {t("Let's go!")}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'profile') {
    return (
      <SignupProfile
        back={() => setStep('intro2')}
        onProfileComplete={(keys, profile) => {
          setGeneratedKeys(keys)
          setProfileData(profile)
          setStep('complete')
        }}
      />
    )
  }

  // Complete step - show keys
  return <KeysDisplay keys={generatedKeys!} profile={profileData} onComplete={onComplete} />
}

function KeysDisplay({
  keys,
  profile,
  onComplete
}: {
  keys: { nsec: string; npub: string }
  profile: ProfileData
  onComplete: () => void
}) {
  const { t } = useTranslation()
  const [nsecRevealed, setNsecRevealed] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      const text = `Public Key (npub):\n${keys.npub}\n\nPrivate Key (nsec):\n${keys.nsec}`
      await navigator.clipboard.writeText(text)
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
          <Button variant="secondary" onClick={handleCopy} className="flex-1" size="lg">
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
          <Button variant="secondary" onClick={handleDownload} className="flex-1" size="lg">
            <Download className="h-4 w-4 mr-2" />
            {t('Download')}
          </Button>
        </div>

        {hasInteracted && (
          <Button onClick={onComplete} className="w-full" size="lg">
            {t('Done')}
          </Button>
        )}
      </div>
    </div>
  )
}
