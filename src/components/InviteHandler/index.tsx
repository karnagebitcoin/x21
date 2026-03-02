import { useEffect, useRef, useState } from 'react'
import { useNostr } from '@/providers/NostrProvider'
import * as nip19 from 'nostr-tools/nip19'
import InviteWelcomeFlow from '@/components/InviteWelcomeFlow'

/**
 * Component that handles invite link acceptance
 * Checks for ?invite=npub parameter and shows welcome flow
 */
export default function InviteHandler() {
  const { pubkey } = useNostr()
  const hasProcessedInvite = useRef(false)
  const [showWelcomeFlow, setShowWelcomeFlow] = useState(false)
  const [inviterPubkey, setInviterPubkey] = useState<string | null>(null)

  // Check for invite parameter on mount (before login)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const inviteParam = urlParams.get('invite')

    console.log('[InviteHandler] Checking invite param:', inviteParam, 'pubkey:', pubkey, 'hasProcessed:', hasProcessedInvite.current)

    if (inviteParam && !pubkey && !hasProcessedInvite.current) {
      // User clicked invite link but isn't logged in
      // Decode the npub to validate and get inviter's pubkey
      try {
        const decoded = nip19.decode(inviteParam)
        if (decoded.type !== 'npub') {
          console.error('[InviteHandler] Invalid invite parameter: not an npub')
          return
        }
        const inviterPk = decoded.data
        console.log('[InviteHandler] Decoded inviter pubkey:', inviterPk)

        // Show welcome flow immediately
        setInviterPubkey(inviterPk)
        setShowWelcomeFlow(true)
        hasProcessedInvite.current = true

        console.log('[InviteHandler] Set inviterPubkey state and showing welcome flow')

        // Clean up URL
        urlParams.delete('invite')
        const newUrl = urlParams.toString()
          ? `${window.location.pathname}?${urlParams.toString()}`
          : window.location.pathname
        window.history.replaceState({}, '', newUrl)
        console.log('[InviteHandler] Cleaned up URL')
      } catch (error) {
        console.error('[InviteHandler] Failed to decode invite npub:', error)
      }
    }
  }, [pubkey])

  return (
    <>
      {showWelcomeFlow && inviterPubkey && (
        <InviteWelcomeFlow
          open={showWelcomeFlow}
          onClose={() => setShowWelcomeFlow(false)}
          inviterPubkey={inviterPubkey}
        />
      )}
    </>
  )
}
