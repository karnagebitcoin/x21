import { match } from 'path-to-regexp'
import { lazy, Suspense, isValidElement, ComponentType, forwardRef } from 'react'
import { Skeleton } from './components/ui/skeleton'

// Lazy load all route components for code splitting
const AIToolsPage = lazy(() => import('./pages/secondary/AIToolsPage'))
const AppearanceSettingsPage = lazy(() => import('./pages/secondary/AppearanceSettingsPage'))
const ArticlePage = lazy(() => import('./pages/secondary/ArticlePage'))
const BackupSettingsPage = lazy(() => import('./pages/secondary/BackupSettingsPage'))
const ContentPrivacySettingsPage = lazy(() => import('./pages/secondary/ContentPrivacySettingsPage'))
const FollowingListPage = lazy(() => import('./pages/secondary/FollowingListPage'))
const GeneralSettingsPage = lazy(() => import('./pages/secondary/GeneralSettingsPage'))
const KeysSettingsPage = lazy(() => import('./pages/secondary/KeysSettingsPage'))
const MuteListPage = lazy(() => import('./pages/secondary/MuteListPage'))
const NoteListPage = lazy(() => import('./pages/secondary/NoteListPage'))
const NotePage = lazy(() => import('./pages/secondary/NotePage'))
const OthersRelaySettingsPage = lazy(() => import('./pages/secondary/OthersRelaySettingsPage'))
const PostSettingsPage = lazy(() => import('./pages/secondary/PostSettingsPage'))
const ProfileEditorPage = lazy(() => import('./pages/secondary/ProfileEditorPage'))
const ProfileListPage = lazy(() => import('./pages/secondary/ProfileListPage'))
const ProfilePage = lazy(() => import('./pages/secondary/ProfilePage'))
const RelayPage = lazy(() => import('./pages/secondary/RelayPage'))
const RelayReviewsPage = lazy(() => import('./pages/secondary/RelayReviewsPage'))
const RelaySettingsPage = lazy(() => import('./pages/secondary/RelaySettingsPage'))
const RizfulPage = lazy(() => import('./pages/secondary/RizfulPage'))
const SearchPage = lazy(() => import('./pages/secondary/SearchPage'))
const SettingsPage = lazy(() => import('./pages/secondary/SettingsPage'))
const TranslationPage = lazy(() => import('./pages/secondary/TranslationPage'))
const VanityAddressPage = lazy(() => import('./pages/secondary/VanityAddressPage'))
const WalletPage = lazy(() => import('./pages/secondary/WalletPage'))
const WidgetsSettingsPage = lazy(() => import('./pages/secondary/WidgetsSettingsPage'))
const ListsIndexPage = lazy(() => import('./pages/secondary/ListsIndexPage'))
const ListPage = lazy(() => import('./pages/secondary/ListPage'))
const ListEditorPage = lazy(() => import('./pages/secondary/ListEditorPage'))
const LiveStreamPage = lazy(() => import('./pages/secondary/LiveStreamPage'))

// Loading fallback component
function PageLoadingFallback() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

// Wrapper to add Suspense to lazy components
function withSuspense<P extends object>(
  LazyComponent: ComponentType<P>,
  displayName?: string
) {
  const AnyLazyComponent = LazyComponent as ComponentType<any>
  const WrappedComponent = forwardRef<any, P>((props, ref) => (
    <Suspense fallback={<PageLoadingFallback />}>
      <AnyLazyComponent {...props} ref={ref} />
    </Suspense>
  ))
  WrappedComponent.displayName = displayName || 'LazyComponent'
  return WrappedComponent
}

// Create suspended versions of all components
const SuspendedAIToolsPage = withSuspense(AIToolsPage, 'AIToolsPage')
const SuspendedAppearanceSettingsPage = withSuspense(AppearanceSettingsPage, 'AppearanceSettingsPage')
const SuspendedArticlePage = withSuspense(ArticlePage, 'ArticlePage')
const SuspendedBackupSettingsPage = withSuspense(BackupSettingsPage, 'BackupSettingsPage')
const SuspendedContentPrivacySettingsPage = withSuspense(ContentPrivacySettingsPage, 'ContentPrivacySettingsPage')
const SuspendedFollowingListPage = withSuspense(FollowingListPage, 'FollowingListPage')
const SuspendedGeneralSettingsPage = withSuspense(GeneralSettingsPage, 'GeneralSettingsPage')
const SuspendedKeysSettingsPage = withSuspense(KeysSettingsPage, 'KeysSettingsPage')
const SuspendedMuteListPage = withSuspense(MuteListPage, 'MuteListPage')
const SuspendedNoteListPage = withSuspense(NoteListPage, 'NoteListPage')
const SuspendedNotePage = withSuspense(NotePage, 'NotePage')
const SuspendedOthersRelaySettingsPage = withSuspense(OthersRelaySettingsPage, 'OthersRelaySettingsPage')
const SuspendedPostSettingsPage = withSuspense(PostSettingsPage, 'PostSettingsPage')
const SuspendedProfileEditorPage = withSuspense(ProfileEditorPage, 'ProfileEditorPage')
const SuspendedProfileListPage = withSuspense(ProfileListPage, 'ProfileListPage')
const SuspendedProfilePage = withSuspense(ProfilePage, 'ProfilePage')
const SuspendedRelayPage = withSuspense(RelayPage, 'RelayPage')
const SuspendedRelayReviewsPage = withSuspense(RelayReviewsPage, 'RelayReviewsPage')
const SuspendedRelaySettingsPage = withSuspense(RelaySettingsPage, 'RelaySettingsPage')
const SuspendedRizfulPage = withSuspense(RizfulPage, 'RizfulPage')
const SuspendedSearchPage = withSuspense(SearchPage, 'SearchPage')
const SuspendedSettingsPage = withSuspense(SettingsPage, 'SettingsPage')
const SuspendedTranslationPage = withSuspense(TranslationPage, 'TranslationPage')
const SuspendedVanityAddressPage = withSuspense(VanityAddressPage, 'VanityAddressPage')
const SuspendedWalletPage = withSuspense(WalletPage, 'WalletPage')
const SuspendedWidgetsSettingsPage = withSuspense(WidgetsSettingsPage, 'WidgetsSettingsPage')
const SuspendedListsIndexPage = withSuspense(ListsIndexPage, 'ListsIndexPage')
const SuspendedListPage = withSuspense(ListPage, 'ListPage')
const SuspendedListEditorPage = withSuspense(ListEditorPage, 'ListEditorPage')
const SuspendedLiveStreamPage = withSuspense(LiveStreamPage, 'LiveStreamPage')

const ROUTES = [
  { path: '/notes', element: <SuspendedNoteListPage /> },
  { path: '/notes/:id', element: <SuspendedNotePage /> },
  { path: '/articles/:id', element: <SuspendedArticlePage /> },
  { path: '/users', element: <SuspendedProfileListPage /> },
  { path: '/users/:id', element: <SuspendedProfilePage /> },
  { path: '/users/:id/following', element: <SuspendedFollowingListPage /> },
  { path: '/users/:id/relays', element: <SuspendedOthersRelaySettingsPage /> },
  { path: '/relays/:url', element: <SuspendedRelayPage /> },
  { path: '/relays/:url/reviews', element: <SuspendedRelayReviewsPage /> },
  { path: '/search', element: <SuspendedSearchPage /> },
  { path: '/settings', element: <SuspendedSettingsPage /> },
  { path: '/settings/relays', element: <SuspendedRelaySettingsPage /> },
  { path: '/settings/wallet', element: <SuspendedWalletPage /> },
  { path: '/settings/posts', element: <SuspendedPostSettingsPage /> },
  { path: '/settings/general', element: <SuspendedGeneralSettingsPage /> },
  { path: '/settings/keys', element: <SuspendedKeysSettingsPage /> },
  { path: '/settings/content-privacy', element: <SuspendedContentPrivacySettingsPage /> },
  { path: '/settings/appearance', element: <SuspendedAppearanceSettingsPage /> },
  { path: '/settings/widgets', element: <SuspendedWidgetsSettingsPage /> },
  { path: '/settings/translation', element: <SuspendedTranslationPage /> },
  { path: '/settings/vanity-address', element: <SuspendedVanityAddressPage /> },
  { path: '/settings/ai-tools', element: <SuspendedAIToolsPage /> },
  { path: '/settings/backup', element: <SuspendedBackupSettingsPage /> },
  { path: '/profile-editor', element: <SuspendedProfileEditorPage /> },
  { path: '/mutes', element: <SuspendedMuteListPage /> },
  { path: '/rizful', element: <SuspendedRizfulPage /> },
  { path: '/lists', element: <SuspendedListsIndexPage /> },
  { path: '/lists/create', element: <SuspendedListEditorPage /> },
  { path: '/lists/:id', element: <SuspendedListPage listId="" /> },
  { path: '/lists/:id/edit', element: <SuspendedListEditorPage listId="" /> },
  { path: '/live/:naddr', element: <SuspendedLiveStreamPage naddr="" /> }
]

export const routes = ROUTES.map(({ path, element }) => ({
  path,
  element: isValidElement(element) ? element : null,
  matcher: match(path)
}))
