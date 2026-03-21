import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Budget from './pages/Budget'
import Piggy from './pages/Piggy'
import Loans from './pages/Loans'
import History from './pages/History'

type Tab = 'dashboard' | 'budget' | 'piggy' | 'loans' | 'history'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Главная', icon: '🏠' },
  { id: 'budget', label: 'Бюджет', icon: '📊' },
  { id: 'piggy', label: 'Копилки', icon: '🐷' },
  { id: 'loans', label: 'Кредиты', icon: '💳' },
  { id: 'history', label: 'История', icon: '📋' },
]

const TAB_HEIGHT = 60

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: TAB_HEIGHT }}>
        {renderPage()}
      </div>
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: TAB_HEIGHT,
        display: 'flex',
        background: 'var(--tg-theme-bg-color, #1c1c1e)',
        borderTop: '1px solid rgba(128,128,128,0.2)',
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
                color: active ? '#4CAF50' : 'var(--tg-theme-hint-color, #8e8e93)',
                cursor: 'pointer', padding: '6px 2px 4px', gap: 2,
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
