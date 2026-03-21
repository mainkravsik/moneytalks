import { useEffect, useState } from 'react'
import { api } from '../api/client'

interface Transaction {
  id: number; amount: number; comment: string | null
  category_id: number; created_at: string; is_deleted: boolean
  category_name: string | null; category_emoji: string | null; user_name: string | null
}

export default function HistoryPage() {
  const [txs, setTxs] = useState<Transaction[]>([])
  const load = () => api.get<Transaction[]>('/transactions').then(r => setTxs(r.data))
  useEffect(() => { load() }, [])

  const handleDelete = async (id: number) => {
    await api.delete(`/transactions/${id}`)
    load()
  }

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ margin: '0 0 12px' }}>📋 История</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {txs.map(tx => (
          <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(128,128,128,0.15)' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>
                {tx.category_emoji} {tx.category_name || '—'} · ₽{tx.amount.toLocaleString('ru')}
              </div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>
                {new Date(tx.created_at).toLocaleDateString('ru')} · {tx.user_name || '?'} · {tx.comment || '—'}
              </div>
            </div>
            <button onClick={() => handleDelete(tx.id)}
              style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(244,67,54,0.1)', color: '#F44336', fontSize: 12 }}>
              Удалить
            </button>
          </div>
        ))}
        {txs.length === 0 && <div style={{ opacity: 0.5, textAlign: 'center', marginTop: 40 }}>Нет транзакций в этом периоде</div>}
      </div>
    </div>
  )
}
