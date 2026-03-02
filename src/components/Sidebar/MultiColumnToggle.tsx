import { useDeckView } from '@/providers/DeckViewProvider'
import { useLayoutMode } from '@/providers/LayoutModeProvider'
import { useCompactSidebar } from '@/providers/CompactSidebarProvider'
import { DECK_VIEW_MODE, LAYOUT_MODE } from '@/constants'
import { Columns2, Columns } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import SidebarItem from './SidebarItem'

export default function MultiColumnToggle() {
  const { t } = useTranslation()
  const { deckViewMode, setDeckViewMode } = useDeckView()
  const { setLayoutMode } = useLayoutMode()
  const { setCompactSidebar } = useCompactSidebar()

  const isMultiColumn = deckViewMode === DECK_VIEW_MODE.MULTI_COLUMN

  const handleToggle = () => {
    if (isMultiColumn) {
      // Switch back to standard/boxed mode
      setDeckViewMode(DECK_VIEW_MODE.STANDARD)
      setLayoutMode(LAYOUT_MODE.BOXED)
      setCompactSidebar(false)
    } else {
      // Switch to multi-column mode
      setDeckViewMode(DECK_VIEW_MODE.MULTI_COLUMN)
      setLayoutMode(LAYOUT_MODE.FULL_WIDTH)
      setCompactSidebar(true)
    }
  }

  return (
    <SidebarItem
      title={t('Deck')}
      onClick={handleToggle}
      active={isMultiColumn}
    >
      {isMultiColumn ? <Columns strokeWidth={1.3} /> : <Columns2 strokeWidth={1.3} />}
    </SidebarItem>
  )
}
