import { DEFAULT_MENU_ITEMS, TMenuItem, TMenuItemConfig } from '@/constants/menu-items'
import storage from '@/services/local-storage.service'
import { createContext, useContext, useState } from 'react'

export type { TMenuItem, TMenuItemConfig }

type TMenuItemsContext = {
  menuItems: TMenuItemConfig[]
  updateMenuItem: (id: TMenuItem, updates: Partial<TMenuItemConfig>) => void
  reorderMenuItems: (newOrder: TMenuItem[]) => void
  resetToDefaults: () => void
}

const MenuItemsContext = createContext<TMenuItemsContext | undefined>(undefined)

export const useMenuItems = () => {
  const context = useContext(MenuItemsContext)
  if (!context) {
    throw new Error('useMenuItems must be used within a MenuItemsProvider')
  }
  return context
}

export { DEFAULT_MENU_ITEMS }

export function MenuItemsProvider({ children }: { children: React.ReactNode }) {
  const [menuItems, setMenuItemsState] = useState<TMenuItemConfig[]>(() => {
    return storage.getMenuItems()
  })

  const updateMenuItem = (id: TMenuItem, updates: Partial<TMenuItemConfig>) => {
    const updatedItems = menuItems.map(item =>
      item.id === id ? { ...item, ...updates } : item
    )
    setMenuItemsState(updatedItems)
    storage.setMenuItems(updatedItems)
  }

  const reorderMenuItems = (newOrder: TMenuItem[]) => {
    const updatedItems = menuItems.map(item => {
      const newIndex = newOrder.indexOf(item.id)
      return newIndex !== -1 ? { ...item, order: newIndex } : item
    }).sort((a, b) => a.order - b.order)

    setMenuItemsState(updatedItems)
    storage.setMenuItems(updatedItems)
  }

  const resetToDefaults = () => {
    setMenuItemsState(DEFAULT_MENU_ITEMS)
    storage.setMenuItems(DEFAULT_MENU_ITEMS)
  }

  return (
    <MenuItemsContext.Provider
      value={{
        menuItems,
        updateMenuItem,
        reorderMenuItems,
        resetToDefaults
      }}
    >
      {children}
    </MenuItemsContext.Provider>
  )
}
