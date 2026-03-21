import { useEffect, useState } from 'react'
import { fetchLoans, Loan, recordPayment, createLoan } from '../api/loans'
import ExtraPaymentSlider from '../components/ExtraPaymentSlider'

function AddLoanModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState('')
  const [bank, setBank] = useState('')
  const [original, setOriginal] = useState('')
  const [remaining, setRemaining] = useState('')
  const [rate, setRate] = useState('')
  const [payment, setPayment] = useState('')
  const [nextDate, setNextDate] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !original || !remaining || !rate || !payment || !nextDate) return
    setSaving(true)
    await createLoan({
      name: name.trim(),
      bank: bank.trim() || null,
      original_amount: parseFloat(original),
      remaining_amount: parseFloat(remaining),
      interest_rate: parseFloat(rate),
      monthly_payment: parseFloat(payment),
      next_payment_date: nextDate,
      start_date: nextDate,
    })
    onSave()
    onClose()
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid rgba(128,128,128,0.3)', fontSize: 15,
    background: 'transparent', color: 'inherit', boxSizing: 'border-box' as const,
    marginBottom: 10,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
      <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', width: '100%', borderRadius: '16px 16px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ fontWeight: 'bold', marginBottom: 14, fontSize: 16 }}>Новый кредит</div>
        <input style={inputStyle} placeholder="Название *" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <input style={inputStyle} placeholder="Банк" value={bank} onChange={e => setBank(e.target.value)} />
        <input style={inputStyle} type="number" placeholder="Исходная сумма *" value={original} onChange={e => setOriginal(e.target.value)} />
        <input style={inputStyle} type="number" placeholder="Остаток долга *" value={remaining} onChange={e => setRemaining(e.target.value)} />
        <input style={inputStyle} type="number" placeholder="Ставка % годовых *" value={rate} onChange={e => setRate(e.target.value)} />
        <input style={inputStyle} type="number" placeholder="Ежемесячный платёж *" value={payment} onChange={e => setPayment(e.target.value)} />
        <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 4 }}>Дата следующего платежа *</div>
        <input style={inputStyle} type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent', color: 'inherit', fontSize: 14 }}>
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 12, borderRadius: 8, border: 'none', background: '#2196F3', color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
            {saving ? '...' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const load = () => fetchLoans().then(setLoans)
  useEffect(() => { load() }, [])

  const handlePayment = async (loan: Loan) => {
    const amount = prompt(`Платёж по "${loan.name}" (мин. ₽${loan.monthly_payment}):`)
    if (!amount) return
    await recordPayment(loan.id, parseFloat(amount))
    load()
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>💳 Кредиты</h3>
        <button
          onClick={() => setShowAdd(true)}
          style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#2196F3', color: '#fff', fontSize: 13, fontWeight: 'bold' }}
        >
          + Кредит
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {loans.map(loan => {
          const pct = 1 - loan.remaining_amount / loan.original_amount
          return (
            <div key={loan.id} style={{ border: '1px solid rgba(128,128,128,0.2)', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 'bold' }}>{loan.name}</span>
                <span style={{ fontSize: 12 }}>{loan.bank || ''}</span>
              </div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                Остаток: <b>₽{loan.remaining_amount.toLocaleString('ru')}</b> · {loan.interest_rate}% годовых
              </div>
              <div style={{ background: 'rgba(128,128,128,0.2)', borderRadius: 4, height: 6, marginBottom: 6 }}>
                <div style={{ background: '#4CAF50', width: `${Math.min(pct * 100, 100)}%`, height: 6, borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.6, marginBottom: 8 }}>
                <span>Платёж: ₽{loan.monthly_payment.toLocaleString('ru')}</span>
                <span>Следующий: {loan.next_payment_date}</span>
              </div>
              <button onClick={() => handlePayment(loan)}
                style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#E8F5E9', color: '#388E3C', fontSize: 12 }}>
                ✓ Записать платёж
              </button>
            </div>
          )
        })}
        {loans.length === 0 && <div style={{ opacity: 0.5, textAlign: 'center', marginTop: 40 }}>Кредитов нет</div>}
      </div>
      {loans.length > 0 && <ExtraPaymentSlider />}
      {showAdd && <AddLoanModal onClose={() => setShowAdd(false)} onSave={load} />}
    </div>
  )
}
