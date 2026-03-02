# Live Streams Feature Implementation

## Overview
Implemented NIP-53 (Live Activities) support for x21, allowing users to discover and participate in live streaming events with real-time chat.

## Features Implemented

### 1. Navigation Integration
- Added "Live Streams" menu item to sidebar navigation
- **Disabled by default** - can be enabled in Settings > Appearance > Navigation
- Uses Radio icon from lucide-react
- Appears in customizable navigation menu with drag-and-drop reordering

### 2. Live Streams Page (Primary)
**Location:** `/src/pages/primary/LiveStreamsPage/`

- Displays list of active live events (kind:30311)
- Shows only events with `status: 'live'`
- Sorts by current participants (descending), then by created_at (descending)
- Subscribes to live events from big relays
- Auto-refreshes when new events arrive
- Empty state when no live streams available

### 3. Live Event List Component
**Location:** `/src/components/LiveEventList/`

Features:
- Real-time subscription to kind:30311 events
- Filters for 'live' status only
- Handles addressable events (using 'd' tag)
- Shows loading skeletons
- Refresh functionality

### 4. Live Event Card Component
**Location:** `/src/components/LiveEventCard/`

Displays:
- Live badge with pulsing animation
- Event thumbnail image
- Host avatar and username
- Event title and summary
- Current participants count
- Start time
- Hashtags
- Hover effects and click to view details

### 5. Live Stream Detail Page (Secondary)
**Location:** `/src/pages/secondary/LiveStreamPage/`

**Route:** `/live/:naddr`

Features:
- Decodes naddr (NIP-19) to fetch live event
- Displays stream info and metadata
- Video player for streaming URL (if available)
- **Live Chat** (kind:1311):
  - Real-time chat messages
  - Send messages (requires login)
  - Auto-scroll to latest messages
  - User avatars and timestamps
  - Message actions (zap, react)
- **Zaps Display**:
  - Horizontal scrollable list of recent zaps
  - Shows zapper avatar and amount
  - Parsed from kind:9735 events
  - Displays top 20 most recent zaps
- **Stream Actions**:
  - Zap the stream
  - Chat participation

### 6. Live Chat Messages (kind:1311)
- Subscribe to chat messages using 'a' tag reference
- Display sender avatar, username, timestamp
- Support for zapping individual messages
- Support for reacting to messages
- Real-time updates as messages arrive

### 7. Zaps Integration
- Subscribe to kind:9735 zap receipts
- Parse zap amount from bolt11 invoice
- Display zapper profile and amount
- Show zaps for both:
  - The live stream event itself
  - Individual chat messages

## NIP-53 Implementation Details

### Supported Kinds
- **30311**: Live Event (addressable event)
- **1311**: Live Chat Message
- **9735**: Zap Receipt (for displaying zaps)

### Event Tags Supported

**Live Event (30311):**
- `d`: Unique identifier
- `title`: Event name
- `summary`: Description
- `image`: Preview image
- `streaming`: Stream URL (for video/audio)
- `status`: Event status (live, planned, ended)
- `current_participants`: Number of viewers
- `starts`: Start timestamp
- `t`: Hashtags
- `relays`: Preferred relays

**Live Chat (1311):**
- `a`: Reference to parent live event
- `e`: Reply to another message (optional)
- Content: Chat message text

## Migration Support
- Added migration logic in `local-storage.service.ts`
- Automatically merges new `livestreams` menu item for existing users
- Preserves user's custom menu configuration

## Styling & UX
- Follows x21 design aesthetic
- Red "LIVE" badge with pulsing animation
- Card-based layout with hover effects
- Responsive design
- Scrollable zap list with profile images
- Auto-scrolling chat
- Smooth transitions and animations

## Translation Support
Added English translations for:
- Live Streams
- Active live events
- No live streams at the moment
- Check back later for live events
- Untitled Live Stream
- LIVE
- watching
- Started
- Live Stream
- Live stream not found
- Zap Stream
- Recent Zaps
- Live Chat
- No messages yet. Be the first to chat!
- Type a message...

## Configuration
The feature is **disabled by default** and can be enabled by:
1. Going to Settings
2. Appearance
3. Navigation section
4. Toggle "Live Streams" to show it in the sidebar

## Technical Notes
- Uses client.service for Nostr subscriptions
- Supports addressable events (NIP-33)
- Handles NIP-19 naddr encoding/decoding
- Real-time WebSocket subscriptions
- Optimistic UI updates
- Proper cleanup of subscriptions on unmount

## Future Enhancements
Potential improvements:
- Support for kind:30312 (Meeting Spaces)
- Support for kind:30313 (Meeting Room Events)
- Reactions on chat messages (kind:7)
- Participant list display
- Stream recording playback
- Better video player integration
- Emoji reactions in chat
- Pinned messages support
- Moderator features
- Stream notifications
