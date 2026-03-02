# Profile Gallery System - NIP-94 Implementation

## Overview

This x21 implementation uses **NIP-94 (File Metadata)** combined with **NIP-51 (Lists)** to create a modern, flexible profile gallery system.

## Why NIP-94?

### Problems with the Old Approach
The legacy system stored galleries as a JSON array in kind 0 (profile metadata):

```json
{
  "kind": 0,
  "content": "{
    \"name\": \"Alice\",
    \"gallery\": [
      {\"url\": \"...\", \"description\": \"...\"},
      {\"url\": \"...\", \"description\": \"...\"}
    ]
  }"
}
```

**Issues:**
- 🔴 Every gallery change republishes entire profile
- 🔴 Images can't be individually addressed
- 🔴 No reactions or comments on specific images
- 🔴 Profile events become very large
- 🔴 Wasteful bandwidth usage

### The NIP-94 Solution

**Kind 1063** - Each image is its own event:
```json
{
  "kind": 1063,
  "content": "My awesome photo",
  "tags": [
    ["url", "https://example.com/photo.jpg"],
    ["m", "image/jpeg"],
    ["t", "gallery"],
    ["t", "profile-gallery"],
    ["r", "https://related-link.com"]
  ]
}
```

**Kind 30001** - Gallery list references images:
```json
{
  "kind": 30001,
  "tags": [
    ["d", "gallery"],
    ["title", "Profile Gallery"],
    ["e", "<event-id-1>"],
    ["e", "<event-id-2>"]
  ]
}
```

**Benefits:**
- ✅ Granular updates (only changed images)
- ✅ Individual image addressability
- ✅ Reactions and comments support
- ✅ Smaller profile events
- ✅ Efficient bandwidth usage
- ✅ Standard NIP compliance

## Architecture

### Components

```
src/
├── services/
│   └── gallery.service.ts          # Core gallery logic
├── hooks/
│   └── useFetchGallery.tsx         # React hook for fetching galleries
├── components/
│   ├── ProfileGallery/             # Gallery viewer (backward compatible)
│   └── ProfileGalleryManager/      # Gallery editor (publishes kind 1063)
├── lib/
│   └── draft-event.ts              # Gallery event creation helpers
└── types/
    └── index.d.ts                  # TGalleryImageEvent, TGalleryList
```

### Data Flow

#### Viewing a Gallery

```
User visits profile
    ↓
ProfileGallery component
    ↓
useFetchGallery hook
    ↓
1. Fetch kind 30001 (gallery list)
2. Extract image event IDs
3. Fetch kind 1063 events
4. Parse and sort images
    ↓
Display gallery
```

#### Adding an Image

```
User uploads image
    ↓
Media upload service returns URL
    ↓
Create kind 1063 draft event
    ↓
Publish kind 1063 event
    ↓
Add event ID to local state
    ↓
User clicks Save
    ↓
Publish kind 30001 with all image IDs
```

#### Removing an Image

```
User clicks remove
    ↓
Remove event ID from local state
    ↓
User clicks Save
    ↓
Publish kind 30001 without that ID
    ↓
(Optional) Publish kind 5 deletion event
```

## Usage Examples

### Display a Gallery

```tsx
import ProfileGallery from '@/components/ProfileGallery'

function UserProfile({ pubkey }: { pubkey: string }) {
  return (
    <div>
      <ProfileGallery pubkey={pubkey} maxImages={8} />
    </div>
  )
}
```

### Manage a Gallery

```tsx
import ProfileGalleryManager from '@/components/ProfileGalleryManager'

function ProfileEditor() {
  const [imageEventIds, setImageEventIds] = useState<string[]>([])

  return (
    <ProfileGalleryManager 
      onChange={setImageEventIds}
    />
  )
}
```

### Fetch Gallery Data

```tsx
import { useFetchGallery } from '@/hooks/useFetchGallery'

function GalleryStats({ pubkey }: { pubkey: string }) {
  const { isFetching, images, galleryList } = useFetchGallery(pubkey)

  if (isFetching) return <div>Loading...</div>

  return (
    <div>
      <p>Gallery: {galleryList?.title}</p>
      <p>Images: {images.length}</p>
    </div>
  )
}
```

### Create Gallery Events

```typescript
import { createGalleryImageDraftEvent, createGalleryListDraftEvent } from '@/lib/draft-event'
import { useNostr } from '@/providers/NostrProvider'

function MyComponent() {
  const { publish } = useNostr()

  const addImage = async (url: string) => {
    // Create kind 1063 event
    const imageDraft = createGalleryImageDraftEvent({
      url,
      description: 'My photo',
      link: 'https://example.com',
      mimeType: 'image/jpeg',
      alt: 'Description for accessibility'
    })

    // Publish the image event
    const imageEvent = await publish(imageDraft)
    
    return imageEvent.id
  }

  const saveGallery = async (imageEventIds: string[]) => {
    // Create kind 30001 gallery list
    const listDraft = createGalleryListDraftEvent({
      imageEventIds,
      dTag: 'gallery',
      title: 'Profile Gallery'
    })

    // Publish the gallery list
    await publish(listDraft)
  }
}
```

## API Reference

### GalleryService

```typescript
class GalleryService {
  // Parse kind 1063 event to TGalleryImageEvent
  parseGalleryImageEvent(event: Event): TGalleryImageEvent | null

  // Parse kind 30001 event to TGalleryList
  parseGalleryListEvent(event: Event): TGalleryList | null

  // Create filter for gallery list
  createGalleryListFilter(pubkey: string, dTag?: string): Filter

  // Create filter for specific images
  createGalleryImagesFilter(eventIds: string[]): Filter

  // Create filter for all user's gallery images
  createUserGalleryImagesFilter(pubkey: string, limit?: number): Filter

  // Sort images by gallery list order
  sortGalleryImages(images: TGalleryImageEvent[], orderedIds: string[]): TGalleryImageEvent[]
}
```

### Types

```typescript
// Kind 1063 representation
type TGalleryImageEvent = {
  id: string
  pubkey: string
  created_at: number
  url: string
  description?: string
  link?: string
  mimeType?: string
  hash?: string
  size?: number
  dimensions?: string
  alt?: string
  blurhash?: string
  thumb?: string
}

// Kind 30001 representation
type TGalleryList = {
  id: string
  pubkey: string
  created_at: number
  dTag: string
  title?: string
  imageEventIds: string[]
}
```

### Hooks

```typescript
// Fetch gallery for a pubkey
function useFetchGallery(pubkey?: string, dTag?: string): {
  isFetching: boolean
  error: Error | null
  galleryList: TGalleryList | null
  images: TGalleryImageEvent[]
}
```

## Backward Compatibility

The system maintains full backward compatibility:

1. **Reading**: ProfileGallery component checks for both formats
   - First tries to fetch kind 30001 + kind 1063
   - Falls back to legacy gallery from kind 0

2. **Writing**: ProfileGalleryManager uses new format
   - Publishes kind 1063 for each image
   - Publishes kind 30001 for the list
   - Removes gallery from kind 0

3. **Migration**: Automatic on first edit
   - No manual migration needed
   - Old format still displays correctly
   - One-way migration (new format doesn't go back to kind 0)

## Event Tags

### Kind 1063 Tags

| Tag | Description | Required |
|-----|-------------|----------|
| `url` | Image URL | ✅ |
| `m` | MIME type | Optional |
| `x` | SHA-256 hash | Optional |
| `size` | File size in bytes | Optional |
| `dim` | Dimensions (WxH) | Optional |
| `alt` | Alt text for accessibility | Optional |
| `blurhash` | Blurhash for preview | Optional |
| `thumb` | Thumbnail URL | Optional |
| `r` | Related link | Optional |
| `t` | Tag (use "gallery") | ✅ |

### Kind 30001 Tags

| Tag | Description | Required |
|-----|-------------|----------|
| `d` | Identifier (use "gallery") | ✅ |
| `title` | Gallery title | Optional |
| `e` | Image event ID (multiple) | ✅ |

## Best Practices

### For Users

1. **Upload images individually** - Each becomes its own event
2. **Add descriptions** - Makes images searchable and accessible
3. **Use links** - Connect images to related content
4. **Remove unused images** - Keeps gallery organized

### For Developers

1. **Tag with "gallery"** - Makes images filterable
2. **Preserve order** - Gallery list maintains image order
3. **Cache aggressively** - Kind 1063 events don't change
4. **Handle failures gracefully** - Image upload might fail
5. **Support both formats** - During transition period

## Performance Considerations

### Caching

- Kind 1063 events are immutable → cache indefinitely
- Kind 30001 is replaceable → cache with invalidation
- Gallery list changes less frequently than individual images

### Fetching

- Fetch gallery list first (1 event)
- Batch fetch images (N events in one query)
- Only fetch visible images initially
- Lazy load additional images

### Publishing

- Publish images immediately on upload
- Batch gallery list update on save
- Use optimistic UI updates

## Troubleshooting

### Images not appearing

1. Check if kind 1063 events published successfully
2. Verify gallery list (kind 30001) includes image IDs
3. Ensure images are tagged with "gallery"
4. Check relay connectivity

### Slow gallery loading

1. Reduce number of images fetched
2. Implement pagination
3. Cache gallery list and images
4. Use thumbnails for initial load

### Gallery out of sync

1. Re-fetch gallery list
2. Clear local cache
3. Verify image event IDs exist
4. Check for relay inconsistencies

## Future Enhancements

### Planned Features

- 🔜 **Reactions on images**: Like/zap individual images
- 🔜 **Comments on images**: Thread discussions
- 🔜 **Multiple galleries**: Travel, Art, Work, etc.
- 🔜 **Private galleries**: NIP-44 encryption
- 🔜 **Collaborative galleries**: Multi-author galleries
- 🔜 **Image metadata**: EXIF, location, camera
- 🔜 **Advanced search**: Filter by description, tags

### Possible Extensions

- Image albums with custom layouts
- Gallery themes and templates
- Image collections/sets
- Slideshow mode
- Image comparison view
- Bulk operations

## Related NIPs

- **NIP-01**: Basic protocol
- **NIP-94**: File metadata (kind 1063)
- **NIP-51**: Lists (kind 30001)
- **NIP-25**: Reactions (for image likes)
- **NIP-44**: Encrypted payloads (for private galleries)

## Resources

- [NIP-94 Specification](https://github.com/nostr-protocol/nips/blob/master/94.md)
- [NIP-51 Specification](https://github.com/nostr-protocol/nips/blob/master/51.md)
- [Implementation Documentation](./GALLERY_IMPLEMENTATION.md)
- [Migration Guide](./GALLERY_MIGRATION_GUIDE.md)

## License

Same as x21 project (MIT)
