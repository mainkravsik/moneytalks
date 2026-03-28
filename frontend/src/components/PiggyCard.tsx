import { Piggy, contributePiggy } from '../api/piggy'
import { useState } from 'react'

const fmt = (n: number) => Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

export default function PiggyCard({ pig, onUpdate }: { pig: Piggy; onUpdate: () => void }) {
  const pct = pig.target_amount ? Number(pig.current_amount) / Number(pig.target_amount) : 0
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
    <div style={{
      background: 'var(--tg-theme-bg-color, #1c1c1e)',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>🐷 {pig.name}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tg-theme-button-color, #60a8eb)' }}>
          ₽{fmt(Number(pig.current_amount))}
          {pig.target_amount ? <span style={{ fontWeight: 400, color: 'var(--tg-theme-hint-color, #8e8e93)' }}> / ₽{fmt(Number(pig.target_amount))}</span> : ''}
        </span>
      </div>
      {pig.target_amount && (
        <div style={{ background: 'rgba(128,128,128,0.15)', borderRadius: 4, height: 5, margin: '10px 0 4px' }}>
          <div style={{
            background: 'var(--tg-theme-button-color, #60a8eb)',
            width: `${Math.min(pct * 100, 100)}%`,
            height: 5, borderRadius: 4,
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}
      {pig.target_date && (
        <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #8e8e93)', marginTop: 4 }}>
          Цель: {pig.target_date}
        </div>
      )}
      {adding ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            type="number" placeholder="Сумма"
            value={amount} onChange={e => setAmount(e.target.value)}
            autoFocus
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 10,
              border: '1px solid rgba(128,128,128,0.2)',
              background: 'var(--tg-theme-secondary-bg-color, #2c2c2e)',
              color: 'var(--tg-theme-text-color, #fff)', fontSize: 15,
            }}
          />
          <button onClick={handleContribute} style={{
            padding: '10px 16px', borderRadius: 10, border: 'none',
            background: 'var(--tg-theme-button-color, #60a8eb)',
            color: 'var(--tg-theme-button-text-color, #fff)', fontWeight: 600,
          }}>OK</button>
          <button onClick={() => setAdding(false)} style={{
            padding: '10px 14px', borderRadius: 10,
            border: '1px solid rgba(128,128,128,0.2)',
            background: 'transparent', color: 'var(--tg-theme-text-color, #fff)',
          }}>✕</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{
          marginTop: 10, padding: '8px 14px', borderRadius: 10, border: 'none',
          background: 'var(--tg-theme-secondary-bg-color, #2c2c2e)',
          color: 'var(--tg-theme-button-color, #60a8eb)',
          fontSize: 13, fontWeight: 600,
        }}>
          + Пополнить
        </button>
      )}
    </div>
  )
}
