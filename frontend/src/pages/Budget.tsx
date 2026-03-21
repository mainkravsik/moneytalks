import { useEffect, useState } from 'react'
import { useBudgetStore } from '../store/budget'
import { updateLimits, CategoryBudget } from '../api/budget'
import CategoryCard from '../components/CategoryCard'
import AddTransactionModal from '../components/AddTransactionModal'

function EditLimitModal({ cat, onClose, onSave }: { cat: CategoryBudget; onClose: () => void; onSave: () => void }) {
  const [value, setValue] = useState(String(Math.round(cat.limit)))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const num = parseFloat(value)
    if (!num || num <= 0) return
    setSaving(true)
    await updateLimits([{ category_id: cat.category.id, limit_amount: num }])
    onSave()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
      <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', width: '100%', borderRadius: '16px 16px 0 0', padding: 20 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 12 }}>
          {cat.category.emoji} {cat.category.name} — лимит
        </div>
        <input
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          autoFocus
          style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', fontSize: 16, marginBottom: 12, boxSizing: 'border-box', background: 'transparent', color: 'inherit' }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent', color: 'inherit', fontSize: 14 }}>
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', background: '#4CAF50', color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
            {saving ? '...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Budget() {
  const { data, loading, error, fetch } = useBudgetStore()
  const [showModal, setShowModal] = useState(false)
  const [editingCat, setEditingCat] = useState<CategoryBudget | null>(null)

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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
        <span>Бюджет: ₽{Math.round(data.total_limit).toLocaleString('ru')}</span>
        <span style={{ color: data.total_spent > data.total_limit ? '#F44336' : '#4CAF50' }}>
          Потрачено: ₽{Math.round(data.total_spent).toLocaleString('ru')}
        </span>
      </div>
      <div style={{ fontSize: 11, opacity: 0.4, marginBottom: 12 }}>Долгое нажатие на карточку — изменить лимит</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.categories.map(cat => (
          <div key={cat.category.id} onContextMenu={e => { e.preventDefault(); setEditingCat(cat) }}>
            <CategoryCard
              data={cat}
              onClick={() => setShowModal(true)}
              onLongPress={() => setEditingCat(cat)}
            />
          </div>
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
      {editingCat && (
        <EditLimitModal
          cat={editingCat}
          onClose={() => setEditingCat(null)}
          onSave={() => fetch()}
        />
      )}
    </div>
  )
}
