# Profile Gallery Migration Guide

## What Changed?

Your profile gallery system has been upgraded from storing images in kind 0 metadata to using a modern, flexible approach with **NIP-94 (File Metadata)** and **NIP-51 (Lists)**.

### Old System (Legacy)
- Gallery images stored as JSON array in kind 0 (profile metadata)
- Every gallery change republished entire profile + all images
- Images couldn't be individually reacted to or commented on
- Large profile events

### New System (NIP-94 + NIP-51)
- Each image is its own **kind 1063** event (File Metadata)
- Gallery organized with **kind 30001** event (Bookmark Set)
- Images are individually addressable, reactable, and commentable
- Smaller, more efficient events
- Only publish what changes

## For Users

### Viewing Galleries

Galleries now show a **"NIP-94"** badge when using the new format. You can:

1. **View galleries normally** - Works exactly like before
2. **React to individual images** - Coming soon: reactions/comments on specific gallery images
3. **Backward compatibility** - Old galleries still display correctly

### Editing Your Gallery

When you edit your profile gallery:

1. **Upload images** - Each upload immediately publishes a kind 1063 event
2. **Edit metadata** - Update description and link for any image
3. **Remove images** - Just removes from the list, doesn't delete the event
4. **Save profile** - Publishes the gallery list (kind 30001) along with your profile

### Migration

- **Automatic**: Next time you edit your gallery, it will use the new system
- **No data loss**: Old gallery format still works for viewing
- **One-way**: Once you save with new format, it won't add images back to kind 0

## For Developers

### Architecture

#### Kind 1063 - Individual Gallery Images

Each image in the gallery is a separate event:

```json
{
  "kind": 1063,
  "content": "Description of the image",
  "tags": [
    ["url", "https://example.com/image.jpg"],
    ["m", "image/jpeg"],
    ["t", "gallery"],
    ["t", "profile-gallery"],
    ["alt", "Accessibility description"],
    ["r", "https://related-link.com"]
  ]
}
```

#### Kind 30001 - Gallery List

A bookmark set that references all gallery images:

```json
{
  "kind": 30001,
  "tags": [
    ["d", "gallery"],
    ["title", "Profile Gallery"],
    ["e", "<image-event-id-1>"],
    ["e", "<image-event-id-2>"],
    ["e", "<image-event-id-3>"]
  ]
}
```

### Key Components

- **`GalleryService`** - Core logic for parsing and managing gallery events
- **`useFetchGallery`** - Hook to fetch gallery data for a user
- **`ProfileGallery`** - Display component with backward compatibility
- **`ProfileGalleryManager`** - Editor component that publishes kind 1063 events
- **Draft Event Helpers**:
  - `createGalleryImageDraftEvent()` - Create kind 1063 draft
  - `createGalleryListDraftEvent()` - Create kind 30001 draft

### API Usage

```typescript
import { useFetchGallery } from '@/hooks/useFetchGallery'
import galleryService from '@/services/gallery.service'
import { createGalleryImageDraftEvent, createGalleryListDraftEvent } from '@/lib/draft-event'

// Fetch a user's gallery
const { isFetching, images, galleryList } = useFetchGallery(pubkey)

// Create a new gallery image event
const draftEvent = createGalleryImageDraftEvent({
  url: 'https://example.com/photo.jpg',
  description: 'My photo',
  link: 'https://example.com',
  mimeType: 'image/jpeg'
})

// Publish the image event
const publishedEvent = await publish(draftEvent)

// Update the gallery list
const galleryDraft = createGalleryListDraftEvent({
  imageEventIds: [...existingIds, publishedEvent.id],
  dTag: 'gallery',
  title: 'Profile Gallery'
})

await publish(galleryDraft)
```

### Filters

```typescript
// Fetch gallery list for a user
const listFilter = {
  kinds: [30001],
  authors: [pubkey],
  '#d': ['gallery'],
  limit: 1
}

// Fetch specific images
const imagesFilter = {
  kinds: [1063],
  ids: imageEventIds
}

// Fetch all gallery images by a user
const userImagesFilter = {
  kinds: [1063],
  authors: [pubkey],
  '#t': ['gallery'],
  limit: 100
}
```

## Benefits

### User Benefits
✅ Each image can receive reactions and comments  
✅ Faster gallery updates (only changed images)  
✅ Better organization with multiple galleries (future)  
✅ Images persist even if removed from gallery  

### Developer Benefits
✅ Smaller profile metadata events  
✅ Better relay efficiency  
✅ Granular control over individual images  
✅ Standard NIP-94 format compatible with other clients  
✅ Backward compatible with old format  

### Network Benefits
✅ Less bandwidth usage for gallery updates  
✅ Events can be cached more efficiently  
✅ Better indexing and discovery  
✅ Reusable file metadata across apps  

## Future Enhancements

- **Multiple galleries**: Travel photos, artwork, screenshots, etc.
- **Reactions on images**: Like/zap individual gallery images
- **Comments on images**: Thread discussions on specific images
- **Collaborative galleries**: Allow others to contribute
- **Private galleries**: NIP-44 encrypted galleries
- **Gallery templates**: Pre-configured layouts and themes
- **Rich metadata**: EXIF data, location, camera info
- **Image search**: Full-text search across descriptions

## Migration Timeline

1. ✅ **Phase 1**: Foundation (services, types, hooks)
2. ✅ **Phase 2**: UI components (manager and viewer)
3. ✅ **Phase 3**: Profile integration
4. 🔄 **Phase 4**: Backward compatibility (current)
5. ⏭️ **Phase 5**: Enhanced features (reactions, comments)
6. ⏭️ **Phase 6**: Multiple galleries support

## Troubleshooting

### My old gallery disappeared
- The viewer should show both old and new formats
- Check if your profile still has the `gallery` field in kind 0
- The new system is fetched separately from kind 30001

### Images not showing after upload
- Check browser console for errors
- Verify kind 1063 events are publishing
- Make sure gallery list (kind 30001) is saved

### Can't edit image metadata
- Editing creates a new kind 1063 event with same URL
- Old event remains, new event is added to gallery list
- This is by design (event immutability)

## Support

For issues or questions:
- Check `GALLERY_IMPLEMENTATION.md` for technical details
- Review code in `src/services/gallery.service.ts`
- Look at examples in `src/components/ProfileGalleryManager/`

---

**Note**: This is a one-way migration. Once you save your gallery with the new format, it won't be added back to kind 0 metadata. Your old gallery will remain visible for clients that don't support NIP-94 galleries yet.
