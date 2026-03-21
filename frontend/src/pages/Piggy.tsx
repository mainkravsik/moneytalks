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

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>🐷 Копилки</h3>
        <button onClick={() => setAdding(true)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#4CAF50', color: '#fff', fontSize: 12 }}>
          + Новая
        </button>
      </div>
      {adding && (
        <div style={{ background: 'rgba(128,128,128,0.08)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <input placeholder="Название" value={newName} onChange={e => setNewName(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid rgba(128,128,128,0.3)', boxSizing: 'border-box' }} />
          <input placeholder="Цель (₽, необязательно)" type="number" value={newTarget} onChange={e => setNewTarget(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid rgba(128,128,128,0.3)', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} style={{ flex: 1, padding: 8, borderRadius: 6, border: 'none', background: '#4CAF50', color: '#fff' }}>Создать</button>
            <button onClick={() => setAdding(false)} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent' }}>Отмена</button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {piggies.map(pig => <PiggyCard key={pig.id} pig={pig} onUpdate={load} />)}
      </div>
    </div>
  )
}
