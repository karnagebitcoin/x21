import { parseEmojiPickerUnified } from '@/lib/utils'
import { useDefaultReactionEmojis } from '@/providers/DefaultReactionEmojisProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useTheme } from '@/providers/ThemeProvider'
import customEmojiService from '@/services/custom-emoji.service'
import { TEmoji } from '@/types'
import EmojiPickerReact, {
  Categories,
  EmojiStyle,
  SkinTonePickerLocation,
  SuggestionMode,
  Theme
} from 'emoji-picker-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

// Storage key used by emoji-picker-react for suggested emojis
const EMOJI_PICKER_STORAGE_KEY = 'epr_suggested'

// Convert emoji string to the format emoji-picker-react uses internally
function emojiToUnified(emoji: string): string {
  return [...emoji].map((char) => char.codePointAt(0)?.toString(16)).join('-')
}

export default function EmojiPicker({
  onEmojiClick,
  showFavorites = false
}: {
  onEmojiClick: (emoji: string | TEmoji | undefined, event: MouseEvent) => void
  showFavorites?: boolean
}) {
  const { t } = useTranslation()
  const { themeSetting } = useTheme()
  const { isSmallScreen } = useScreenSize()
  const { defaultReactionEmojis } = useDefaultReactionEmojis()

  // Inject favorites into emoji-picker-react's suggested emojis storage
  useEffect(() => {
    if (!showFavorites) return

    // Convert our favorites to the format emoji-picker-react expects
    const suggestedEmojis = defaultReactionEmojis
      .filter((emoji): emoji is string => typeof emoji === 'string')
      .map((emoji) => emojiToUnified(emoji))

    // Store in localStorage so the picker shows them as "suggested"
    localStorage.setItem(EMOJI_PICKER_STORAGE_KEY, JSON.stringify(suggestedEmojis))
  }, [showFavorites, defaultReactionEmojis])

  // Custom category labels - rename "Frequently Used" to "Favorites" when showing favorites
  const categoryTranslations = useMemo(() => {
    if (!showFavorites) return undefined
    return {
      suggested: t('Favorites')
    }
  }, [showFavorites, t])

  return (
    <EmojiPickerReact
      theme={
        themeSetting === 'system' ? Theme.AUTO : themeSetting === 'dark' ? Theme.DARK : Theme.LIGHT
      }
      width={isSmallScreen ? '100%' : 350}
      autoFocusSearch={false}
      emojiStyle={EmojiStyle.NATIVE}
      skinTonePickerLocation={SkinTonePickerLocation.PREVIEW}
      style={
        {
          '--epr-bg-color': 'hsl(var(--background))',
          '--epr-category-label-bg-color': 'hsl(var(--background))',
          '--epr-text-color': 'hsl(var(--foreground))',
          '--epr-hover-bg-color': 'hsl(var(--muted) / 0.5)',
          '--epr-picker-border-color': 'transparent'
        } as React.CSSProperties
      }
      suggestedEmojisMode={SuggestionMode.FREQUENT}
      categories={[
        { category: Categories.SUGGESTED, name: categoryTranslations?.suggested || t('Frequently Used') },
        { category: Categories.SMILEYS_PEOPLE, name: t('Smileys & People') },
        { category: Categories.ANIMALS_NATURE, name: t('Animals & Nature') },
        { category: Categories.FOOD_DRINK, name: t('Food & Drink') },
        { category: Categories.TRAVEL_PLACES, name: t('Travel & Places') },
        { category: Categories.ACTIVITIES, name: t('Activities') },
        { category: Categories.OBJECTS, name: t('Objects') },
        { category: Categories.SYMBOLS, name: t('Symbols') },
        { category: Categories.FLAGS, name: t('Flags') }
      ]}
      onEmojiClick={(data, e) => {
        const emoji = parseEmojiPickerUnified(data.unified)
        onEmojiClick(emoji, e)
      }}
      customEmojis={customEmojiService.getAllCustomEmojisForPicker()}
    />
  )
}
