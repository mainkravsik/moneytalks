import { useEffect, useState } from 'react'
import { api } from '../api/client'

interface Transaction {
  id: number; amount: number; comment: string | null
  category_id: number; created_at: string; is_deleted: boolean
  category_name: string | null; category_emoji: string | null; user_name: string | null
}

const fmt = (n: number) => Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

export default function HistoryPage() {
  const [txs, setTxs] = useState<Transaction[]>([])
  const load = () => api.get<Transaction[]>('/transactions').then(r => setTxs(r.data))
  useEffect(() => { load() }, [])

  const handleDelete = async (id: number) => {
    await api.delete(`/transactions/${id}`)
    load()
  }

  return (
    <div style={{ paddingBottom: 8 }}>
      {/* Header */}
      <div style={{
        background: 'var(--tg-theme-bg-color, #1c1c1e)',
        padding: '14px 16px', marginBottom: 8,
      }}>
        <span style={{ fontWeight: 700, fontSize: 17 }}>📋 История</span>
      </div>

      {/* Transaction List */}
      <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)' }}>
        {txs.map((tx, i) => (
          <div key={tx.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px',
            borderBottom: i < txs.length - 1 ? '0.5px solid rgba(128,128,128,0.12)' : 'none',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 15 }}>
                {tx.category_emoji} {tx.category_name || '—'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #8e8e93)', marginTop: 2 }}>
                {new Date(tx.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })} · {tx.user_name || '?'}{tx.comment ? ` · ${tx.comment}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>₽{fmt(Number(tx.amount))}</span>
              <button onClick={() => handleDelete(tx.id)} style={{
                padding: '4px 10px', borderRadius: 8, border: 'none',
                background: 'rgba(244,67,54,0.1)', color: '#F44336', fontSize: 12,
              }}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {txs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--tg-theme-hint-color, #8e8e93)' }}>
          Нет транзакций в этом периоде
        </div>
      )}
    </div>
  )
}
