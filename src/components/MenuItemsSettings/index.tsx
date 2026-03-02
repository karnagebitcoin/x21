import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useMenuItems, TMenuItem, TMenuItemConfig } from '@/providers/MenuItemsProvider'
import { cn } from '@/lib/utils'
import { GripVertical, Home, BookOpen, List as ListIcon, Compass, Bell, Search, PencilLine, Columns, Radio } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

const MENU_ITEM_ICONS: Record<TMenuItem, any> = {
  home: Home,
  reads: BookOpen,
  lists: ListIcon,
  explore: Compass,
  notifications: Bell,
  search: Search,
  livestreams: Radio,
  post: PencilLine,
  deck: Columns
}

const getMenuItemLabel = (t: any, item: TMenuItem): string => {
  const labels: Record<TMenuItem, string> = {
    home: t('Home'),
    reads: t('Reads'),
    lists: t('Lists'),
    explore: t('Explore'),
    notifications: t('Notifications'),
    search: t('Search'),
    livestreams: t('Live Streams'),
    post: t('Post'),
    deck: t('Multi-Column')
  }
  return labels[item]
}

export default function MenuItemsSettings() {
  const { t } = useTranslation()
  const { menuItems, updateMenuItem, reorderMenuItems, resetToDefaults } = useMenuItems()
  const [draggedItem, setDraggedItem] = useState<TMenuItem | null>(null)
  const [dragOverItem, setDragOverItem] = useState<TMenuItem | null>(null)

  // Get reorderable items sorted by order
  const reorderableItems = menuItems
    .filter(item => item.canReorder)
    .sort((a, b) => a.order - b.order)

  // Get non-reorderable items (like deck toggle)
  const nonReorderableItems = menuItems.filter(item => !item.canReorder)

  const handleDragStart = (e: React.DragEvent, itemId: TMenuItem) => {
    setDraggedItem(itemId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, itemId: TMenuItem) => {
    e.preventDefault()
    setDragOverItem(itemId)
  }

  const handleDragLeave = () => {
    setDragOverItem(null)
  }

  const handleDrop = (e: React.DragEvent, targetItemId: TMenuItem) => {
    e.preventDefault()

    if (!draggedItem || draggedItem === targetItemId) {
      setDraggedItem(null)
      setDragOverItem(null)
      return
    }

    const draggedIndex = reorderableItems.findIndex(item => item.id === draggedItem)
    const targetIndex = reorderableItems.findIndex(item => item.id === targetItemId)

    const newOrder = [...reorderableItems]
    const [removed] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, removed)

    // Update the order of all items
    reorderMenuItems(newOrder.map(item => item.id))

    setDraggedItem(null)
    setDragOverItem(null)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDragOverItem(null)
  }

  const handleToggleVisibility = (itemId: TMenuItem, visible: boolean) => {
    updateMenuItem(itemId, { visible })
  }

  return (
    <div className="space-y-4 px-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-normal">
            {t('Navigation Menu Items')}
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            {t('Drag to reorder, toggle to show/hide menu items')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={resetToDefaults}
        >
          {t('Reset to Default')}
        </Button>
      </div>

      <div className="space-y-2">
        {reorderableItems.map((item) => {
          const Icon = MENU_ITEM_ICONS[item.id]
          const isDragging = draggedItem === item.id
          const isDragOver = dragOverItem === item.id

          return (
            <div
              key={item.id}
              draggable={item.canReorder}
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDragOver={(e) => handleDragOver(e, item.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, item.id)}
              onDragEnd={handleDragEnd}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border-2 transition-all',
                isDragging && 'opacity-50 border-primary',
                isDragOver && !isDragging && 'border-primary bg-primary/5',
                !isDragging && !isDragOver && 'border-border hover:border-muted-foreground/30',
                item.canReorder && 'cursor-move',
                !item.visible && 'opacity-60'
              )}
            >
              {item.canReorder && (
                <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium truncate">{getMenuItemLabel(t, item.id)}</span>
              </div>
              {item.canToggle ? (
                <Switch
                  checked={item.visible}
                  onCheckedChange={(checked) => handleToggleVisibility(item.id, checked)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="text-xs text-muted-foreground">
                  {t('Always visible')}
                </div>
              )}
            </div>
          )
        })}

        {/* Non-reorderable items (like Deck toggle) */}
        {nonReorderableItems.map((item) => {
          const Icon = MENU_ITEM_ICONS[item.id]

          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border-2 border-border',
                !item.visible && 'opacity-60'
              )}
            >
              <div className="w-5 h-5 flex-shrink-0" /> {/* Spacer for alignment */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium truncate">{getMenuItemLabel(t, item.id)}</span>
              </div>
              {item.canToggle ? (
                <Switch
                  checked={item.visible}
                  onCheckedChange={(checked) => handleToggleVisibility(item.id, checked)}
                />
              ) : (
                <div className="text-xs text-muted-foreground">
                  {t('Always visible')}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
