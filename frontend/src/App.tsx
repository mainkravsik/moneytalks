import React, { useState } from 'react'
import { Tabbar } from '@telegram-apps/telegram-ui'
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
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderPage()}
      </div>
      <Tabbar>
        {TABS.map(tab => (
          <Tabbar.Item
            key={tab.id}
            text={tab.label}
            selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            <span style={{ fontSize: 20 }}>{tab.icon}</span>
          </Tabbar.Item>
        ))}
      </Tabbar>
    </div>
  )
}
