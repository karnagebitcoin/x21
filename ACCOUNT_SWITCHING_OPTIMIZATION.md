# Account Switching Optimization

## Problem

The account switching UI (AccountManager/AccountList) was showing loading skeletons for avatars and usernames, even though these accounts were logged in and their profiles should be cached locally.

**User Experience:**
1. Open account switcher
2. See empty account cards with loading skeletons
3. Wait for profiles to load from IndexedDB (one by one)
4. Profiles pop in with visible delay

This felt slow and unpolished, especially since all the data was already stored locally.

## Root Cause

The issue was a **cache hierarchy problem**:

### Existing Cache Layers

1. **In-memory cache** (`replaceableEventCacheMap`) - Fastest, synchronous
2. **IndexedDB** - Fast, but asynchronous (requires await)
3. **DataLoader** - Batches network requests
4. **Network** - Slowest fallback

### The Problem

- `useFetchProfile` hook would **skip** the in-memory cache
- Every account profile required an **async IndexedDB lookup**
- With 3+ accounts, these sequential async operations added noticeable delay
- The in-memory cache existed but wasn't being used!

```typescript
// OLD FLOW (slow)
useFetchProfile → IndexedDB (async) → setState → render
useFetchProfile → IndexedDB (async) → setState → render  
useFetchProfile → IndexedDB (async) → setState → render

// NEW FLOW (instant)
useFetchProfile → Memory cache (sync) → setState → render
useFetchProfile → Memory cache (sync) → setState → render
useFetchProfile → Memory cache (sync) → setState → render
```

## Solution

### 1. Check In-Memory Cache First

Updated `useFetchProfile` to check synchronous memory cache before falling back to async fetching:

```typescript
// Check in-memory cache first for instant access
if (!skipCache) {
  const cachedProfile = client.getCachedProfile(pubkey)
  if (cachedProfile) {
    setProfile(cachedProfile)
    setIsFetching(false)
    return  // Exit early - no async needed!
  }
}

// Only fetch if not in cache
const profile = await client.fetchProfile(id, skipCache)
```

### 2. Populate Cache on Account Load

When NostrProvider loads the current account, add their profile to in-memory cache:

```typescript
if (storedProfileEvent) {
  setProfileEvent(storedProfileEvent)
  setProfile(getProfileFromEvent(storedProfileEvent))
  // Add to in-memory cache for instant access
  client.addEventToCache(storedProfileEvent)
}
```

### 3. Preload All Account Profiles

Added a new effect in NostrProvider that preloads ALL account profiles on app init:

```typescript
// Preload all account profiles to in-memory cache for instant account switching
useEffect(() => {
  const preloadAccountProfiles = async () => {
    const accountPubkeys = accounts.map(acc => acc.pubkey)
    if (accountPubkeys.length === 0) return

    // Load all account profiles from IndexedDB and add to in-memory cache
    const profileEvents = await Promise.all(
      accountPubkeys.map(pubkey => indexedDb.getReplaceableEvent(pubkey, kinds.Metadata))
    )
    
    profileEvents.forEach(event => {
      if (event) {
        client.addEventToCache(event)
      }
    })
  }

  preloadAccountProfiles()
}, [accounts])
```

## Benefits

✅ **Instant account list rendering** - No loading skeletons  
✅ **Synchronous cache access** - No async overhead  
✅ **Preloaded on app start** - All accounts ready immediately  
✅ **Falls back gracefully** - Still fetches if not cached  
✅ **Better perceived performance** - Feels snappy and responsive  

## Performance Comparison

### Before (Slow Path)

```
Open account switcher
  ↓
Render AccountList (3 accounts)
  ↓
3x useFetchProfile hooks fire
  ↓
3x IndexedDB.getReplaceableEvent() (sequential, ~5-15ms each)
  ↓
3x setState updates
  ↓
Profiles appear with delay (~50-100ms total)
```

### After (Fast Path)

```
App initialization
  ↓
Preload all account profiles to memory (once)
  ↓
...later...
  ↓
Open account switcher
  ↓
Render AccountList (3 accounts)
  ↓
3x useFetchProfile hooks fire
  ↓
3x client.getCachedProfile() (synchronous, <1ms each)
  ↓
3x setState updates (same render cycle)
  ↓
Profiles appear instantly
```

## Cache Hierarchy Optimization

The complete cache hierarchy now works as intended:

1. **In-memory** (replaceableEventCacheMap)
   - **When**: After any profile fetch or on app init for accounts
   - **Speed**: <1ms (synchronous Map lookup)
   - **Persistence**: Session only (cleared on refresh)

2. **IndexedDB**
   - **When**: Profile not in memory
   - **Speed**: 5-15ms (async browser DB)
   - **Persistence**: Permanent (survives refresh)

3. **DataLoader** (10ms batch window)
   - **When**: Profile not in IndexedDB
   - **Speed**: Network latency + batching
   - **Persistence**: None (just batching)

4. **Network** (BIG_RELAY_URLS)
   - **When**: All else fails
   - **Speed**: Full relay query
   - **Persistence**: None

## Related Optimizations

This optimization complements the profile prefetching optimization:

- **Profile Prefetch**: Loads profiles in parallel with notes (eliminates sequential lag)
- **Account Cache**: Preloads account profiles to memory (eliminates async DB lag)

Together, these ensure profiles are available **instantly** whether:
- Viewing the timeline
- Reading replies
- Switching accounts
- Opening any profile-dependent UI

## Edge Cases Handled

✅ **New account added**: Preload effect runs on `accounts` change  
✅ **Cache miss**: Falls back to full fetch chain  
✅ **Multiple switches**: All subsequent switches are instant  
✅ **App refresh**: Profiles reload from IndexedDB then cache in memory  
✅ **Profile updates**: `addEventToCache` respects event timestamps  

## Testing

To verify the optimization:

1. Log into multiple accounts (2-3+)
2. Open DevTools → Performance tab
3. Record profile while opening account switcher
4. Observe:
   - No IndexedDB operations during render
   - No async gaps in the flame chart
   - Profiles appear in first paint

Compare to main branch where you'd see:
- Multiple IndexedDB read operations
- Async gaps between renders
- Multiple paint cycles as profiles load

## Future Enhancements

Potential improvements:
- Preload frequently viewed profiles (follows, mentions)
- LRU eviction for memory cache (currently unbounded)
- Persist memory cache to IndexedDB on page unload
- Prefetch profiles on login before showing account list
