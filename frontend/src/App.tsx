import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Budget from './pages/Budget'
import Piggy from './pages/Piggy'
import Loans from './pages/Loans'
import History from './pages/History'

type Tab = 'dashboard' | 'budget' | 'piggy' | 'loans' | 'history'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Главная', icon: '🏠' },
  { id: 'budget', label: 'Бюджет', icon: '🏦' },
  { id: 'piggy', label: 'Копилки', icon: '🐷' },
  { id: 'loans', label: 'Кредиты', icon: '💳' },
  { id: 'history', label: 'История', icon: '📋' },
]

const TAB_HEIGHT = 56

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />
      case 'budget': return <Budget />
      case 'piggy': return <Piggy />
      case 'loans': return <Loans />
      case 'history': return <History />
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: 'var(--tg-theme-secondary-bg-color, #0f0f0f)',
      color: 'var(--tg-theme-text-color, #fff)',
    }}>
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: TAB_HEIGHT }}>
        {renderPage()}
      </div>
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: TAB_HEIGHT,
        display: 'flex',
        background: 'var(--tg-theme-bg-color, #1c1c1e)',
        borderTop: '0.5px solid rgba(128,128,128,0.15)',
        zIndex: 50,
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                border: 'none', background: 'transparent',
                color: active
                  ? 'var(--tg-theme-button-color, #60a8eb)'
                  : 'var(--tg-theme-hint-color, #8e8e93)',
                cursor: 'pointer', padding: '4px 2px 2px', gap: 1,
                transition: 'color 0.15s',
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
