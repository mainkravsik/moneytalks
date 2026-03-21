import { useEffect, useState } from 'react'
import { fetchLoans, Loan, recordPayment, createLoan } from '../api/loans'
import ExtraPaymentSlider from '../components/ExtraPaymentSlider'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid rgba(128,128,128,0.3)', fontSize: 15,
  background: 'transparent', color: 'inherit', boxSizing: 'border-box',
  marginBottom: 10,
}
const labelStyle: React.CSSProperties = { fontSize: 12, opacity: 0.5, marginBottom: 4 }

function AddLoanModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [type, setType] = useState<'loan' | 'card'>('loan')
  const [name, setName] = useState('')
  const [bank, setBank] = useState('')
  // loan fields
  const [original, setOriginal] = useState('')
  const [remaining, setRemaining] = useState('')
  const [rate, setRate] = useState('')
  const [payment, setPayment] = useState('')
  const [nextDate, setNextDate] = useState('')
  // card fields
  const [limit, setLimit] = useState('')
  const [debt, setDebt] = useState('')
  const [cardRate, setCardRate] = useState('')
  const [graceDays, setGraceDays] = useState('')
  const [minPayment, setMinPayment] = useState('')
  const [cardNextDate, setCardNextDate] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    if (type === 'loan') {
      await createLoan({
        loan_type: 'loan',
        name: name.trim(),
        bank: bank.trim() || null,
        original_amount: parseFloat(original),
        remaining_amount: parseFloat(remaining),
        interest_rate: parseFloat(rate),
        monthly_payment: parseFloat(payment),
        next_payment_date: nextDate,
        start_date: nextDate,
      })
    } else {
      const debtVal = parseFloat(debt) || 0
      const graceDaysVal = parseInt(graceDays) || 0
      await createLoan({
        loan_type: 'card',
        name: name.trim(),
        bank: bank.trim() || null,
        credit_limit: parseFloat(limit),
        remaining_amount: debtVal,
        interest_rate: parseFloat(cardRate) || 0,
        monthly_payment: parseFloat(minPayment) || 0,
        min_payment: parseFloat(minPayment) || null,
        grace_days: graceDaysVal,
        next_payment_date: cardNextDate,
        original_amount: null,
        start_date: null,
      })
    }
    onSave()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
      <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', width: '100%', borderRadius: '16px 16px 0 0', padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontWeight: 'bold', marginBottom: 14, fontSize: 16 }}>Новый долг</div>

        {/* Type switcher */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['loan', 'card'] as const).map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 'bold',
              background: type === t ? '#2196F3' : 'rgba(128,128,128,0.15)',
              color: type === t ? '#fff' : 'inherit',
            }}>
              {t === 'loan' ? '💳 Кредит' : '🃏 Кредитная карта'}
            </button>
          ))}
        </div>

        <input style={inputStyle} placeholder="Название *" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <input style={inputStyle} placeholder="Банк" value={bank} onChange={e => setBank(e.target.value)} />

        {type === 'loan' ? (
          <>
            <input style={inputStyle} type="number" placeholder="Исходная сумма *" value={original} onChange={e => setOriginal(e.target.value)} />
            <input style={inputStyle} type="number" placeholder="Остаток долга *" value={remaining} onChange={e => setRemaining(e.target.value)} />
            <input style={inputStyle} type="number" placeholder="Ставка % годовых *" value={rate} onChange={e => setRate(e.target.value)} />
            <input style={inputStyle} type="number" placeholder="Ежемесячный платёж *" value={payment} onChange={e => setPayment(e.target.value)} />
            <div style={labelStyle}>Дата следующего платежа *</div>
            <input style={inputStyle} type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} />
          </>
        ) : (
          <>
            <input style={inputStyle} type="number" placeholder="Кредитный лимит *" value={limit} onChange={e => setLimit(e.target.value)} />
            <input style={inputStyle} type="number" placeholder="Текущий долг" value={debt} onChange={e => setDebt(e.target.value)} />
            <input style={inputStyle} type="number" placeholder="Ставка % годовых (если льготный прошёл)" value={cardRate} onChange={e => setCardRate(e.target.value)} />
            <input style={inputStyle} type="number" placeholder="Льготный период (дней, 0 = просрочен)" value={graceDays} onChange={e => setGraceDays(e.target.value)} />
            <input style={inputStyle} type="number" placeholder="Минимальный платёж" value={minPayment} onChange={e => setMinPayment(e.target.value)} />
            <div style={labelStyle}>Дата следующего платежа *</div>
            <input style={inputStyle} type="date" value={cardNextDate} onChange={e => setCardNextDate(e.target.value)} />
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
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

function LoanCard({ loan, onPayment }: { loan: Loan; onPayment: () => void }) {
  if (loan.loan_type === 'card') {
    const limit = loan.credit_limit ?? 0
    const debt = loan.remaining_amount ?? 0
    const available = limit - debt
    const usedPct = limit > 0 ? debt / limit : 0
    const isOverdue = (loan.grace_days ?? 0) === 0 && debt > 0

    return (
      <div style={{ border: `1px solid ${isOverdue ? 'rgba(244,67,54,0.4)' : 'rgba(128,128,128,0.2)'}`, borderRadius: 10, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontWeight: 'bold' }}>🃏 {loan.name}</span>
          <span style={{ fontSize: 12, opacity: 0.6 }}>{loan.bank || ''}</span>
        </div>
        {isOverdue && (
          <div style={{ fontSize: 12, color: '#F44336', marginBottom: 6 }}>⚠️ Льготный период истёк · {loan.interest_rate}% годовых</div>
        )}
        <div style={{ fontSize: 13, marginBottom: 6 }}>
          Долг: <b>₽{debt.toLocaleString('ru')}</b> · Доступно: ₽{available.toLocaleString('ru')} / ₽{limit.toLocaleString('ru')}
        </div>
        <div style={{ background: 'rgba(128,128,128,0.2)', borderRadius: 4, height: 6, marginBottom: 6 }}>
          <div style={{ background: isOverdue ? '#F44336' : '#FF9800', width: `${Math.min(usedPct * 100, 100)}%`, height: 6, borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.6, marginBottom: 8 }}>
          <span>Мин. платёж: ₽{(loan.min_payment ?? loan.monthly_payment).toLocaleString('ru')}</span>
          <span>До: {loan.next_payment_date}</span>
        </div>
        <button onClick={onPayment} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#E8F5E9', color: '#388E3C', fontSize: 12 }}>
          ✓ Записать платёж
        </button>
      </div>
    )
  }

  // Regular loan
  const orig = loan.original_amount ?? loan.remaining_amount
  const pct = orig > 0 ? 1 - loan.remaining_amount / orig : 0
  // Estimate months remaining
  const monthlyRate = parseFloat(String(loan.interest_rate)) / 100 / 12
  const pmt = parseFloat(String(loan.monthly_payment))
  const bal = parseFloat(String(loan.remaining_amount))
  let monthsLeft = 0
  if (monthlyRate > 0 && pmt > 0) {
    monthsLeft = Math.ceil(Math.log(pmt / (pmt - monthlyRate * bal)) / Math.log(1 + monthlyRate))
  } else if (pmt > 0) {
    monthsLeft = Math.ceil(bal / pmt)
  }

  return (
    <div style={{ border: '1px solid rgba(128,128,128,0.2)', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontWeight: 'bold' }}>💳 {loan.name}</span>
        <span style={{ fontSize: 12, opacity: 0.6 }}>{loan.bank || ''}</span>
      </div>
      <div style={{ fontSize: 13, marginBottom: 6 }}>
        Остаток: <b>₽{loan.remaining_amount.toLocaleString('ru')}</b> · {loan.interest_rate}% · ещё ~{monthsLeft} мес.
      </div>
      <div style={{ background: 'rgba(128,128,128,0.2)', borderRadius: 4, height: 6, marginBottom: 6 }}>
        <div style={{ background: '#4CAF50', width: `${Math.min(pct * 100, 100)}%`, height: 6, borderRadius: 4 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.6, marginBottom: 8 }}>
        <span>Платёж: ₽{loan.monthly_payment.toLocaleString('ru')}</span>
        <span>Следующий: {loan.next_payment_date}</span>
      </div>
      <button onClick={onPayment} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#E8F5E9', color: '#388E3C', fontSize: 12 }}>
        ✓ Записать платёж
      </button>
    </div>
  )
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const load = () => fetchLoans().then(setLoans)
  useEffect(() => { load() }, [])

  const handlePayment = async (loan: Loan) => {
    const defaultAmt = loan.loan_type === 'card'
      ? (loan.min_payment ?? loan.monthly_payment)
      : loan.monthly_payment
    const amount = prompt(`Платёж по "${loan.name}" (мин. ₽${defaultAmt}):`)
    if (!amount) return
    await recordPayment(loan.id, parseFloat(amount))
    load()
  }

  const regularLoans = loans.filter(l => l.loan_type === 'loan')
  const cards = loans.filter(l => l.loan_type === 'card')

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>💳 Кредиты и карты</h3>
        <button onClick={() => setShowAdd(true)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#2196F3', color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
          + Добавить
        </button>
      </div>

      {cards.length > 0 && (
        <>
          <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 8 }}>КРЕДИТНЫЕ КАРТЫ</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {cards.map(loan => <LoanCard key={loan.id} loan={loan} onPayment={() => handlePayment(loan)} />)}
          </div>
        </>
      )}

      {regularLoans.length > 0 && (
        <>
          <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 8 }}>КРЕДИТЫ</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {regularLoans.map(loan => <LoanCard key={loan.id} loan={loan} onPayment={() => handlePayment(loan)} />)}
          </div>
        </>
      )}

      {loans.length === 0 && (
        <div style={{ opacity: 0.5, textAlign: 'center', marginTop: 40 }}>Кредитов и карт нет</div>
      )}

      {regularLoans.length > 0 && <ExtraPaymentSlider />}
      {showAdd && <AddLoanModal onClose={() => setShowAdd(false)} onSave={load} />}
    </div>
  )
}
