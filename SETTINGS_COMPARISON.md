# x21-dan Settings & Options Inventory

## Current Settings Structure

### Main Settings Categories
1. **General**
2. **Content & Privacy**
3. **Appearance**
4. **Widgets**
5. **Relays**
6. **Backup & Sync**
7. **AI Tools** (logged-in users only)
8. **Translation** (logged-in users only)
9. **Wallet** (logged-in users only)
10. **Post Settings** (logged-in users only)

---

## Detailed Settings Breakdown

### 1. General Settings
**Interface Tab:**
- ✅ Enable Payments (toggle)
- ✅ Language Selection (multi-language support)
- ✅ Right-to-left layout (for RTL languages)
- ✅ Text Only Mode (strip media)
- ✅ Slow Connection Mode (minimal relays, hide reactions/zaps)
- ✅ Distraction-Free Mode (Drain my time / Focus mode)

**Display Tab:**
- ✅ Hide reads in profiles

### 2. Content & Privacy Settings
**Content Tab:**
- ✅ Web of Trust system (4-level slider: Everyone → Network + Follows → Follows Only → You Only)
- ✅ Filter notifications by trust level
- ✅ Hide content mentioning muted users
- ✅ Always hide muted notes
- ✅ Hide notifications from muted users
- ✅ Spam Filters:
  - Hide hashtag spam (0-10+ slider)
  - Hide mention spam (0-10+ slider)
- ✅ Media Auto-load Policy:
  - Everyone
  - People in Web of Trust
  - People I follow
  - Wi-Fi only (if supported)
  - No one (click to load)
- ✅ Autoplay videos
- ✅ Show NSFW content by default

**Words Tab:**
- ✅ Muted Words list management (add/remove)

**Threads Tab:**
- ✅ Muted Threads list management (add/remove by event ID)

**Domains Tab:**
- ✅ Muted Domains (NIP-05 domain blocking)

### 3. Appearance Settings
**Theme Tab:**
- ✅ Theme Selection (System, Light, Dark, White, Pure Black)
- ✅ Color Palette (6 options: default, slate, gray, zinc, neutral, stone)
- ✅ Primary Color (8+ color options with names)

**Navigation Tab:**
- ✅ Menu Items Settings (customize navigation)

**Layout Tab:**
- ✅ Logo Style:
  - Image Logo
  - Text Logo (with custom text input)
- ✅ Layout Mode:
  - Boxed
  - Full Width
  - Island
- ✅ Multi-Column Deck View (Standard / Multi-Column)
- ✅ Notification List Style (Compact / Detailed)
- ✅ Media Style (Default / Full Width)
- ✅ Sidebar Style (Compact / With Labels)

**Typography Tab:**
- ✅ Font Family (multiple options: System, Inter, Roboto, etc.)
- ✅ Font Size (slider with px values)
- ✅ Title Font Size (slider)
- ✅ Logo Font Size (slider, when using text logo)

**Styling Tab:**
- ✅ Button Radius (slider: Square to Fully Rounded)
- ✅ Post Button Style (Filled / Outlined)
- ✅ Feed/Card Radius (slider)
- ✅ Media Radius (slider)

### 4. Widgets Settings
- ✅ Widget configuration and management

### 5. Relay Settings
- ✅ Relay management
- ✅ Favorite relays
- ✅ Relay health monitoring

### 6. Backup & Sync Settings
- ✅ NIP-78 preferences sync
- ✅ Backup/restore functionality

### 7. AI Tools (Logged-in only)
- ✅ AI-powered features

### 8. Translation (Logged-in only)
- ✅ Translation service configuration:
  - LibreTranslate
  - OpenRouter
  - Jumble Translate

### 9. Wallet (Logged-in only)
**Wallet Connection:**
- ✅ Bitcoin Connect integration
- ✅ Wallet info display (alias, balance)
- ✅ Disconnect wallet option

**Zap Settings:**
- ✅ Lightning Address input
- ✅ Default Zap Amount
- ✅ Default Zap Comment
- ✅ Quick Zap (toggle)
- ✅ Zap on Reactions (toggle)
- ✅ Only Zaps Mode (toggle)
- ✅ Charge Zap (toggle)
- ✅ Charge Zap Limit
- ✅ Zap Sound Selection

### 10. Post Settings (Logged-in only)
- ✅ Collapse Long Notes (toggle)
- ✅ Always Show Full Media (toggle)
- ✅ Default Reaction Emojis
- ✅ Custom Emojis
- ✅ Note Expiration settings
- ✅ Media Upload Service (Blossom servers)

### Other Settings/Features
- ✅ Copy Private Key (nsec)
- ✅ Copy Private Key (ncryptsec)
- ✅ About (version info)

---

## Potential Missing Features (To Verify with x21.social)

### Common Nostr Client Features to Check:
1. **Notification Settings**
   - Push notification preferences
   - Sound alerts for notifications
   - Notification grouping options

2. **Privacy Settings**
   - Private/Public DM settings
   - Metadata privacy options
   - Profile visibility controls

3. **Performance Settings**
   - Cache management
   - Data usage limits
   - Image quality preferences

4. **Search Settings**
   - Search history toggle
   - Default search scope
   - Search relay preferences

5. **Feed Settings**
   - Default feed on startup
   - Feed refresh intervals
   - Algorithm preferences

6. **Content Display**
   - Link preview settings
   - YouTube embed preferences
   - Twitter/X link handling

7. **Developer Options**
   - Debug mode
   - Event inspector
   - Relay connection debugging

8. **Account Management**
   - Multiple account switching (we have this - AccountManager)
   - Account deletion
   - Data export options

9. **Accessibility**
   - High contrast mode
   - Reduced motion
   - Screen reader optimizations

10. **Advanced Features**
    - Custom CSS support
    - Keyboard shortcuts configuration
    - Experimental features toggle

---

## Notes for Comparison

**To properly compare with x21.social, we need to:**

1. Visit https://x21.social and navigate through all settings
2. Document each setting, toggle, and option available
3. Compare feature-by-feature with our implementation
4. Identify gaps or differences in implementation
5. Note any unique features in either version

**Our Strengths:**
- Comprehensive appearance customization (themes, colors, typography, spacing)
- Advanced Web of Trust system
- Detailed spam filtering
- Multiple layout modes (Boxed, Full Width, Island)
- Extensive media loading policies
- Widget system
- AI integration
- Multi-language support

**Areas to Investigate:**
- Whether x21.social has notification management we're missing
- Developer/debug options
- Performance tuning options
- Any unique features specific to the official x21.social

---

## Next Steps

1. **Manual Comparison Required**: Visit x21.social and systematically go through every settings page
2. **Create Side-by-Side List**: Document what they have that we don't
3. **Prioritize Missing Features**: Determine which missing features are important
4. **Implementation Plan**: Create tasks for implementing any critical missing features
