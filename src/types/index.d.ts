import { Event, Filter, VerifiedEvent } from 'nostr-tools'
import { DISTRACTION_FREE_MODE, MEDIA_AUTO_LOAD_POLICY, NOTIFICATION_LIST_STYLE, POLL_TYPE } from '../constants'

export type TSubRequestFilter = Omit<Filter, 'since' | 'until'> & { limit: number }

export type TFeedSubRequest = {
  urls: string[]
  filter: Omit<Filter, 'since' | 'until'>
}

/**
 * @deprecated Legacy gallery image format stored in kind 0 metadata.
 * Use TGalleryImageEvent for new NIP-94 based galleries.
 */
export type TGalleryImage = {
  url: string
  description?: string
  link?: string
}

/** Kind 1063 (NIP-94) gallery image event representation */
export type TGalleryImageEvent = {
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

/** Kind 30001 gallery list */
export type TGalleryList = {
  id: string
  pubkey: string
  created_at: number
  dTag: string
  title?: string
  imageEventIds: string[]
}

export type TProfile = {
  username: string
  pubkey: string
  npub: string
  original_username?: string
  banner?: string
  avatar?: string
  nip05?: string
  about?: string
  website?: string
  lud06?: string
  lud16?: string
  lightningAddress?: string
  created_at?: number
  gallery?: TGalleryImage[]
  joined_through?: string
  joined_at?: number
}
export type TMailboxRelayScope = 'read' | 'write' | 'both'
export type TMailboxRelay = {
  url: string
  scope: TMailboxRelayScope
}
export type TRelayList = {
  write: string[]
  read: string[]
  originalRelays: TMailboxRelay[]
}

export type TRelayInfo = {
  url: string
  shortUrl: string
  name?: string
  description?: string
  icon?: string
  pubkey?: string
  contact?: string
  supported_nips?: number[]
  software?: string
  version?: string
  tags?: string[]
  payments_url?: string
  limitation?: {
    auth_required?: boolean
    payment_required?: boolean
  }
}

export type TWebMetadata = {
  title?: string | null
  description?: string | null
  image?: string | null
}

export type TRelaySet = {
  id: string
  aTag: string[]
  name: string
  relayUrls: string[]
}

export type TConfig = {
  relayGroups: TRelaySet[]
  theme: TThemeSetting
}

export type TThemeSetting = 'light' | 'dark' | 'system'
export type TTheme = 'light' | 'dark'

export type TPageTheme = 'default' | 'pure-black' | 'white'

export type TColorPalette = 'default' | 'slate' | 'gray' | 'zinc' | 'neutral' | 'stone'

export type TPrimaryColor = 'RED' | 'ORANGE' | 'AMBER' | 'YELLOW' | 'LIME' | 'GREEN' | 'EMERALD' | 'TEAL' | 'CYAN' | 'SKY' | 'BLUE' | 'INDIGO' | 'VIOLET' | 'PURPLE' | 'FUCHSIA' | 'PINK' | 'ROSE'

export type TFontFamily = 'DEFAULT' | 'SYSTEM' | 'IBM_PLEX_SANS' | 'LATO' | 'OUTFIT' | 'ROBOTO' | 'GEIST_MONO'

export type TPostButtonStyle = 'filled' | 'outlined'

export type TLogoStyle = 'image' | 'text'

export type TLayoutMode = 'boxed' | 'full-width' | 'island'

export type TDeckViewMode = 'standard' | 'multi-column'

export type TMediaStyle = 'default' | 'full-width'

export type TPinnedColumnType = 'explore' | 'notifications' | 'profile' | 'search' | 'relay' | 'relays' | 'custom' | 'bookmarks' | 'highlights' | 'reads' | 'lists' | 'list' | 'livestreams'

export type TPinnedColumn = {
  id: string
  type: TPinnedColumnType
  props?: any
}

export type TDraftEvent = Pick<Event, 'content' | 'created_at' | 'kind' | 'tags'>

export type TNip07 = {
  getPublicKey: () => Promise<string>
  signEvent: (draftEvent: TDraftEvent) => Promise<VerifiedEvent>
  nip04?: {
    encrypt?: (pubkey: string, plainText: string) => Promise<string>
    decrypt?: (pubkey: string, cipherText: string) => Promise<string>
  }
  nip44?: {
    encrypt?: (pubkey: string, plainText: string) => Promise<string>
    decrypt?: (pubkey: string, cipherText: string) => Promise<string>
  }
}

export interface ISigner {
  getPublicKey: () => Promise<string>
  signEvent: (draftEvent: TDraftEvent) => Promise<VerifiedEvent>
  nip04Encrypt: (pubkey: string, plainText: string) => Promise<string>
  nip04Decrypt: (pubkey: string, cipherText: string) => Promise<string>
  nip44Encrypt: (pubkey: string, plainText: string) => Promise<string>
  nip44Decrypt: (pubkey: string, cipherText: string) => Promise<string>
}

export type TSignerType = 'nsec' | 'nip-07' | 'bunker' | 'browser-nsec' | 'ncryptsec' | 'npub'

export type TAccount = {
  pubkey: string
  signerType: TSignerType
  ncryptsec?: string
  nsec?: string
  bunker?: string
  bunkerClientSecretKey?: string
  npub?: string
}

export type TAccountPointer = Pick<TAccount, 'pubkey' | 'signerType'>

export type TFeedType = 'following' | 'relays' | 'relay' | 'bookmarks' | 'highlights' | 'custom' | 'one-per-person'
export type TFeedInfo = { feedType: TFeedType; id?: string }

export type TCustomFeed = {
  id: string
  name: string
  searchParams: TSearchParams
}

export type TLanguage = 'en' | 'zh' | 'pl'

export type TImetaInfo = {
  url: string
  alt?: string
  blurHash?: string
  dim?: { width: number; height: number }
  pubkey?: string
}

export type TPublishOptions = {
  specifiedRelayUrls?: string[]
  additionalRelayUrls?: string[]
  minPow?: number
}

export type TNoteListMode = 'posts' | 'postsAndReplies' | 'you' | 'reads' | 'highlights' | 'media'

export type TNotificationType = 'all' | 'mentions' | 'reactions' | 'zaps'

export type TPageRef = { scrollToTop: (behavior?: ScrollBehavior) => void }

export type TEmoji = {
  shortcode: string
  url: string
}

export type TTranslationAccount = {
  pubkey: string
  api_key: string
  balance: number
  purchased_credits?: number
  spent_credits?: number
  cached_characters?: number
  total_sats_paid?: number
}

export type TTranslationServiceConfig =
  | {
      service: 'jumble'
      auto_translate?: boolean
    }
  | {
      service: 'libre_translate'
      server?: string
      api_key?: string
      auto_translate?: boolean
    }
  | {
      service: 'openrouter'
      api_key?: string
      model?: string
      auto_translate?: boolean
    }

export type TMediaUploadServiceConfig =
  | {
      type: 'nip96'
      service: string
    }
  | {
      type: 'blossom'
    }

export type TPollType = (typeof POLL_TYPE)[keyof typeof POLL_TYPE]

export type TPollCreateData = {
  isMultipleChoice: boolean
  options: string[]
  relays: string[]
  endsAt?: number
}

export type TSearchType = 'profile' | 'profiles' | 'notes' | 'note' | 'hashtag' | 'relay'

export type TSearchParams = {
  type: TSearchType
  search: string
  input?: string
}

export type TNotificationStyle =
  (typeof NOTIFICATION_LIST_STYLE)[keyof typeof NOTIFICATION_LIST_STYLE]

export type TAwesomeRelayCollection = {
  id: string
  name: string
  description: string
  relays: string[]
}

export type TMediaAutoLoadPolicy =
  (typeof MEDIA_AUTO_LOAD_POLICY)[keyof typeof MEDIA_AUTO_LOAD_POLICY]

export type TDistractionFreeMode =
  (typeof DISTRACTION_FREE_MODE)[keyof typeof DISTRACTION_FREE_MODE]

export type TAIProvider = 'openrouter' | 'ppq'

export type TAIServiceConfig = {
  provider: TAIProvider
  apiKey?: string
  model?: string
  imageModel?: string
  webSearchModel?: string
}

export type TAIToolsConfig = {
  enableSummary: boolean
}

export type TArticleSummary = {
  title: string
  keyTakeaways: string[]
  summary: string
}

export type TAIMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type TAIPromptWidget = {
  id: string
  eventId: string
  messages: TAIMessage[]
}
