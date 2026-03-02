# i18n Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate i18n translations into all React components so the UI displays in the user's selected language

**Architecture:** Update remaining components (~74 files) to use the `useTranslation` hook from react-i18next, replacing hardcoded English strings with `t('key')` calls. Translation keys already exist and match the English UI Labels markdown.

**Tech Stack:** React, TypeScript, react-i18next

**Status:** 228/302 components already implemented, ~74 remaining

---

## Phase 1: Sidebar Navigation Components

All sidebar buttons should display translated text for navigation items.

### Task 1: Update HomeButton

**Files:**
- Modify: `src/components/Sidebar/HomeButton.tsx`

**Step 1: Add useTranslation import**

```typescript
import { usePrimaryPage } from '@/PageManager'
import { Home } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import SidebarItem from './SidebarItem'
```

**Step 2: Use translation hook**

```typescript
export default function HomeButton() {
  const { t } = useTranslation()
  const { navigate, current } = usePrimaryPage()

  return (
    <SidebarItem title={t('Home')} onClick={() => navigate('home')} active={current === 'home'}>
      <Home strokeWidth={1.3} />
    </SidebarItem>
  )
}
```

**Step 3: Test in browser**
- Switch language in settings
- Verify "Home" translates correctly

**Step 4: Commit**
```bash
git add src/components/Sidebar/HomeButton.tsx
git commit -m "feat(i18n): add translation to HomeButton"
```

### Task 2: Update ProfileButton

**Files:**
- Modify: `src/components/Sidebar/ProfileButton.tsx`

**Step 1: Check current implementation**

View file to see if it needs updating.

**Step 2: Add useTranslation if missing**

Same pattern as HomeButton - import `useTranslation`, call `t('Profile')`

**Step 3: Commit**
```bash
git add src/components/Sidebar/ProfileButton.tsx
git commit -m "feat(i18n): add translation to ProfileButton"
```

### Task 3: Update SettingsButton

**Files:**
- Modify: `src/components/Sidebar/SettingsButton.tsx`

**Step 1: Apply translation pattern**

```typescript
import { useTranslation } from 'react-i18next'

export default function SettingsButton() {
  const { t } = useTranslation()
  // ... rest of component
  return <SidebarItem title={t('Settings')} ... />
}
```

**Step 2: Commit**
```bash
git add src/components/Sidebar/SettingsButton.tsx
git commit -m "feat(i18n): add translation to SettingsButton"
```

### Task 4: Update SearchButton

**Files:**
- Modify: `src/components/Sidebar/SearchButton.tsx`

**Step 1: Apply translation**

Use `t('Search')` for title

**Step 2: Commit**
```bash
git add src/components/Sidebar/SearchButton.tsx
git commit -m "feat(i18n): add translation to SearchButton"
```

### Task 5: Update NotificationButton

**Files:**
- Modify: `src/components/Sidebar/NotificationButton.tsx`

**Step 1: Apply translation**

Use `t('Notifications')` for title

**Step 2: Commit**
```bash
git add src/components/Sidebar/NotificationButton.tsx
git commit -m "feat(i18n): add translation to NotificationButton"
```

### Task 6: Update ListsButton

**Files:**
- Modify: `src/components/Sidebar/ListsButton.tsx`

**Step 1: Apply translation**

Use `t('Lists')` for title

**Step 2: Commit**
```bash
git add src/components/Sidebar/ListsButton.tsx
git commit -m "feat(i18n): add translation to ListsButton"
```

### Task 7: Update ReadsButton

**Files:**
- Modify: `src/components/Sidebar/ReadsButton.tsx`

**Step 1: Apply translation**

Use `t('Reads')` for title

**Step 2: Commit**
```bash
git add src/components/Sidebar/ReadsButton.tsx
git commit -m "feat(i18n): add translation to ReadsButton"
```

### Task 8: Update PostButton

**Files:**
- Modify: `src/components/Sidebar/PostButton.tsx`

**Step 1: Check implementation**

View file and apply translations to any visible text

**Step 2: Commit**
```bash
git add src/components/Sidebar/PostButton.tsx
git commit -m "feat(i18n): add translation to PostButton"
```

### Task 9: Verify All Sidebar Buttons

**Step 1: Test language switching**
- Open app in browser
- Navigate to Settings > Languages
- Switch between English, German, French
- Verify all sidebar labels update correctly

**Step 2: Commit batch update**
```bash
git add src/components/Sidebar/
git commit -m "feat(i18n): complete sidebar navigation translations"
```

---

## Phase 2: Identify Remaining Components

### Task 10: Generate List of Missing Components

**Step 1: Create script to find untranslated components**

```bash
# Find all .tsx files without useTranslation
cd /projects/x21
grep -r "useTranslation" src --include="*.tsx" -l | sort > /tmp/with-i18n.txt
find src -name "*.tsx" | sort > /tmp/all-components.txt
diff /tmp/all-components.txt /tmp/with-i18n.txt | grep "^<" | cut -d' ' -f2 > /tmp/missing-i18n.txt
cat /tmp/missing-i18n.txt
```

**Step 2: Prioritize by usage**

Review list and identify high-priority user-facing components vs. utility components that may not need translation

**Step 3: Document findings**

Create a file listing components needing translation:
```bash
cat /tmp/missing-i18n.txt > docs/i18n-remaining-components.md
git add docs/i18n-remaining-components.md
git commit -m "docs: list components needing i18n integration"
```

---

## Phase 3: High-Priority Component Updates

Components users interact with most frequently should be translated first.

### Task 11: Update NoteCard Components

**Files:**
- Modify: `src/components/NoteCard/MainNoteCard.tsx` (if missing)
- Modify: `src/components/Note/index.tsx` (if missing)

**Step 1: Review component for hardcoded strings**

Look for:
- Button labels
- Timestamp text ("just now", "X minutes ago" - already using `t('n minutes ago')`)
- Action labels

**Step 2: Replace hardcoded strings**

Pattern:
```typescript
// Before
<button>Like</button>

// After
const { t } = useTranslation()
<button>{t('Like')}</button>
```

**Step 3: Commit**
```bash
git add src/components/NoteCard/ src/components/Note/
git commit -m "feat(i18n): add translations to note display components"
```

### Task 12: Update Profile Components

**Files:**
- Review: `src/components/Profile/`
- Review: `src/components/ProfileCard/`

**Step 1: Check which files need updates**

Many profile components likely already have translations. Identify gaps.

**Step 2: Update missing translations**

Common strings to translate:
- "Follow" / "Unfollow"
- "Mute" / "Unmute"  
- "followers" / "following"
- "Edit Profile"

**Step 3: Commit**
```bash
git add src/components/Profile*
git commit -m "feat(i18n): complete profile component translations"
```

### Task 13: Update Settings Pages

**Files:**
- Review: `src/pages/*/Settings*.tsx`

**Step 1: Review settings pages**

Check for untranslated:
- Section headers
- Option labels
- Help text
- Button labels

**Step 2: Apply translations**

**Step 3: Commit**
```bash
git add src/pages/
git commit -m "feat(i18n): add translations to settings pages"
```

---

## Phase 4: Forms and Dialogs

### Task 14: Update Dialog Components

**Files:**
- Review: `src/components/*Dialog/`

**Step 1: Check all dialog components**

Dialogs typically have:
- Titles
- Body text
- Button labels ("Cancel", "Confirm", "Save", etc.)

**Step 2: Update with translations**

**Step 3: Commit**
```bash
git add src/components/*Dialog/
git commit -m "feat(i18n): add translations to dialog components"
```

### Task 15: Update Form Components

**Files:**
- Review: `src/components/PostEditor/`
- Review: Form-related components

**Step 1: Translate form elements**

- Placeholder text
- Labels
- Validation messages
- Submit button text

**Step 2: Commit**
```bash
git add src/components/PostEditor/ src/components/*Form*/
git commit -m "feat(i18n): add translations to form components"
```

---

## Phase 5: Low-Priority and Utility Components

### Task 16: Review Utility Components

**Step 1: Identify utility components**

Components like:
- Error boundaries
- Loading states
- Empty states

**Step 2: Determine which need translation**

Some utility components may only use icons or have no user-visible text

**Step 3: Update as needed**

**Step 4: Commit**
```bash
git add src/components/
git commit -m "feat(i18n): complete utility component translations"
```

---

## Phase 6: Testing and Validation

### Task 17: Comprehensive Language Testing

**Step 1: Test each supported language**

Languages to test (from `src/i18n/locales/`):
- English (en)
- Arabic (ar)
- German (de)
- Spanish (es)
- Persian (fa)
- French (fr)
- Hindi (hi)
- Italian (it)
- Japanese (ja)
- Korean (ko)
- Polish (pl)
- Portuguese Brazil (pt-BR)
- Portuguese Portugal (pt-PT)
- Russian (ru)
- Thai (th)
- Chinese (zh)

**Step 2: Verify RTL languages**

Arabic and Persian should display right-to-left:
- Menu items align right
- Text flows right to left
- Icons positioned correctly

**Step 3: Check for missing translations**

Look for:
- English text appearing in other languages
- Translation keys displayed (e.g., "{{'key'}}")
- Console errors about missing keys

**Step 4: Document issues**

Create issue list:
```bash
cat > docs/i18n-issues.md << 'EOF'
# i18n Issues Found During Testing

## Missing Translations
- [Component]: [Missing key]

## RTL Layout Issues
- [Component]: [Description]

## Other Issues
- [Description]
EOF

git add docs/i18n-issues.md
git commit -m "docs: document i18n testing results"
```

### Task 18: Fix Missing Translation Keys

**Step 1: Review missing keys**

If any English labels don't have translation keys, they need to be added to all locale files

**Step 2: Add missing keys to locale files**

Add to `src/i18n/locales/en.ts` and all other language files

**Step 3: Commit**
```bash
git add src/i18n/locales/
git commit -m "feat(i18n): add missing translation keys"
```

### Task 19: Final Verification

**Step 1: Build project**

```bash
npm run build
```

**Step 2: Run type checking**

```bash
npm run lint
```

**Step 3: Test in production build**

```bash
npm run preview
```

**Step 4: Final commit**

```bash
git add .
git commit -m "feat(i18n): complete i18n integration across all components"
```

---

## Success Criteria

- ✅ All user-facing text uses `t()` function
- ✅ No hardcoded English strings in UI components
- ✅ Language switcher works for all 16 languages
- ✅ RTL languages (Arabic, Persian) display correctly
- ✅ No console errors about missing translation keys
- ✅ Build passes without errors
- ✅ Type checking passes

---

## Notes

- **Translation keys** are already defined in `src/i18n/locales/*.ts`
- **Reference document**: `English UI Labels.md` maps all keys
- **Existing pattern**: Many components already use `useTranslation` - follow their pattern
- **RTL support**: Already configured in `src/i18n/index.ts` with `RTL_LANGUAGES` array
- **Don't translate**:
  - Variable names
  - Code/technical terms
  - URLs
  - Nostr event kinds
  - Relay addresses

