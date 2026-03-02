# Backup & Sync Feature (NIP-78)

## Overview

x21 now supports backing up and syncing your settings across devices using [NIP-78](https://github.com/nostr-protocol/nips/blob/master/78.md) (Arbitrary custom app data). This allows you to:

- **Backup your settings** to local files or Nostr relays
- **Restore settings** on any device
- **Auto-sync** across multiple devices using Nostr
- **Encrypt sensitive data** using NIP-44 encryption

## Features

### 1. Local File Backup

Export and import your settings as JSON files for offline storage or manual backup.

**What's included:**
- User preferences (theme, layout, fonts, colors)
- Relay sets and configurations
- Custom feeds and bookmarks
- Zap settings
- Content filters and privacy settings
- Widget configurations
- Menu customization
- Optional: Private keys (encrypted)
- Optional: Cache and history data

### 2. Nostr Sync (NIP-78)

Sync your settings across devices using Nostr relays with full NIP-44 encryption.

**Features:**
- Encrypted storage on your Nostr relays
- Only you can decrypt your backup (using your private key)
- Automatic sync every 5 minutes (optional)
- Manual sync, backup, and restore options
- Smart sync (only updates if changes detected)

## How to Use

### Access Backup Settings

1. Go to **Settings** (sidebar menu)
2. Click **Backup & Sync**

### Local File Backup

#### Export Backup
1. Configure options:
   - Toggle "Include cache and history" (read articles, etc.)
   - Toggle "Include private keys" (encrypted in backup)
2. Click **"Export to File"**
3. Save the JSON file to your device

#### Import Backup
1. Click **"Import from File"**
2. Select your backup JSON file
3. Page will reload with restored settings

### Nostr Sync

#### Initial Setup
1. Log in with your Nostr account
2. Go to **Settings > Backup & Sync**

#### Backup to Nostr
1. Configure backup options
2. Click **"Backup to Nostr"**
3. Your settings are encrypted and published to your relays

#### Restore from Nostr
1. Click **"Restore from Nostr"**
2. Confirm the restore action
3. Settings will be decrypted and applied
4. Page will reload

#### Auto-Sync
1. Toggle **"Auto-sync"** switch
2. Settings will automatically sync every 5 minutes
3. Smart sync: only updates if local or remote is newer

#### Manual Sync
1. Click **"Sync Now"**
2. System compares local vs remote timestamps
3. Automatically backs up or restores based on which is newer

## What Gets Backed Up

### Always Included
- Theme settings (dark/light mode, color palette)
- Font preferences (size, family)
- UI customization (radius, primary color, logo style)
- Layout preferences (compact sidebar, widgets)
- Relay sets
- Custom feeds
- Zap settings (default amount, quick zap)
- Content filters (kinds shown, media settings)
- Privacy settings (hide untrusted content)
- Notification preferences
- AI and translation service configurations
- Bookmark tags
- Pinned replies
- Menu items customization

### Optional (User Choice)
- **Private keys** (encrypted with NIP-44)
  - Warning: Keys are encrypted but stored on relays
  - Only include if you trust your relay infrastructure
- **Cache data**
  - Read articles history
  - Shown notifications
  - Other temporary data

### Never Included
- Session-only data (AI prompt widgets)
- Browser-specific temporary data
- Unencrypted private keys

## Security

### Encryption
- All Nostr backups use **NIP-44 encryption**
- Your backup is encrypted with your own public key
- Only you can decrypt it with your private key
- Relays cannot read your backup contents

### Private Keys in Backups
If you choose to include private keys:
- Keys are encrypted in the backup
- Additional layer of protection
- Still stored on relays (encrypted)
- Consider risk vs convenience

**Best Practice:** Use local file backups for private key storage, not Nostr sync.

## Technical Details

### NIP-78 Event Structure

```json
{
  "kind": 30078,
  "tags": [
    ["d", "x21/settings-backup"],
    ["l", "x21/backup"],
    ["client", "x21"]
  ],
  "content": "<encrypted-backup-data>",
  "created_at": 1234567890
}
```

### Backup Data Structure

```typescript
interface BackupData {
  version: string           // Backup format version
  timestamp: number         // When backup was created
  localStorage: {           // All localStorage data
    [key: string]: string
  }
  indexedDB: {             // Note: Events stored on relays
    // ... (not currently backed up)
  }
}
```

### Services

**`backup.service.ts`**
- Creates and restores backups
- Handles serialization/deserialization
- Manages what data to include/exclude
- Local file export/import

**`nip78-sync.service.ts`**
- Nostr relay sync via NIP-78
- NIP-44 encryption/decryption
- Smart sync logic (timestamp comparison)
- Auto-sync scheduling
- Status tracking and notifications

## Sync Status

The sync status shows:
- **Last synced**: When last sync occurred
- **Last backup**: When remote backup was created
- **Is syncing**: Current sync operation in progress
- **Error**: Any sync errors

## Limitations

1. **IndexedDB events not backed up**: Nostr events (profiles, follows, mutes) are already on relays
2. **Relay dependency**: Backup availability depends on relay uptime
3. **Size limits**: Very large backups may have relay size restrictions
4. **Sync interval**: Auto-sync runs every 5 minutes (not real-time)

## Troubleshooting

### Backup Not Found
- Ensure you're logged in with the same account
- Check if backup was created (view backup info)
- Verify relay connectivity

### Restore Failed
- Check console for detailed error messages
- Ensure backup format is valid
- Try manual backup/restore instead of sync

### Auto-Sync Not Working
- Verify you're logged in
- Check sync status for errors
- Try manual sync to test connectivity
- Check relay connection in relay settings

### Private Keys Not Restored
- If you didn't include them in backup, they won't restore
- Use local file backup for key backup
- Re-enter keys manually if needed

## Migration Guide

### From Other Clients
1. Export settings from x21 as JSON
2. Manually configure other client
3. No direct import (x21-specific format)

### To New Device
1. **Method 1: Nostr Sync**
   - Enable auto-sync on Device A
   - Log in on Device B
   - Click "Restore from Nostr"

2. **Method 2: File Transfer**
   - Export backup on Device A
   - Transfer file to Device B
   - Import backup on Device B

## Privacy Considerations

- **Backup contains preferences only** (no private messages)
- **Encrypted on relays** (NIP-44)
- **Metadata visible**: Relays know you have a backup (but not contents)
- **Relay trust**: Choose trusted relays for backup storage
- **Key backup**: Consider security implications before including keys

## Future Enhancements

Potential improvements:
- [ ] Selective restore (choose what to restore)
- [ ] Multiple backup profiles
- [ ] Backup history/versions
- [ ] Compression for large backups
- [ ] Cross-client compatibility
- [ ] Backup verification/integrity checks
- [ ] Scheduled backups (daily, weekly)

## Support

For issues or questions:
- GitHub Issues: [x21 repository](https://github.com/CodyTseng/x21/issues)
- Nostr: Contact the developer via Nostr

## Related NIPs

- [NIP-78](https://github.com/nostr-protocol/nips/blob/master/78.md): Arbitrary custom app data
- [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md): Encrypted Direct Message
- [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md): Browser extension for signing

---

**Version:** 1.0.0  
**Last Updated:** 2025-11-17
