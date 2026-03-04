import './i18n'
import './index.css'
import './polyfill'
import './services/lightning.service'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

const CHUNK_RELOAD_KEY = 'x21:chunk-reload-attempted'
const CHUNK_RELOAD_WINDOW_MS = 60_000

const reloadForChunkFailure = () => {
  // Avoid infinite reload loops if a hard refresh does not resolve it.
  const lastAttemptAt = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? '0')
  const now = Date.now()
  if (lastAttemptAt && now - lastAttemptAt < CHUNK_RELOAD_WINDOW_MS) return
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now))
  window.location.reload()
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadForChunkFailure()
})

window.addEventListener('unhandledrejection', (event) => {
  const message =
    event.reason instanceof Error ? event.reason.message : String(event.reason ?? '')
  if (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed')
  ) {
    reloadForChunkFailure()
  }
})

const setVh = () => {
  // Use visualViewport if available for more accurate height on mobile
  const height = window.visualViewport?.height || window.innerHeight
  document.documentElement.style.setProperty('--vh', `${height}px`)
}

// Listen to both resize and visualViewport events for better mobile support
window.addEventListener('resize', setVh)
window.addEventListener('orientationchange', setVh)
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', setVh)
  window.visualViewport.addEventListener('scroll', setVh)
}
setVh()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
