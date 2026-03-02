import { useNostr } from '@/providers/NostrProvider'
import backupService from '@/services/backup.service'
import nip78SyncService from '@/services/nip78-sync.service'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../ui/alert-dialog'

export default function BackupSettings() {
  const { t } = useTranslation()
  const nostr = useNostr()
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false)
  const [syncStatus, setSyncStatus] = useState(nip78SyncService.getStatus())
  const [backupInfo, setBackupInfo] = useState<{
    exists: boolean
    timestamp: number | null
    date: string | null
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    // Subscribe to sync status updates
    const unsubscribe = nip78SyncService.subscribe(setSyncStatus)
    setAutoSyncEnabled(nip78SyncService.isAutoSyncEnabled())
    return unsubscribe
  }, [])

  useEffect(() => {
    // Fetch backup info when logged in
    if (nostr.pubkey) {
      fetchBackupInfo()
    }
  }, [nostr.pubkey])

  const fetchBackupInfo = async () => {
    if (!nostr.pubkey) return
    try {
      const info = await nip78SyncService.getBackupInfo(nostr)
      setBackupInfo(info)
    } catch (error) {
      console.error('Failed to fetch backup info:', error)
    }
  }

  const handleExportToFile = async () => {
    setIsLoading(true)
    try {
      await backupService.exportToFile({
        includePrivateKeys: false,
        includeCache: false,
        includeHistory: false
      })
      toast.success(t('Backup exported successfully'))
    } catch (error) {
      console.error('Export failed:', error)
      toast.error(t('Failed to export backup'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleImportFromFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    try {
      await backupService.importFromFile(file, {
        includePrivateKeys: false,
        includeCache: false
      })
      toast.success(t('Backup imported successfully. Reloading...'))
      setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      console.error('Import failed:', error)
      toast.error(t('Failed to import backup'))
    } finally {
      setIsLoading(false)
      // Reset file input
      event.target.value = ''
    }
  }

  const handleBackupToNostr = async () => {
    if (!nostr.pubkey) {
      toast.error(t('Please log in to backup to Nostr'))
      return
    }

    setIsLoading(true)
    try {
      await nip78SyncService.backupToNostr(nostr, {
        includePrivateKeys: false,
        includeCache: false
      })
      toast.success(t('Backup saved to Nostr'))
      await fetchBackupInfo()
    } catch (error) {
      console.error('Backup to Nostr failed:', error)
      toast.error(t('Failed to backup to Nostr'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestoreFromNostr = async () => {
    if (!nostr.pubkey) {
      toast.error(t('Please log in to restore from Nostr'))
      return
    }

    setIsLoading(true)
    try {
      const backup = await nip78SyncService.restoreFromNostr(nostr, {
        includePrivateKeys: false,
        includeCache: false
      })

      if (!backup) {
        toast.error(t('No backup found on Nostr'))
        return
      }

      toast.success(t('Backup restored successfully. Reloading...'))
      setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      console.error('Restore from Nostr failed:', error)
      toast.error(t('Failed to restore from Nostr'))
    } finally {
      setIsLoading(false)
      setShowRestoreConfirm(false)
    }
  }

  const handleSync = async () => {
    if (!nostr.pubkey) {
      toast.error(t('Please log in to sync'))
      return
    }

    setIsLoading(true)
    try {
      const result = await nip78SyncService.sync(nostr, {
        includePrivateKeys: false,
        includeCache: false
      })

      if (result === 'backup') {
        toast.success(t('Settings backed up to Nostr'))
      } else if (result === 'restore') {
        toast.success(t('Settings restored from Nostr. Reloading...'))
        setTimeout(() => window.location.reload(), 1000)
      } else {
        toast.info(t('Settings are already in sync'))
      }

      await fetchBackupInfo()
    } catch (error) {
      console.error('Sync failed:', error)
      toast.error(t('Failed to sync'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleAutoSync = async (enabled: boolean) => {
    if (!nostr.pubkey) {
      toast.error(t('Please log in to enable auto-sync'))
      return
    }

    if (enabled) {
      nip78SyncService.startAutoSync(nostr, {
        includePrivateKeys: false,
        includeCache: false
      })
      toast.success(t('Auto-sync enabled'))
    } else {
      nip78SyncService.stopAutoSync()
      toast.success(t('Auto-sync disabled'))
    }

    setAutoSyncEnabled(enabled)
  }

  const handleDeleteBackup = async () => {
    if (!nostr.pubkey) return

    setIsLoading(true)
    try {
      await nip78SyncService.deleteBackup(nostr)
      toast.success(t('Backup deleted from Nostr'))
      await fetchBackupInfo()
    } catch (error) {
      console.error('Delete backup failed:', error)
      toast.error(t('Failed to delete backup'))
    } finally {
      setIsLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="space-y-6 px-4 pt-4">
      {/* Local File Backup */}
      <Card>
        <CardHeader>
          <CardTitle>{t('Local File Backup')}</CardTitle>
          <CardDescription>
            {t('Export and import your settings as a JSON file')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleExportToFile} disabled={isLoading} className="flex-1">
              {t('Export to File')}
            </Button>
            <Button variant="outline" disabled={isLoading} className="flex-1" asChild>
              <label htmlFor="import-file" className="cursor-pointer">
                {t('Import from File')}
                <input
                  id="import-file"
                  type="file"
                  accept=".json"
                  onChange={handleImportFromFile}
                  className="hidden"
                />
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Nostr Sync */}
      <Card>
        <CardHeader>
          <CardTitle>{t('Nostr Sync (NIP-78)')}</CardTitle>
          <CardDescription>
            {t('Sync your settings across devices using Nostr relays')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!nostr.pubkey ? (
            <div className="text-sm text-muted-foreground">
              {t('Please log in to use Nostr sync')}
            </div>
          ) : (
            <>
              {/* Backup Info */}
              {backupInfo && backupInfo.exists && (
                <div className="p-4 bg-muted rounded-lg space-y-1">
                  <p className="text-sm font-medium">{t('Remote Backup')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('Last backup')}: {backupInfo.date}
                  </p>
                </div>
              )}

              {/* Sync Status */}
              {syncStatus.lastSyncTime && (
                <div className="p-4 bg-muted rounded-lg space-y-1">
                  <p className="text-sm font-medium">{t('Sync Status')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('Last synced')}: {new Date(syncStatus.lastSyncTime).toLocaleString()}
                  </p>
                  {syncStatus.error && (
                    <p className="text-sm text-destructive">{syncStatus.error}</p>
                  )}
                </div>
              )}

              {/* Auto Sync Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-sync">{t('Auto-sync')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('Automatically sync settings every 5 minutes')}
                  </p>
                </div>
                <Switch
                  id="auto-sync"
                  checked={autoSyncEnabled}
                  onCheckedChange={handleToggleAutoSync}
                  disabled={isLoading || syncStatus.isSyncing}
                />
              </div>

              {/* Manual Actions */}
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleSync}
                  disabled={isLoading || syncStatus.isSyncing}
                  className="w-full"
                >
                  {syncStatus.isSyncing ? t('Syncing...') : t('Sync Now')}
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleBackupToNostr}
                    disabled={isLoading || syncStatus.isSyncing}
                    variant="outline"
                  >
                    {t('Backup to Nostr')}
                  </Button>
                  <Button
                    onClick={() => setShowRestoreConfirm(true)}
                    disabled={isLoading || syncStatus.isSyncing || !backupInfo?.exists}
                    variant="outline"
                  >
                    {t('Restore from Nostr')}
                  </Button>
                </div>

                {backupInfo?.exists && (
                  <Button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isLoading || syncStatus.isSyncing}
                    variant="destructive"
                    size="sm"
                  >
                    {t('Delete Remote Backup')}
                  </Button>
                )}
              </div>

              {/* Info */}
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  {t('Your settings are encrypted with NIP-44 and stored on your relays.')}
                </p>
                <p>
                  {t('Only you can decrypt and access your backup.')}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Restore from Nostr?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'This will replace your current settings with the backup from Nostr. Your current settings will be lost. The page will reload after restore.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreFromNostr}>
              {t('Restore')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete Remote Backup?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'This will permanently delete your backup from Nostr relays. This action cannot be undone.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBackup} className="bg-destructive text-destructive-foreground">
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
