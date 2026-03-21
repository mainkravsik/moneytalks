import { useEffect, useState } from 'react'
import { fetchLoans, Loan, recordPayment } from '../api/loans'
import ExtraPaymentSlider from '../components/ExtraPaymentSlider'

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
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
      <h3 style={{ margin: '0 0 12px' }}>💳 Кредиты</h3>
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
    </div>
  )
}
