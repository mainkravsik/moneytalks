import { useEffect } from 'react'
import { useBudgetStore } from '../store/budget'
import SafeToSpendBadge from '../components/SafeToSpendBadge'
import CategoryCard from '../components/CategoryCard'

export default function Dashboard() {
  const { data, loading, error, fetch } = useBudgetStore()

  useEffect(() => { fetch() }, [fetch])

  if (loading) return <div style={{ padding: 16, textAlign: 'center', paddingTop: 40 }}>Загрузка...</div>
  if (error) return <div style={{ padding: 16, color: '#F44336' }}>{error}</div>
  if (!data) return <div style={{ padding: 16 }}>Нет данных</div>

  const top3 = data.categories.slice(0, 3)

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SafeToSpendBadge amount={data.safe_to_spend} total={data.total_limit} />
      <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Топ по расходам
      </div>
      {top3.map(cat => <CategoryCard key={cat.category.id} data={cat} />)}
      {top3.length === 0 && (
        <div style={{ opacity: 0.5, textAlign: 'center', marginTop: 20, fontSize: 14 }}>
          Добавь траты через бот или вкладку «Бюджет»
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <div style={{ flex: 1, background: 'rgba(128,128,128,0.1)', borderRadius: 8, padding: 12, textAlign: 'center', fontSize: 12 }}>
          <div>🐷 Копилки</div>
          <div style={{ fontWeight: 'bold', marginTop: 4 }}>—</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(128,128,128,0.1)', borderRadius: 8, padding: 12, textAlign: 'center', fontSize: 12 }}>
          <div>💳 Долг</div>
          <div style={{ fontWeight: 'bold', marginTop: 4 }}>—</div>
        </div>
      </div>
    </div>
  )
}
