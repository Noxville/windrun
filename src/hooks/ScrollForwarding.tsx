import { useEffect } from 'react'

// Forwards scroll events to any element with `data-scroll-target=true`.
export function useScrollForwarding() {
  useEffect(() => {
    const onScroll = (e: WheelEvent) => {
      const scrollableElement = document.querySelector('[data-scroll-target=true]') as HTMLElement

      // If theres no scrollable element or the event originated from within it, do nothing
      if (!scrollableElement
          || scrollableElement.contains(e.target as Node)) {
        return
      }
      
      // Check if there's room to scroll
      const { scrollTop, scrollHeight, clientHeight } = scrollableElement
      const canScrollUp = scrollTop > 0
      const canScrollDown = scrollTop < scrollHeight - clientHeight

      // Only prevent default and forward if there's room to scroll in that direction
      if ((e.deltaY < 0 && canScrollUp) || (e.deltaY > 0 && canScrollDown)) {
        e.preventDefault()
        scrollableElement.scrollTop += e.deltaY
      }
    }

    document.addEventListener('wheel', onScroll, { passive: false })
    return () => document.removeEventListener('wheel', onScroll)
  }, [])
}
