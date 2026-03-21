import { Piggy, contributePiggy } from '../api/piggy'
import { useState } from 'react'

export default function PiggyCard({ pig, onUpdate }: { pig: Piggy; onUpdate: () => void }) {
  const pct = pig.target_amount ? pig.current_amount / pig.target_amount : 0
  const [amount, setAmount] = useState('')
  const [adding, setAdding] = useState(false)

  const handleContribute = async () => {
    if (!amount) return
    await contributePiggy(pig.id, parseFloat(amount))
    setAmount('')
    setAdding(false)
    onUpdate()
  }

  return (
    <div style={{ border: '1px solid rgba(128,128,128,0.2)', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 'bold' }}>🐷 {pig.name}</span>
        <span style={{ fontSize: 12, color: '#4CAF50' }}>
          ₽{pig.current_amount.toLocaleString('ru')}
          {pig.target_amount ? ` / ₽${pig.target_amount.toLocaleString('ru')}` : ''}
        </span>
      </div>
      {pig.target_amount && (
        <div style={{ background: 'rgba(128,128,128,0.2)', borderRadius: 4, height: 6, margin: '8px 0' }}>
          <div style={{ background: '#2196F3', width: `${Math.min(pct * 100, 100)}%`, height: 6, borderRadius: 4 }} />
        </div>
      )}
      {pig.target_date && (
        <div style={{ fontSize: 11, opacity: 0.5 }}>Цель: {pig.target_date}</div>
      )}
      {adding ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            type="number" placeholder="Сумма"
            value={amount} onChange={e => setAmount(e.target.value)}
            style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid rgba(128,128,128,0.3)' }}
          />
          <button onClick={handleContribute} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#4CAF50', color: '#fff' }}>OK</button>
          <button onClick={() => setAdding(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent' }}>✕</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ marginTop: 8, padding: '6px 12px', borderRadius: 6, border: 'none', background: '#E3F2FD', color: '#1976D2', fontSize: 12 }}>
          + Пополнить
        </button>
      )}
    </div>
  )
}
