import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useNostr } from '@/providers/NostrProvider'
import { Loader, Upload, User } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { generateSecretKey } from 'nostr-tools'
import { nsecEncode, npubEncode } from 'nostr-tools/nip19'
import { getPublicKey } from 'nostr-tools'
import { createProfileDraftEvent } from '@/lib/draft-event'
import Uploader from '@/components/PostEditor/Uploader'
import { generateImageByPubkey } from '@/lib/pubkey'

export default function SignupProfile({
  back,
  onProfileComplete,
  inviterPubkey
}: {
  back: () => void
  onProfileComplete: (
    keys: { nsec: string; npub: string },
    profile: { displayName: string; username: string }
  ) => void
  inviterPubkey?: string
}) {
  const { t } = useTranslation()
  const { nsecLogin, publish, updateProfileEvent } = useNostr()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [about, setAbout] = useState('')
  const [avatar, setAvatar] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [generatedKeys, setGeneratedKeys] = useState<{ sk: Uint8Array; nsec: string; npub: string } | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Generate keys and login on mount
  useEffect(() => {
    const initAccount = async () => {
      const sk = generateSecretKey()
      const nsec = nsecEncode(sk)
      const pubkey = getPublicKey(sk)
      const npub = npubEncode(pubkey)
      setGeneratedKeys({ sk, nsec, npub })
      // Set default avatar
      setAvatar(generateImageByPubkey(pubkey))

      // Login immediately so avatar upload will work
      try {
        await nsecLogin(nsec, '', true)
        setIsLoggedIn(true)
      } catch (error) {
        console.error('Failed to login during signup:', error)
      }
    }

    initAccount()
  }, [])

  if (!generatedKeys) return null

  const handleContinue = async () => {
    setSaving(true)
    try {
      // Create and publish profile if user entered any data
      if (displayName || username || about || avatar || inviterPubkey) {
        const profileContent: any = {
          display_name: displayName,
          displayName: displayName,
          name: username || displayName,
          about,
          picture: avatar
        }

        // Add join info if invited by someone
        if (inviterPubkey) {
          profileContent.joined_through = inviterPubkey
          profileContent.joined_at = Math.floor(Date.now() / 1000)
        }

        const profileDraftEvent = createProfileDraftEvent(JSON.stringify(profileContent))
        const newProfileEvent = await publish(profileDraftEvent)
        await updateProfileEvent(newProfileEvent)
      }

      // Move to keys display
      onProfileComplete(
        { nsec: generatedKeys.nsec, npub: generatedKeys.npub },
        { displayName, username }
      )
    } catch (error) {
      console.error('Failed to create profile:', error)
      setSaving(false)
    }
  }

  const onAvatarUploadSuccess = ({ url }: { url: string }) => {
    setAvatar(url)
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <Button
        variant="ghost"
        onClick={back}
        className="w-fit text-muted-foreground -ml-2"
      >
        ← {t('Back')}
      </Button>

      <div className="text-center mb-4">
        <h2 className="text-2xl font-semibold mb-2">Your basic profile</h2>
        <p className="text-sm text-muted-foreground">
          Set up your profile (you can always change this later)
        </p>
      </div>

      <div className="flex flex-col items-center mb-4">
        <Uploader
          onUploadSuccess={onAvatarUploadSuccess}
          onUploadStart={() => setUploadingAvatar(true)}
          onUploadEnd={() => setUploadingAvatar(false)}
          className="w-24 h-24 relative cursor-pointer rounded-full border-4 border-muted hover:border-primary transition-colors group"
        >
          <Avatar className="w-full h-full">
            <AvatarImage src={avatar} className="object-cover object-center" />
            <AvatarFallback>
              <User className="w-8 h-8 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          {uploadingAvatar ? (
            <div className="absolute inset-0 bg-black/60 w-full h-full rounded-full flex flex-col justify-center items-center">
              <Loader className="animate-spin text-white" size={20} />
            </div>
          ) : (
            <div className="absolute inset-0 bg-black/40 w-full h-full rounded-full flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex">
              <Upload className="text-white" size={20} />
            </div>
          )}
        </Uploader>
        <p className="text-xs text-muted-foreground mt-2">Click to upload avatar</p>
      </div>

      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="signup-displayname-input">{t('Display Name')}</Label>
          <Input
            id="signup-displayname-input"
            placeholder="Enter your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Nostr is nym-friendly, you don't need to use your real name.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="signup-username-input">{t('Username')}</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">@</span>
            <Input
              id="signup-username-input"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="flex-1"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Usernames are not unique in nostr. Two people can have the same username.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="signup-about-textarea">{t('Short Bio')}</Label>
          <Textarea
            id="signup-about-textarea"
            placeholder="Tell us about yourself..."
            className="h-20 resize-none"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
          />
        </div>
      </div>

      <Button
        onClick={handleContinue}
        disabled={saving}
        className="w-full mt-4"
        size="lg"
      >
        {saving ? (
          <>
            <Loader className="animate-spin mr-2 h-4 w-4" />
            {t('Creating your account...')}
          </>
        ) : (
          t('Save')
        )}
      </Button>
    </div>
  )
}
