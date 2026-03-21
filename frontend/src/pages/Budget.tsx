import { useEffect, useState } from 'react'
import { useBudgetStore } from '../store/budget'
import { updateLimits, createCategory, deleteCategory, CategoryBudget } from '../api/budget'
import CategoryCard from '../components/CategoryCard'
import AddTransactionModal from '../components/AddTransactionModal'

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
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent', color: 'inherit', fontSize: 14 }}>
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 12, borderRadius: 8, border: 'none', background: '#4CAF50', color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
            {saving ? '...' : 'Сохранить'}
          </button>
        </div>
        <button onClick={handleDelete} disabled={deleting} style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: 'rgba(244,67,54,0.15)', color: '#F44336', fontSize: 14 }}>
          {deleting ? '...' : '🗑 Удалить категорию'}
        </button>
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
      <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', width: '100%', borderRadius: '16px 16px 0 0', padding: 20 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 12 }}>Новая категория</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={emoji}
            onChange={e => setEmoji(e.target.value)}
            style={{ width: 56, padding: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', fontSize: 22, textAlign: 'center', background: 'transparent', color: 'inherit' }}
          />
          <input
            type="text"
            placeholder="Название"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', fontSize: 16, background: 'transparent', color: 'inherit' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent', color: 'inherit', fontSize: 14 }}>
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 12, borderRadius: 8, border: 'none', background: '#2196F3', color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
            {saving ? '...' : 'Создать'}
          </button>
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

  if (loading) return <div style={{ padding: 16, textAlign: 'center', paddingTop: 40 }}>Загрузка...</div>
  if (error) return <div style={{ padding: 16, color: '#F44336' }}>{error}</div>
  if (!data) return <div style={{ padding: 16 }}>Нет данных</div>

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, opacity: 0.6 }}>{data.start_date} – {data.end_date}</span>
        <button
          onClick={() => setSelectedCatId(0)}
          style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#4CAF50', color: '#fff', fontSize: 13, fontWeight: 'bold' }}
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
      <div style={{ fontSize: 11, opacity: 0.4, marginBottom: 12 }}>Долгое нажатие — изменить лимит / удалить</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.categories.map(cat => (
          <div key={cat.category.id} onContextMenu={e => { e.preventDefault(); setEditingCat(cat) }}>
            <CategoryCard
              data={cat}
              onClick={() => setSelectedCatId(cat.category.id)}
              onLongPress={() => setEditingCat(cat)}
            />
          </div>
        ))}
        {data.categories.length === 0 && (
          <div style={{ opacity: 0.5, textAlign: 'center', marginTop: 40, fontSize: 14 }}>
            Категорий нет. Добавь первую!
          </div>
        )}
      </div>

      <button
        onClick={() => setShowAddCat(true)}
        style={{ width: '100%', marginTop: 16, padding: 12, borderRadius: 10, border: '1px dashed rgba(128,128,128,0.4)', background: 'transparent', color: 'inherit', fontSize: 14, opacity: 0.7 }}
      >
        + Добавить категорию
      </button>

      {selectedCatId !== null && (
        <AddTransactionModal
          categories={data.categories}
          initialCategoryId={selectedCatId || undefined}
          onClose={() => setSelectedCatId(null)}
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
      {showAddCat && (
        <AddCategoryModal
          onClose={() => setShowAddCat(false)}
          onSave={() => fetch()}
        />
      )}
    </div>
  )
}
