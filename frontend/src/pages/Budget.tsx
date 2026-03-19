import { useEffect, useState } from 'react'
import { useBudgetStore } from '../store/budget'
import CategoryCard from '../components/CategoryCard'
import AddTransactionModal from '../components/AddTransactionModal'

export default function Budget() {
  const { data, loading, error, fetch } = useBudgetStore()
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { fetch() }, [fetch])

  if (loading) return <div style={{ padding: 16, textAlign: 'center', paddingTop: 40 }}>Загрузка...</div>
  if (error) return <div style={{ padding: 16, color: '#F44336' }}>{error}</div>
  if (!data) return <div style={{ padding: 16 }}>Нет данных</div>

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, opacity: 0.6 }}>
          {data.start_date} – {data.end_date}
        </span>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '7px 14px', borderRadius: 8, border: 'none',
            background: '#4CAF50', color: '#fff', fontSize: 13, fontWeight: 'bold',
          }}
        >
          + Трата
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13 }}>
        <span>Бюджет: ₽{Math.round(data.total_limit).toLocaleString('ru')}</span>
        <span style={{ color: data.total_spent > data.total_limit ? '#F44336' : '#4CAF50' }}>
          Потрачено: ₽{Math.round(data.total_spent).toLocaleString('ru')}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.categories.map(cat => (
          <CategoryCard
            key={cat.category.id}
            data={cat}
            onClick={() => setShowModal(true)}
          />
        ))}
        {data.categories.length === 0 && (
          <div style={{ opacity: 0.5, textAlign: 'center', marginTop: 40, fontSize: 14 }}>
            Категории не настроены.<br />Настрой лимиты через мини-апп.
          </div>
        )}
      </div>
      {showModal && (
        <AddTransactionModal
          categories={data.categories}
          onClose={() => setShowModal(false)}
          onSuccess={() => fetch()}
        />
      )}
    </div>
  )
}
