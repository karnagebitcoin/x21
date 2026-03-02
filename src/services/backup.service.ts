import { StorageKey } from '@/constants'
import { Event } from 'nostr-tools'
import indexedDb from './indexed-db.service'
import storage from './local-storage.service'

export interface BackupData {
  version: string
  timestamp: number
  localStorage: Record<string, string>
  indexedDB: {
    profileEvents: Event[]
    relayListEvents: Event[]
    followListEvents: Event[]
    muteListEvents: Event[]
    bookmarkListEvents: Event[]
    blossomServerListEvents: Event[]
    userEmojiListEvents: Event[]
    emojiSetEvents: Event[]
    pinListEvents: Event[]
    favoriteRelaysEvents: Event[]
    relaySetsEvents: Event[]
    muteDecryptedTags: Record<string, string[][]>
    followingFavoriteRelays: Record<string, [string, string[]][]>
  }
}

export interface BackupOptions {
  includePrivateKeys?: boolean
  includeCache?: boolean
  includeHistory?: boolean
}

// Keys that should not be backed up
const EXCLUDED_STORAGE_KEYS = [
  StorageKey.AI_PROMPT_WIDGETS, // Session-only
  'version' // Auto-managed
]

// Keys that contain sensitive data (only include if user explicitly allows)
const SENSITIVE_STORAGE_KEYS = [StorageKey.ACCOUNTS]

// Keys that are cache/history (only include if user explicitly allows)
const CACHE_STORAGE_KEYS = [
  StorageKey.READ_ARTICLES,
  StorageKey.SHOWN_CREATE_WALLET_GUIDE_TOAST_PUBKEYS
]

class BackupService {
  private static instance: BackupService

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService()
    }
    return BackupService.instance
  }

  /**
   * Create a backup of all user data
   */
  async createBackup(options: BackupOptions = {}): Promise<BackupData> {
    const {
      includePrivateKeys = false,
      includeCache = false,
      includeHistory = true
    } = options

    const backup: BackupData = {
      version: '1.0.0',
      timestamp: Date.now(),
      localStorage: {},
      indexedDB: {
        profileEvents: [],
        relayListEvents: [],
        followListEvents: [],
        muteListEvents: [],
        bookmarkListEvents: [],
        blossomServerListEvents: [],
        userEmojiListEvents: [],
        emojiSetEvents: [],
        pinListEvents: [],
        favoriteRelaysEvents: [],
        relaySetsEvents: [],
        muteDecryptedTags: {},
        followingFavoriteRelays: {}
      }
    }

    // Backup LocalStorage
    Object.values(StorageKey).forEach((key) => {
      // Skip excluded keys
      if (EXCLUDED_STORAGE_KEYS.includes(key)) {
        return
      }

      // Skip sensitive keys if not included
      if (!includePrivateKeys && SENSITIVE_STORAGE_KEYS.includes(key)) {
        return
      }

      // Skip cache keys if not included
      if (!includeCache && CACHE_STORAGE_KEYS.includes(key)) {
        return
      }

      const value = window.localStorage.getItem(key)
      if (value) {
        backup.localStorage[key] = value
      }
    })

    // If including private keys, sanitize the accounts data
    if (!includePrivateKeys && backup.localStorage[StorageKey.ACCOUNTS]) {
      try {
        const accounts = JSON.parse(backup.localStorage[StorageKey.ACCOUNTS])
        const sanitizedAccounts = accounts.map((account: any) => ({
          ...account,
          nsec: undefined,
          ncryptsec: undefined,
          bunkerNsec: undefined
        }))
        backup.localStorage[StorageKey.ACCOUNTS] = JSON.stringify(sanitizedAccounts)
      } catch (e) {
        console.error('Failed to sanitize accounts', e)
      }
    }

    // Note: IndexedDB events are stored on relays, so we don't need to back them up
    // The backup is primarily for localStorage preferences and settings

    return backup
  }

  /**
   * Restore data from a backup
   */
  async restoreBackup(backup: BackupData, options: BackupOptions = {}): Promise<void> {
    const { includePrivateKeys = false, includeCache = false } = options

    // Validate backup version
    if (!backup.version || !backup.timestamp) {
      throw new Error('Invalid backup format')
    }

    // Restore LocalStorage
    Object.entries(backup.localStorage).forEach(([key, value]) => {
      // Skip sensitive keys if not including private keys
      if (!includePrivateKeys && SENSITIVE_STORAGE_KEYS.includes(key)) {
        return
      }

      // Skip cache keys if not including cache
      if (!includeCache && CACHE_STORAGE_KEYS.includes(key)) {
        return
      }

      window.localStorage.setItem(key, value)
    })

    // Re-initialize storage service
    storage.init()
  }

  /**
   * Export backup to JSON file
   */
  async exportToFile(options: BackupOptions = {}): Promise<void> {
    const backup = await this.createBackup(options)
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const filename = `x21-backup-${new Date().toISOString().split('T')[0]}.json`
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Import backup from JSON file
   */
  async importFromFile(file: File, options: BackupOptions = {}): Promise<void> {
    const text = await file.text()
    const backup: BackupData = JSON.parse(text)
    await this.restoreBackup(backup, options)
  }

  /**
   * Serialize backup to encrypted string
   */
  serializeBackup(backup: BackupData): string {
    return JSON.stringify(backup)
  }

  /**
   * Deserialize backup from encrypted string
   */
  deserializeBackup(data: string): BackupData {
    return JSON.parse(data)
  }

  /**
   * Get a summary of what's in a backup
   */
  getBackupSummary(backup: BackupData): {
    version: string
    timestamp: number
    date: string
    settingsCount: number
    hasPrivateKeys: boolean
  } {
    const hasPrivateKeys = Boolean(
      backup.localStorage[StorageKey.ACCOUNTS] &&
        JSON.parse(backup.localStorage[StorageKey.ACCOUNTS]).some(
          (acc: any) => acc.nsec || acc.ncryptsec || acc.bunkerNsec
        )
    )

    return {
      version: backup.version,
      timestamp: backup.timestamp,
      date: new Date(backup.timestamp).toLocaleString(),
      settingsCount: Object.keys(backup.localStorage).length,
      hasPrivateKeys
    }
  }

  /**
   * Create a minimal backup (settings only, no sensitive data)
   */
  async createMinimalBackup(): Promise<BackupData> {
    return this.createBackup({
      includePrivateKeys: false,
      includeCache: false,
      includeHistory: false
    })
  }

  /**
   * Create a full backup (everything)
   */
  async createFullBackup(): Promise<BackupData> {
    return this.createBackup({
      includePrivateKeys: true,
      includeCache: true,
      includeHistory: true
    })
  }

  /**
   * Compare two backups and return differences
   */
  compareBackups(
    backup1: BackupData,
    backup2: BackupData
  ): {
    addedKeys: string[]
    removedKeys: string[]
    modifiedKeys: string[]
  } {
    const keys1 = new Set(Object.keys(backup1.localStorage))
    const keys2 = new Set(Object.keys(backup2.localStorage))

    const addedKeys = [...keys2].filter((k) => !keys1.has(k))
    const removedKeys = [...keys1].filter((k) => !keys2.has(k))
    const modifiedKeys = [...keys1].filter(
      (k) => keys2.has(k) && backup1.localStorage[k] !== backup2.localStorage[k]
    )

    return { addedKeys, removedKeys, modifiedKeys }
  }
}

const instance = BackupService.getInstance()
export default instance
