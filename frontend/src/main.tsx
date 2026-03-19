import React from 'react'
import ReactDOM from 'react-dom/client'
import { init, miniApp, viewport } from '@telegram-apps/sdk'
import { AppRoot } from '@telegram-apps/telegram-ui'
import '@telegram-apps/telegram-ui/dist/styles.css'
import App from './App'

// Initialize Telegram Mini App SDK
try {
  init()
  miniApp.mount()
  viewport.mount()
} catch {
  // Running outside Telegram (dev mode)
  console.warn('Running outside Telegram environment')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRoot>
      <App />
    </AppRoot>
  </React.StrictMode>
)
