# x21.social

A customizable Nostr client focused on real-time social feeds, lists, reads, live activity, widgets, and Bitcoin-native interactions.

Live site: [https://x21.social](https://x21.social)

## What x21 Includes

- Multi-account Nostr login flows (`nsec`, `npub`, NIP-07 extension, Bunker, and Nostr Connection)
- Core social surfaces: Home, Explore, Reads, Lists, Notifications, Search, Profile
- Rich feed switching: following, bookmarks, highlights, one-note-per-person, relay sets, custom feeds
- List system: create/edit/follow/share lists, list pages, list previews, list stats, list zaps
- Long-form article support with markdown rendering and Nostr-aware links
- Live stream support (NIP-53 style flows): discovery, live detail view, chat, and zap interactions
- Wallet and zap settings with WebLN/Nostr wallet flows (default amount/comment, quick zap, charge zap, zap sounds, receiving settings)
- Translation system with multiple providers (Jumble, LibreTranslate, OpenRouter) and staggered i18n fallback
- AI tooling (provider/model configuration for OpenRouter and PPQ.ai)
- Backup and restore via local JSON export/import and Nostr sync using NIP-78
- Highly customizable UI (themes, palette, font controls, radii, media style, sidebar/menu controls, widget sidebar controls)
- Optional widgets including Trending Notes, Bitcoin Ticker, Pinned Note widgets, AI Prompt widget, and Invite widget
- Media and post tooling: image/gallery flows, GIF picker, polls, note expiration, relay targeting, upload service settings
- PWA setup via `vite-plugin-pwa` and route-level lazy loading for better performance

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS + Radix UI
- `nostr-tools` for protocol/event handling
- i18next for localization

## Local Development

### Option 1: Docker (recommended for URL preview/proxy support)

```bash
git clone git@github.com:karnagebitcoin/x21.git
cd x21
docker compose up -d
```

App: `http://localhost:8089`

### Option 2: Node only (fastest app iteration)

```bash
git clone git@github.com:karnagebitcoin/x21.git
cd x21
npm install
npm run dev
```

### Option 3: Dev stack with local relay

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts:
- x21 app (`8089`)
- proxy server (`8090`)
- local `nostr-rs-relay` (`7000`)

## Useful Scripts

```bash
npm run dev
npm run build
npm run lint
npm run format
npm run audit:maintainability
```

## Acknowledgment

x21.social is forked from Cody Tseng's Jumble project.

Huge thanks to Cody Tseng for building and open-sourcing the foundation this project is built on.

Original project: [https://github.com/CodyTseng/x21](https://github.com/CodyTseng/x21)

## Design Credit

Logo designed by [Daniel David](http://wolfertdan.com/).

## License

MIT
