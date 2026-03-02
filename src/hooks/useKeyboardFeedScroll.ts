import { useEffect, useRef } from 'react'

const ARROW_SCROLL_STEP = 96

function isEditableElement(element: Element | null): boolean {
  if (!element) return false
  return !!element.closest(
    'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="listbox"], [role="menu"], [role="slider"], .ProseMirror'
  )
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight
}

function isScrollable(element: HTMLElement): boolean {
  if (!isVisible(element)) return false
  if (element.scrollHeight <= element.clientHeight + 1) return false

  // Radix scroll viewport does not always expose standard overflow values.
  if (element.hasAttribute('data-radix-scroll-area-viewport')) return true

  const { overflowY } = window.getComputedStyle(element)
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
}

function findScrollableAncestor(start: Element | null): HTMLElement | null {
  let current: Element | null = start

  while (current) {
    if (current instanceof HTMLElement && isScrollable(current)) {
      return current
    }
    current = current.parentElement
  }

  return null
}

function getScrollableFallback(): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('[data-radix-scroll-area-viewport]')
  ).filter(isScrollable)

  if (candidates.length === 0) {
    const rootScroller = document.scrollingElement
    return rootScroller instanceof HTMLElement && isScrollable(rootScroller) ? rootScroller : null
  }

  return candidates.sort((a, b) => {
    const aRect = a.getBoundingClientRect()
    const bRect = b.getBoundingClientRect()
    const aArea = aRect.width * aRect.height
    const bArea = bRect.width * bRect.height
    return bArea - aArea
  })[0]
}

export function useKeyboardFeedScroll() {
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const updatePointer = (event: MouseEvent | PointerEvent) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY }
    }

    window.addEventListener('mousemove', updatePointer, { passive: true })
    window.addEventListener('pointermove', updatePointer, { passive: true })

    return () => {
      window.removeEventListener('mousemove', updatePointer)
      window.removeEventListener('pointermove', updatePointer)
    }
  }, [])

  useEffect(() => {
    const handleArrowScroll = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      if (event.altKey || event.ctrlKey || event.metaKey) return

      const activeElement = document.activeElement
      const eventTarget = event.target instanceof Element ? event.target : null
      if (isEditableElement(activeElement) || isEditableElement(eventTarget)) return

      const pointer = lastPointerRef.current
      const elementUnderPointer = pointer
        ? document.elementFromPoint(pointer.x, pointer.y)
        : null

      const target =
        findScrollableAncestor(elementUnderPointer) ??
        findScrollableAncestor(eventTarget) ??
        getScrollableFallback()

      if (!target) return

      const direction = event.key === 'ArrowDown' ? 1 : -1
      target.scrollBy({
        top: direction * ARROW_SCROLL_STEP,
        behavior: 'smooth'
      })
      event.preventDefault()
    }

    window.addEventListener('keydown', handleArrowScroll)
    return () => {
      window.removeEventListener('keydown', handleArrowScroll)
    }
  }, [])
}
