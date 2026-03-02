# Profile Prefetching Optimization

## Problem

Previously, user metadata (kind 0 events) loaded slower than notes, creating a noticeable visual lag:

1. **Timeline loads** → Notes (kind 1) fetched from relays
2. **Notes render** → Empty avatars/usernames displayed
3. **Profile requests** → Each NoteCard triggers `useFetchProfile`
4. **Profiles batch** → DataLoader batches requests (10ms delay)
5. **Profiles render** → Avatars/usernames pop in with delay

This waterfall effect created a poor user experience where content appeared incomplete.

## Solution

Instead of fetching notes first and then profiles, we now fetch both **in parallel**:

1. **Timeline loads** → Notes (kind 1) fetched from relays
2. **Profile prefetch** → Extract pubkeys, trigger profile loads immediately
3. **Notes render** → Profiles already available in cache
4. **Complete display** → Full content with avatars/usernames from the start

## Implementation

### New Helper Method

```typescript
/**
 * Prefetch profiles for all pubkeys in the given events.
 * This ensures profile data is loaded in parallel with notes,
 * reducing the visual lag when rendering note cards.
 */
private prefetchProfilesForEvents(events: NEvent[]) {
  if (!events.length) return

  // Extract unique pubkeys from events
  const uniquePubkeys = new Set<string>()
  events.forEach((evt) => {
    uniquePubkeys.add(evt.pubkey)
    // Also prefetch mentioned users (p tags) for better UX
    evt.tags.forEach(([tagName, tagValue]) => {
      if (tagName === 'p' && tagValue && /^[0-9a-f]{64}$/.test(tagValue)) {
        uniquePubkeys.add(tagValue)
      }
    })
  })

  // Trigger prefetch using the dataloader (which batches requests)
  // We don't await this - it runs in parallel with rendering
  Array.from(uniquePubkeys).forEach((pubkey) => {
    this.replaceableEventFromBigRelaysDataloader.load({ pubkey, kind: kinds.Metadata })
  })
}
```

### Integration Points

**1. Initial Timeline Load** (`_subscribeTimeline`)
- Prefetch profiles for cached events before rendering
- Prefetch profiles when EOSE (end of stored events) is reached
- Prefetch profiles for new real-time events

**2. Aggregated Timelines** (`subscribeTimeline`)
- Used by reply threads, which subscribe to multiple filters at once
- Prefetch profiles when aggregating events from multiple subscriptions
- Prefetch profiles for new real-time replies

**3. Load More** (`_loadMoreTimeline` and `loadMoreTimeline`)
- Prefetch profiles for cached events being returned
- Prefetch profiles for newly fetched events
- Handles both single and aggregated timelines
- Ensures smooth scrolling with no visual lag

**4. Direct Event Fetching** (`fetchEvents`)
- Prefetch profiles for any events fetched outside timeline subscriptions
- Covers edge cases like batch fetches, search results, etc.

**5. New Events** (real-time updates)
- Prefetch profile immediately when new event arrives
- Profile ready before "New Notes" button is clicked
- Works for both main feed and reply threads

## Benefits

✅ **No visual lag** - Profiles load in parallel, not sequentially
✅ **Better UX** - Complete content displayed immediately
✅ **Maintains efficiency** - Uses existing DataLoader batching
✅ **Prefetches mentions** - Even mentioned users load faster
✅ **Non-blocking** - Doesn't slow down note rendering
✅ **Comprehensive coverage** - Works in feeds, replies, and all event lists
✅ **Consistent behavior** - Same optimization everywhere

## Technical Details

### Batching Mechanism

The existing DataLoader configuration is used:
- **Batch window**: 10ms (groups multiple requests)
- **Max batch size**: 500 profiles per request
- **Cache key**: `${pubkey}:${kind}` (e.g., `abc123...:0`)

### Request Flow

```
Timeline Query (kind 1, 6, etc.)
    ↓
Events received
    ↓
Extract pubkeys → [pubkey1, pubkey2, ...]
    ↓
Trigger DataLoader loads (batched)
    ↓
Profile query (kind 0) → BIG_RELAY_URLS
    ↓
Profiles cached in memory + IndexedDB
    ↓
NoteCard renders → Profile already available
```

### Performance Characteristics

- **Network**: Same number of requests (batched efficiently)
- **Memory**: Minimal overhead (Set for deduplication)
- **CPU**: Lightweight extraction loop per event batch
- **Latency**: Parallel fetching reduces perceived load time

## Alternative Considered

The user asked if we should merge note and profile queries into a single subscription:

```typescript
// Single subscription for both
client.subscribe(relays, [
  { kinds: [1, 6, 7, ...], limit: 200 },  // notes
  { kinds: [0], authors: [...pubkeys] }    // profiles
])
```

**Why we didn't do this:**
1. **Dynamic pubkeys** - We don't know which pubkeys to fetch until we receive notes
2. **Caching** - Existing profile cache/IndexedDB would be bypassed
3. **Batching benefits** - DataLoader already optimizes profile requests
4. **Code complexity** - Would require major refactoring of existing systems

The prefetch approach gets us the same user experience with minimal changes.

## Future Optimizations

Potential improvements:
- Prefetch relay lists (kind 10002) for mentioned users
- Prefetch NIP-05 verification data
- Adjustable prefetch depth (mentions of mentions?)
- Smart prefetching based on user scroll patterns

## Testing

To verify the optimization:
1. Open browser DevTools → Network tab
2. Filter for WebSocket connections
3. Load a timeline with notes
4. Observe profile requests fire immediately (not after note rendering)
5. Check that avatars/usernames appear without delay

## Rollback

If issues arise, the prefetch calls can be safely removed without breaking functionality. The app will revert to the previous sequential loading behavior.
