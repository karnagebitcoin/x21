import { Event } from 'nostr-tools'
import { BIG_RELAY_URLS } from '@/constants'
import backupService, { BackupData, BackupOptions } from './backup.service'
import client from './client.service'

export interface SyncStatus {
  lastSyncTime: number | null
  lastBackupTime: number | null
  isSyncing: boolean
  error: string | null
}

export interface NostrSigner {
  pubkey: string | null
  nip44Encrypt: (pubkey: string, plainText: string) => Promise<string>
  nip44Decrypt: (pubkey: string, cipherText: string) => Promise<string>
  publish: (
    draftEvent: any,
    options?: any
  ) => Promise<Event>
  signEvent: (draftEvent: any) => Promise<Event>
}

const NIP78_KIND = 30078
const BACKUP_D_TAG = 'x21/settings-backup'
const SYNC_INTERVAL = 5 * 60 * 1000 // 5 minutes

class Nip78SyncService {
  private static instance: Nip78SyncService
  private syncStatus: SyncStatus = {
    lastSyncTime: null,
    lastBackupTime: null,
    isSyncing: false,
    error: null
  }
  private autoSyncInterval: NodeJS.Timeout | null = null
  private listeners: ((status: SyncStatus) => void)[] = []

  static getInstance(): Nip78SyncService {
    if (!Nip78SyncService.instance) {
      Nip78SyncService.instance = new Nip78SyncService()
    }
    return Nip78SyncService.instance
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener({ ...this.syncStatus }))
  }

  private updateStatus(updates: Partial<SyncStatus>) {
    this.syncStatus = { ...this.syncStatus, ...updates }
    this.notifyListeners()
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return { ...this.syncStatus }
  }

  /**
   * Backup current settings to Nostr
   */
  async backupToNostr(
    signer: NostrSigner,
    options: BackupOptions = {}
  ): Promise<Event | null> {
    if (!signer.pubkey) {
      throw new Error('No pubkey available')
    }

    this.updateStatus({ isSyncing: true, error: null })

    try {
      // Create backup
      const backup = await backupService.createBackup(options)

      // Serialize and encrypt
      const serialized = backupService.serializeBackup(backup)
      const encrypted = await signer.nip44Encrypt(signer.pubkey, serialized)

      // Create Nostr event
      const draftEvent = {
        kind: NIP78_KIND,
        tags: [
          ['d', BACKUP_D_TAG],
          ['l', 'x21/backup'],
          ['client', 'x21']
        ],
        content: encrypted,
        created_at: Math.floor(Date.now() / 1000)
      }

      // Sign and publish
      const event = await signer.publish(draftEvent)

      this.updateStatus({
        lastBackupTime: Date.now(),
        isSyncing: false,
        error: null
      })

      return event
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Backup failed'
      this.updateStatus({
        isSyncing: false,
        error: errorMessage
      })
      throw error
    }
  }

  /**
   * Restore settings from Nostr
   */
  async restoreFromNostr(
    signer: NostrSigner,
    options: BackupOptions = {}
  ): Promise<BackupData | null> {
    if (!signer.pubkey) {
      throw new Error('No pubkey available')
    }

    this.updateStatus({ isSyncing: true, error: null })

    try {
      // Fetch the backup event
      const event = await this.fetchBackupEvent(signer.pubkey)

      if (!event) {
        this.updateStatus({ isSyncing: false, error: 'No backup found' })
        return null
      }

      // Decrypt and deserialize
      const decrypted = await signer.nip44Decrypt(signer.pubkey, event.content)
      const backup = backupService.deserializeBackup(decrypted)

      // Restore backup
      await backupService.restoreBackup(backup, options)

      this.updateStatus({
        lastSyncTime: Date.now(),
        lastBackupTime: event.created_at * 1000,
        isSyncing: false,
        error: null
      })

      return backup
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Restore failed'
      this.updateStatus({
        isSyncing: false,
        error: errorMessage
      })
      throw error
    }
  }

  /**
   * Fetch the backup event from Nostr
   */
  private async fetchBackupEvent(pubkey: string): Promise<Event | null> {
    return new Promise((resolve, reject) => {
      const filter = {
        kinds: [NIP78_KIND],
        authors: [pubkey],
        '#d': [BACKUP_D_TAG],
        limit: 1
      }

      let event: Event | null = null
      const timeout = setTimeout(() => {
        sub.close()
        resolve(event)
      }, 10000) // 10 second timeout

      const sub = client.subscribe(
        BIG_RELAY_URLS,
        filter,
        {
          onevent: (e) => {
            if (!event || e.created_at > event.created_at) {
              event = e
            }
          },
          oneose: () => {
            clearTimeout(timeout)
            sub.close()
            resolve(event)
          }
        }
      )
    })
  }

  /**
   * Check if there's a newer backup on Nostr
   */
  async hasNewerBackup(signer: NostrSigner): Promise<boolean> {
    if (!signer.pubkey) return false

    try {
      const event = await this.fetchBackupEvent(signer.pubkey)
      if (!event) return false

      const remoteTimestamp = event.created_at * 1000
      const localTimestamp = this.syncStatus.lastBackupTime || 0

      return remoteTimestamp > localTimestamp
    } catch (error) {
      console.error('Failed to check for newer backup:', error)
      return false
    }
  }

  /**
   * Get backup info without downloading
   */
  async getBackupInfo(signer: NostrSigner): Promise<{
    exists: boolean
    timestamp: number | null
    date: string | null
  }> {
    if (!signer.pubkey) {
      return { exists: false, timestamp: null, date: null }
    }

    try {
      const event = await this.fetchBackupEvent(signer.pubkey)
      if (!event) {
        return { exists: false, timestamp: null, date: null }
      }

      const timestamp = event.created_at * 1000
      return {
        exists: true,
        timestamp,
        date: new Date(timestamp).toLocaleString()
      }
    } catch (error) {
      console.error('Failed to get backup info:', error)
      return { exists: false, timestamp: null, date: null }
    }
  }

  /**
   * Sync settings with Nostr (smart sync)
   * - If remote is newer, restore from Nostr
   * - If local is newer, backup to Nostr
   * - If equal, do nothing
   */
  async sync(signer: NostrSigner, options: BackupOptions = {}): Promise<'backup' | 'restore' | 'none'> {
    if (!signer.pubkey) {
      throw new Error('No pubkey available')
    }

    this.updateStatus({ isSyncing: true, error: null })

    try {
      const event = await this.fetchBackupEvent(signer.pubkey)
      
      if (!event) {
        // No remote backup, create one
        await this.backupToNostr(signer, options)
        return 'backup'
      }

      const remoteTimestamp = event.created_at * 1000
      const localTimestamp = this.syncStatus.lastBackupTime || 0

      if (remoteTimestamp > localTimestamp) {
        // Remote is newer, restore
        await this.restoreFromNostr(signer, options)
        return 'restore'
      } else if (localTimestamp > remoteTimestamp) {
        // Local is newer, backup
        await this.backupToNostr(signer, options)
        return 'backup'
      }

      // Equal, do nothing
      this.updateStatus({ isSyncing: false })
      return 'none'
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed'
      this.updateStatus({
        isSyncing: false,
        error: errorMessage
      })
      throw error
    }
  }

  /**
   * Start automatic sync
   */
  startAutoSync(signer: NostrSigner, options: BackupOptions = {}) {
    if (this.autoSyncInterval) {
      this.stopAutoSync()
    }

    // Initial sync
    this.sync(signer, options).catch(console.error)

    // Set up interval
    this.autoSyncInterval = setInterval(() => {
      this.sync(signer, options).catch(console.error)
    }, SYNC_INTERVAL)
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval)
      this.autoSyncInterval = null
    }
  }

  /**
   * Is auto-sync enabled
   */
  isAutoSyncEnabled(): boolean {
    return this.autoSyncInterval !== null
  }

  /**
   * Delete backup from Nostr
   */
  async deleteBackup(signer: NostrSigner): Promise<void> {
    if (!signer.pubkey) {
      throw new Error('No pubkey available')
    }

    const event = await this.fetchBackupEvent(signer.pubkey)
    if (!event) {
      return
    }

    // Create deletion event
    const draftEvent = {
      kind: 5,
      tags: [['e', event.id]],
      content: 'Deleting backup',
      created_at: Math.floor(Date.now() / 1000)
    }

    await signer.publish(draftEvent)

    this.updateStatus({
      lastBackupTime: null,
      lastSyncTime: null
    })
  }
}

const instance = Nip78SyncService.getInstance()
export default instance
