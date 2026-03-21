import { useState } from 'react'
import { CategoryBudget, addTransaction } from '../api/budget'

interface Props {
  categories: CategoryBudget[]
  onClose: () => void
  onSuccess: () => void
  initialCategoryId?: number
}

export default function AddTransactionModal({ categories, onClose, onSuccess, initialCategoryId }: Props) {
  const [categoryId, setCategoryId] = useState<number | null>(initialCategoryId ?? null)
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!categoryId || !amount) {
      setError('Выбери категорию и введи сумму')
      return
    }
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) {
      setError('Введи корректную сумму')
      return
    }
    setLoading(true)
    setError('')
    try {
      await addTransaction({
        category_id: categoryId,
        amount: parsed,
        comment: comment.trim() || undefined,
      })
      onSuccess()
      onClose()
    } catch {
      setError('Ошибка при сохранении. Попробуй ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 10,
    marginBottom: 12,
    borderRadius: 8,
    border: '1px solid rgba(128,128,128,0.3)',
    boxSizing: 'border-box',
    fontSize: 16,
    background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
    color: 'var(--tg-theme-text-color, #000)',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99 }}
      />
      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--tg-theme-bg-color, #fff)',
        borderRadius: '16px 16px 0 0',
        padding: 20, zIndex: 100,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 17 }}>Добавить трату</h3>
        <select
          style={inputStyle}
          value={categoryId ?? ''}
          onChange={e => setCategoryId(Number(e.target.value))}
        >
          <option value="">— Выбери категорию —</option>
          {categories.map(c => (
            <option key={c.category.id} value={c.category.id}>
              {c.category.emoji} {c.category.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Сумма, ₽"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="Комментарий (необязательно)"
          value={comment}
          onChange={e => setComment(e.target.value)}
          style={inputStyle}
        />
        {error && (
          <div style={{ color: '#F44336', fontSize: 13, marginBottom: 8 }}>{error}</div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent', fontSize: 15 }}
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ flex: 2, padding: 12, borderRadius: 8, border: 'none', background: '#4CAF50', color: '#fff', fontWeight: 'bold', fontSize: 15 }}
          >
            {loading ? '...' : 'Записать'}
          </button>
        </div>
      </div>
    </>
  )
}
