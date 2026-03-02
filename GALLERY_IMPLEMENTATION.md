# Profile Gallery Implementation - NIP-94 + NIP-51

## Overview

Migrating from embedding gallery images in kind 0 (metadata) to using:
- **Kind 1063 (File Metadata)** - NIP-94 for individual images
- **Kind 30001 (Bookmark Sets)** - NIP-51 for organizing images into galleries

## Benefits

1. **Granular control**: Add/remove individual images without republishing entire gallery
2. **Individually addressable**: Each image has its own event ID
3. **Reactable & Commentable**: Users can react to and comment on specific gallery images
4. **Better bandwidth**: Only publish changes, not entire gallery
5. **Smaller profile events**: Keep kind 0 metadata lean
6. **Flexible organization**: Support multiple galleries/albums using different d-tags

## Architecture

### Kind 1063 - Individual Gallery Images

Each uploaded gallery image becomes its own kind 1063 event:

```json
{
  "kind": 1063,
  "content": "Description of the image (optional)",
  "tags": [
    ["url", "https://example.com/image.jpg"],
    ["m", "image/jpeg"],
    ["x", "sha256-hash-of-file"],
    ["alt", "Accessibility description"],
    ["dim", "1920x1080"],
    ["size", "2048576"],
    ["gallery", "profile"]  // Custom tag to identify gallery images
  ]
}
```

### Kind 30001 - Profile Gallery List

A bookmark set that references gallery image events:

```json
{
  "kind": 30001,
  "content": "",
  "tags": [
    ["d", "gallery"],
    ["title", "Profile Gallery"],
    ["e", "<event-id-1>"],
    ["e", "<event-id-2>"],
    ["e", "<event-id-3>"]
  ]
}
```

### Optional: Link field

For images with associated links, we can:
1. Add `["r", "https://example.com"]` tag to kind 1063
2. Or store in content as structured JSON with description + link

## Implementation Steps

### Phase 1: Data Layer (Services)

1. **Create gallery service** (`src/services/gallery.service.ts`)
   - Upload image → create kind 1063 event
   - Create/update gallery list → kind 30001 event
   - Fetch gallery images for a pubkey
   - Add image to gallery
   - Remove image from gallery
   - Update image metadata (description, link)

2. **Update client service** (`src/services/client.service.ts`)
   - Add methods to fetch kind 1063 events
   - Add methods to fetch kind 30001 gallery lists
   - Cache gallery data

### Phase 2: Types & Constants

1. **Update types** (`src/types/index.d.ts`)
   - Keep `TGalleryImage` but mark as deprecated
   - Add `TGalleryImageEvent` for kind 1063 representation
   - Add `TGalleryList` for kind 30001 representation

2. **Update constants** (`src/constants.ts`)
   - Add `GALLERY_LIST` kind constants

### Phase 3: UI Components

1. **Update ProfileGalleryManager**
   - On upload → create kind 1063 event immediately
   - Show loading states for individual images
   - Allow editing description/link → update kind 1063 event
   - On remove → remove from gallery list (kind 30001)
   - Sync gallery list on component mount/changes

2. **Update ProfileGallery (viewer)**
   - Fetch kind 30001 to get list of image event IDs
   - Fetch kind 1063 events for each image
   - Display with reactions/comments support
   - Click to view full image with metadata

3. **Create GalleryImageCard component**
   - Display individual gallery image
   - Show reactions and comment count
   - Support liking/commenting on images

### Phase 4: Profile Integration

1. **Update Profile component**
   - Fetch and display gallery using new system
   - Keep backward compatibility for old gallery format

2. **Update ProfileEditorPage**
   - Use new gallery manager
   - Publish kind 30001 on save (if gallery changed)

### Phase 5: Migration

1. **Add migration utility**
   - Convert old gallery format to new format
   - Create kind 1063 events for existing images
   - Create kind 30001 list
   - Remove gallery from kind 0
   - One-time migration on first edit

2. **Backward compatibility**
   - Read old format if new format not available
   - Display migration prompt in UI

### Phase 6: Draft Event Helpers

1. **Update draft-event.ts**
   - Add `createGalleryImageDraftEvent()` for kind 1063
   - Add `createGalleryListDraftEvent()` for kind 30001
   - Add helpers for updating lists

## Data Flow

### Adding an image:

1. User uploads image → get URL from media service
2. Create kind 1063 event with image metadata
3. Publish kind 1063 event
4. Add event ID to local gallery list state
5. On save → publish kind 30001 with all image event IDs

### Removing an image:

1. User clicks remove on image
2. Remove event ID from local gallery list state
3. On save → publish kind 30001 without that event ID
4. (Optional) Publish kind 5 deletion event for the kind 1063

### Editing image metadata:

1. User edits description/link
2. Publish new kind 1063 event (replaceable by d-tag if needed)
3. Or use kind 1 note to add context (non-destructive)

## Backward Compatibility

- Keep reading old gallery format from kind 0
- Display migration UI for users with old format
- Support both formats during transition period
- Auto-migrate on first edit (with user confirmation)

## Future Enhancements

1. **Multiple galleries**: Use different d-tags (e.g., "gallery-travel", "gallery-art")
2. **Gallery privacy**: Use NIP-44 encryption for private galleries
3. **Collaborative galleries**: Allow others to contribute to galleries
4. **Gallery templates**: Pre-configured layouts and themes
5. **Image metadata**: EXIF data, location, camera info
6. **Image search**: Full-text search across descriptions

## Files to Create/Modify

### New Files:
- `src/services/gallery.service.ts`
- `src/lib/gallery.ts` (helper functions)
- `src/components/GalleryImageCard/index.tsx`
- `src/hooks/useGallery.tsx`
- `src/hooks/useFetchGalleryImages.tsx`

### Modified Files:
- `src/types/index.d.ts`
- `src/constants.ts`
- `src/lib/draft-event.ts`
- `src/services/client.service.ts`
- `src/components/ProfileGallery/index.tsx`
- `src/components/ProfileGalleryManager/index.tsx`
- `src/pages/secondary/ProfileEditorPage/index.tsx`
- `src/providers/NostrProvider/index.tsx`
- `src/lib/event-metadata.ts`
