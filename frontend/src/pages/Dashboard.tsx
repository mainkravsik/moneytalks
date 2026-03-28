import { useEffect, useState } from 'react'
import { useBudgetStore } from '../store/budget'
import CategoryCard from '../components/CategoryCard'
import { fetchPiggies } from '../api/piggy'
import { fetchLoans } from '../api/loans'

const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

export default function Dashboard() {
  const { data, loading, error, fetch } = useBudgetStore()
  const [piggyTotal, setPiggyTotal] = useState(0)
  const [loanTotal, setLoanTotal] = useState(0)

  useEffect(() => { fetch() }, [fetch])
  useEffect(() => {
    fetchPiggies().then(pigs => setPiggyTotal(pigs.reduce((s, p) => s + Number(p.current_amount), 0)))
    fetchLoans().then(loans => setLoanTotal(loans.reduce((s, l) => s + Number(l.remaining_amount), 0)))
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tg-theme-hint-color, #8e8e93)' }}>Загрузка...</div>
  if (error) return <div style={{ padding: 16, color: '#F44336' }}>{error}</div>
  if (!data) return <div style={{ padding: 16, color: 'var(--tg-theme-hint-color)' }}>Нет данных</div>

  const safeAmount = data.safe_to_spend
  const total = data.total_limit
  const pct = total > 0 ? safeAmount / total : 0
  const safeColor = pct > 0.3 ? '#4CAF50' : pct > 0.1 ? '#FF9800' : '#F44336'
  const top3 = data.categories.slice(0, 3)

  return (
    <div style={{ paddingBottom: 8 }}>
      {/* Safe to Spend Hero */}
      <div style={{
        background: 'var(--tg-theme-bg-color, #1c1c1e)',
        padding: '24px 16px 20px',
        textAlign: 'center',
        marginBottom: 8,
      }}>
        <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #8e8e93)', marginBottom: 4 }}>
          Можно потратить
        </div>
        <div style={{ fontSize: 38, fontWeight: 700, color: safeColor, letterSpacing: -1 }}>
          {safeAmount >= 0 ? '' : '−'} ₽{fmt(Math.abs(safeAmount))}
        </div>
        <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #8e8e93)', marginTop: 2 }}>
          из ₽{fmt(total)} бюджета
        </div>
      </div>

      {/* Top Categories */}
      {top3.length > 0 && (
        <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', padding: '12px 16px 16px', marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #8e8e93)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Топ по расходам
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {top3.map(cat => <CategoryCard key={cat.category.id} data={cat} />)}
          </div>
        </div>
      )}

      {top3.length === 0 && (
        <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', padding: '32px 16px', marginBottom: 8, textAlign: 'center', color: 'var(--tg-theme-hint-color, #8e8e93)' }}>
          Добавь траты через бот или «Бюджет»
        </div>
      )}

      {/* Summary Widgets */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px' }}>
        <div style={{
          flex: 1, background: 'var(--tg-theme-bg-color, #1c1c1e)',
          borderRadius: 12, padding: '16px 12px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>🐷</div>
          <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #8e8e93)', marginBottom: 2 }}>Копилки</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>₽{fmt(piggyTotal)}</div>
        </div>
        <div style={{
          flex: 1, background: 'var(--tg-theme-bg-color, #1c1c1e)',
          borderRadius: 12, padding: '16px 12px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>💳</div>
          <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #8e8e93)', marginBottom: 2 }}>Долг</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: loanTotal > 0 ? '#F44336' : '#4CAF50' }}>
            ₽{fmt(loanTotal)}
          </div>
        </div>
      </div>
    </div>
  )
}
