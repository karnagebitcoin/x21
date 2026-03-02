import { DEFAULT_MENU_ITEMS, TMenuItemConfig } from '@/constants/menu-items'

export function mergeMenuItemsWithDefaults(
  storedMenuItems: TMenuItemConfig[]
): TMenuItemConfig[] {
  const storedIds = storedMenuItems.map((item) => item.id)
  const missingItems = DEFAULT_MENU_ITEMS.filter((defaultItem) => !storedIds.includes(defaultItem.id))

  if (missingItems.length === 0) {
    return storedMenuItems
  }

  const maxOrder = Math.max(...storedMenuItems.map((item) => item.order), -1)
  return [
    ...storedMenuItems,
    ...missingItems.map((item, index) => ({
      ...item,
      order: maxOrder + index + 1
    }))
  ]
}

export function getDefaultMenuItems(): TMenuItemConfig[] {
  return DEFAULT_MENU_ITEMS
}
