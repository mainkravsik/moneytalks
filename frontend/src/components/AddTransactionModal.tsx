import { useState } from 'react'
import { CategoryBudget, addTransaction } from '../api/budget'

interface Props {
  categories: CategoryBudget[]
  onClose: () => void
  onSuccess: () => void
  initialCategoryId?: number
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  border: '1px solid rgba(128,128,128,0.2)',
  background: 'var(--tg-theme-secondary-bg-color, #2c2c2e)',
  color: 'var(--tg-theme-text-color, #fff)',
  fontSize: 15, boxSizing: 'border-box', marginBottom: 10,
}

export default function AddTransactionModal({ categories, onClose, onSuccess, initialCategoryId }: Props) {
  const [categoryId, setCategoryId] = useState<number | null>(initialCategoryId ?? null)
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!categoryId || !amount) { setError('Выбери категорию и введи сумму'); return }
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) { setError('Введи корректную сумму'); return }
    setLoading(true); setError('')
    try {
      await addTransaction({ category_id: categoryId, amount: parsed, comment: comment.trim() || undefined })
      onSuccess(); onClose()
    } catch { setError('Ошибка при сохранении') } finally { setLoading(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--tg-theme-bg-color, #1c1c1e)',
        borderRadius: '14px 14px 0 0',
        padding: '20px 16px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        zIndex: 100,
      }}>
        <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 16 }}>Добавить трату</div>
        <select style={inputStyle} value={categoryId ?? ''} onChange={e => setCategoryId(Number(e.target.value))}>
          <option value="">— Выбери категорию —</option>
          {categories.map(c => (
            <option key={c.category.id} value={c.category.id}>
              {c.category.emoji} {c.category.name}
            </option>
          ))}
        </select>
        <input type="number" placeholder="Сумма, ₽" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} />
        <input type="text" placeholder="Комментарий (необязательно)" value={comment} onChange={e => setComment(e.target.value)} style={inputStyle} />
        {error && <div style={{ color: '#F44336', fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 14, borderRadius: 12,
            border: '1px solid rgba(128,128,128,0.2)',
            background: 'transparent', color: 'var(--tg-theme-text-color, #fff)', fontSize: 15,
          }}>Отмена</button>
          <button onClick={handleSubmit} disabled={loading} style={{
            flex: 2, padding: 14, borderRadius: 12, border: 'none',
            background: 'var(--tg-theme-button-color, #60a8eb)',
            color: 'var(--tg-theme-button-text-color, #fff)', fontWeight: 600, fontSize: 15,
          }}>{loading ? '...' : 'Записать'}</button>
        </div>
      </div>
    </>
  )
}
