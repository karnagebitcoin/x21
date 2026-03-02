import * as nip44 from 'nostr-tools/nip44'

/**
 * Encrypt plaintext using NIP-44 v2 encryption
 * @param privkey - Private key as Uint8Array
 * @param pubkey - Public key as hex string
 * @param plaintext - Plain text to encrypt
 * @returns Base64 encoded encrypted payload
 */
export function encrypt(privkey: Uint8Array, pubkey: string, plaintext: string): string {
  const conversationKey = nip44.getConversationKey(privkey, pubkey)
  return nip44.encrypt(plaintext, conversationKey)
}

/**
 * Decrypt ciphertext using NIP-44 v2 encryption
 * @param privkey - Private key as Uint8Array
 * @param pubkey - Public key as hex string
 * @param ciphertext - Base64 encoded encrypted payload
 * @returns Decrypted plain text
 */
export function decrypt(privkey: Uint8Array, pubkey: string, ciphertext: string): string {
  const conversationKey = nip44.getConversationKey(privkey, pubkey)
  return nip44.decrypt(ciphertext, conversationKey)
}

/**
 * Detect if ciphertext is NIP-04 or NIP-44 format
 * NIP-04 format: content?iv=base64
 * NIP-44 format: base64 with version byte 0x02 as first byte
 */
export function detectEncryptionVersion(ciphertext: string): 'nip04' | 'nip44' {
  try {
    // NIP-04 format check: contains "?iv=" separator
    if (ciphertext.includes('?iv=')) {
      return 'nip04'
    }

    // Try to decode as base64 and check first byte for NIP-44
    try {
      const bytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))

      // NIP-44 v2 always starts with version byte 0x02
      // and has minimum length of 99 bytes
      if (bytes.length >= 99 && bytes[0] === 0x02) {
        return 'nip44'
      }
    } catch {
      // Couldn't decode as base64, might be NIP-04
    }

    // Default to NIP-04 for backward compatibility
    return 'nip04'
  } catch (error) {
    console.warn('Error detecting encryption version, defaulting to NIP-04:', error)
    return 'nip04'
  }
}
