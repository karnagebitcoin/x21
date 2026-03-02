import './i18n'
import './index.css'
import './polyfill'
import './services/lightning.service'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

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
