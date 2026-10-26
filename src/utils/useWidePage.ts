import { useLayoutEffect } from 'react'

// Widens the page to 80% of the viewport by modifying app-main
export function useWidePage() {
  useLayoutEffect(() => {
    const appMain = document.querySelector('.app-main')
    if (appMain) {
      appMain.classList.add('app-main-80')
    }
    return () => {
      if (appMain) {
        appMain.classList.remove('app-main-80')
      }
    }
  }, [])
}
