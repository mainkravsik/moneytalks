import { useEffect, useState } from 'react'
import { fetchPiggies, Piggy, createPiggy } from '../api/piggy'
import PiggyCard from '../components/PiggyCard'

export default function PiggyPage() {
  const [piggies, setPiggies] = useState<Piggy[]>([])
  const [newName, setNewName] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [adding, setAdding] = useState(false)

  const load = () => fetchPiggies().then(setPiggies)
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!newName) return
    await createPiggy({ name: newName, target_amount: newTarget ? parseFloat(newTarget) : undefined })
    setNewName(''); setNewTarget(''); setAdding(false)
    load()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: '1px solid rgba(128,128,128,0.2)',
    background: 'var(--tg-theme-secondary-bg-color, #2c2c2e)',
    color: 'var(--tg-theme-text-color, #fff)',
    fontSize: 15, boxSizing: 'border-box', marginBottom: 8,
  }

  return (
    <div style={{ paddingBottom: 8 }}>
      {/* Header */}
      <div style={{
        background: 'var(--tg-theme-bg-color, #1c1c1e)',
        padding: '14px 16px', marginBottom: 8,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontWeight: 700, fontSize: 17 }}>🐷 Копилки</span>
        <button onClick={() => setAdding(true)} style={{
          padding: '8px 14px', borderRadius: 10, border: 'none',
          background: 'var(--tg-theme-button-color, #60a8eb)',
          color: 'var(--tg-theme-button-text-color, #fff)',
          fontSize: 13, fontWeight: 600,
        }}>
          + Новая
        </button>
      </div>

      {/* Create Form */}
      {adding && (
        <div style={{
          background: 'var(--tg-theme-bg-color, #1c1c1e)',
          padding: '14px 16px', marginBottom: 8,
        }}>
          <input placeholder="Название" value={newName} onChange={e => setNewName(e.target.value)}
            autoFocus style={inputStyle} />
          <input placeholder="Цель (₽, необязательно)" type="number" value={newTarget} onChange={e => setNewTarget(e.target.value)}
            style={inputStyle} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} style={{
              flex: 2, padding: '12px 0', borderRadius: 12, border: 'none',
              background: 'var(--tg-theme-button-color, #60a8eb)',
              color: 'var(--tg-theme-button-text-color, #fff)',
              fontSize: 15, fontWeight: 600,
            }}>Создать</button>
            <button onClick={() => setAdding(false)} style={{
              flex: 1, padding: '12px 0', borderRadius: 12,
              border: '1px solid rgba(128,128,128,0.2)',
              background: 'transparent',
              color: 'var(--tg-theme-text-color, #fff)', fontSize: 15,
            }}>Отмена</button>
          </div>
        </div>
      )}

      {/* Piggy List */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {piggies.map(pig => <PiggyCard key={pig.id} pig={pig} onUpdate={load} />)}
      </div>

      {piggies.length === 0 && !adding && (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--tg-theme-hint-color, #8e8e93)' }}>
          Копилок пока нет
        </div>
      )}
    </div>
  )
}
