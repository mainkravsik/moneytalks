import { useEffect, useState } from 'react'
import { useBudgetStore } from '../store/budget'
import { updateLimits, createCategory, deleteCategory, CategoryBudget } from '../api/budget'
import CategoryCard from '../components/CategoryCard'
import AddTransactionModal from '../components/AddTransactionModal'

const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  border: '1px solid rgba(128,128,128,0.2)',
  background: 'var(--tg-theme-secondary-bg-color, #2c2c2e)',
  color: 'var(--tg-theme-text-color, #fff)',
  fontSize: 15, boxSizing: 'border-box',
}

function EditLimitModal({ cat, onClose, onSave }: { cat: CategoryBudget; onClose: () => void; onSave: () => void }) {
  const [value, setValue] = useState(String(Math.round(cat.limit)))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleSave = async () => {
    const num = parseFloat(value)
    if (!num || num <= 0) return
    setSaving(true)
    await updateLimits([{ category_id: cat.category.id, limit_amount: num }])
    onSave()
    onClose()
  }

  const handleDelete = async () => {
    if (!confirm(`Удалить категорию «${cat.category.name}»?`)) return
    setDeleting(true)
    await deleteCategory(cat.category.id)
    onSave()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
      <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', width: '100%', borderRadius: '14px 14px 0 0', padding: '20px 16px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 14 }}>
          {cat.category.emoji} {cat.category.name} — лимит
        </div>
        <input
          type="number" value={value} onChange={e => setValue(e.target.value)} autoFocus
          style={{ ...inputStyle, marginBottom: 14 }}
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 14, borderRadius: 12,
            border: '1px solid rgba(128,128,128,0.2)',
            background: 'transparent', color: 'var(--tg-theme-text-color, #fff)', fontSize: 15,
          }}>Отмена</button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 2, padding: 14, borderRadius: 12, border: 'none',
            background: 'var(--tg-theme-button-color, #60a8eb)',
            color: 'var(--tg-theme-button-text-color, #fff)', fontSize: 15, fontWeight: 600,
          }}>{saving ? '...' : 'Сохранить'}</button>
        </div>
        <button onClick={handleDelete} disabled={deleting} style={{
          width: '100%', padding: 14, borderRadius: 12, border: 'none',
          background: 'rgba(244,67,54,0.1)', color: '#F44336', fontSize: 15,
        }}>{deleting ? '...' : 'Удалить категорию'}</button>
      </div>
    </div>
  )
}

function AddCategoryModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📦')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await createCategory({ name: name.trim(), emoji })
    onSave()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
      <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', width: '100%', borderRadius: '14px 14px 0 0', padding: '20px 16px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 14 }}>Новая категория</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input type="text" value={emoji} onChange={e => setEmoji(e.target.value)}
            style={{ ...inputStyle, width: 56, textAlign: 'center', fontSize: 22, padding: 12 }} />
          <input type="text" placeholder="Название" value={name} onChange={e => setName(e.target.value)}
            autoFocus style={{ ...inputStyle, flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 14, borderRadius: 12,
            border: '1px solid rgba(128,128,128,0.2)',
            background: 'transparent', color: 'var(--tg-theme-text-color, #fff)', fontSize: 15,
          }}>Отмена</button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 2, padding: 14, borderRadius: 12, border: 'none',
            background: 'var(--tg-theme-button-color, #60a8eb)',
            color: 'var(--tg-theme-button-text-color, #fff)', fontSize: 15, fontWeight: 600,
          }}>{saving ? '...' : 'Создать'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Budget() {
  const { data, loading, error, fetch } = useBudgetStore()
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null)
  const [editingCat, setEditingCat] = useState<CategoryBudget | null>(null)
  const [showAddCat, setShowAddCat] = useState(false)

  useEffect(() => { fetch() }, [fetch])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tg-theme-hint-color, #8e8e93)' }}>Загрузка...</div>
  if (error) return <div style={{ padding: 16, color: '#F44336' }}>{error}</div>
  if (!data) return <div style={{ padding: 16, color: 'var(--tg-theme-hint-color)' }}>Нет данных</div>

  return (
    <div style={{ paddingBottom: 8 }}>
      {/* Header */}
      <div style={{
        background: 'var(--tg-theme-bg-color, #1c1c1e)',
        padding: '14px 16px', marginBottom: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #8e8e93)' }}>
            {data.start_date} – {data.end_date}
          </span>
          <button onClick={() => setSelectedCatId(0)} style={{
            padding: '8px 14px', borderRadius: 10, border: 'none',
            background: 'var(--tg-theme-button-color, #60a8eb)',
            color: 'var(--tg-theme-button-text-color, #fff)',
            fontSize: 13, fontWeight: 600,
          }}>+ Трата</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
          <span>Бюджет: <b>₽{fmt(data.total_limit)}</b></span>
          <span style={{ color: data.total_spent > data.total_limit ? '#F44336' : '#4CAF50', fontWeight: 600 }}>
            Потрачено: ₽{fmt(data.total_spent)}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #8e8e93)', marginTop: 6 }}>
          Долгое нажатие — изменить лимит / удалить
        </div>
      </div>

      {/* Categories */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.categories.map(cat => (
          <div key={cat.category.id} onContextMenu={e => { e.preventDefault(); setEditingCat(cat) }}>
            <CategoryCard
              data={cat}
              onClick={() => setSelectedCatId(cat.category.id)}
              onLongPress={() => setEditingCat(cat)}
            />
          </div>
        ))}
      </div>

      {data.categories.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--tg-theme-hint-color, #8e8e93)' }}>
          Категорий нет. Добавь первую!
        </div>
      )}

      <div style={{ padding: '12px 16px 0' }}>
        <button onClick={() => setShowAddCat(true)} style={{
          width: '100%', padding: 14, borderRadius: 12,
          border: '1px dashed rgba(128,128,128,0.25)',
          background: 'transparent',
          color: 'var(--tg-theme-hint-color, #8e8e93)', fontSize: 14,
        }}>+ Добавить категорию</button>
      </div>

      {selectedCatId !== null && (
        <AddTransactionModal
          categories={data.categories}
          initialCategoryId={selectedCatId || undefined}
          onClose={() => setSelectedCatId(null)}
          onSuccess={() => fetch()}
        />
      )}
      {editingCat && <EditLimitModal cat={editingCat} onClose={() => setEditingCat(null)} onSave={() => fetch()} />}
      {showAddCat && <AddCategoryModal onClose={() => setShowAddCat(false)} onSave={() => fetch()} />}
    </div>
  )
}
