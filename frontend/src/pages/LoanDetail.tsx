import { useEffect, useState } from 'react'
import { Loan, fetchPayments, fetchSchedule, fetchEarlyPayoff } from '../api/loans'

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '10px 0', border: 'none', fontSize: 13, fontWeight: 'bold',
  background: active ? '#2196F3' : 'transparent',
  color: active ? '#fff' : 'inherit',
  borderRadius: 8, cursor: 'pointer',
})

export default function LoanDetail({ loan, onBack }: { loan: Loan; onBack: () => void }) {
  const [tab, setTab] = useState<'history' | 'schedule' | 'early'>('history')

  // History
  const [payments, setPayments] = useState<{id: number; amount: number; paid_at: string}[]>([])

  // Schedule
  const [schedule, setSchedule] = useState<{
    schedule: {month: number; date: string; payment: number; principal: number; interest: number; balance: number}[]
    total_months: number; total_interest: number; total_paid: number
  } | null>(null)

  // Early payoff
  const [extra, setExtra] = useState(5000)
  const [earlyData, setEarlyData] = useState<{
    normal: {months: number; total_interest: number; total_paid: number}
    with_extra: {months: number; total_interest: number; total_paid: number}
    savings: {months_saved: number; interest_saved: number}
  } | null>(null)

  useEffect(() => {
    if (tab === 'history') fetchPayments(loan.id).then(setPayments).catch(() => {})
    if (tab === 'schedule') fetchSchedule(loan.id).then(setSchedule).catch(() => {})
  }, [tab, loan.id])

  useEffect(() => {
    if (tab === 'early') fetchEarlyPayoff(loan.id, extra).then(setEarlyData).catch(() => {})
  }, [tab, extra, loan.id])

  const fmt = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 18, color: 'inherit', cursor: 'pointer' }}>←</button>
        <h3 style={{ margin: 0 }}>💳 {loan.name}</h3>
      </div>

      {/* Summary card */}
      <div style={{ background: 'rgba(128,128,128,0.1)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 14 }}>Остаток: <b>₽{fmt(loan.remaining_amount)}</b></div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          {loan.bank} · {loan.rate_periods?.length > 0 ? 'перем. ставка' : `${loan.interest_rate}%`} · ₽{fmt(loan.monthly_payment)}/мес
        </div>
        {loan.rate_periods?.length > 0 && (
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
            {loan.rate_periods.map((rp, i) => (
              <span key={i}>{i > 0 ? ' → ' : ''}{rp.rate}%{rp.end_date ? ` (до ${rp.end_date})` : ''}</span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 12, opacity: 0.5 }}>
          Следующий платёж: {loan.next_payment_date}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button style={tabStyle(tab === 'history')} onClick={() => setTab('history')}>История</button>
        <button style={tabStyle(tab === 'schedule')} onClick={() => setTab('schedule')}>График</button>
        <button style={tabStyle(tab === 'early')} onClick={() => setTab('early')}>Досрочное</button>
      </div>

      {/* History Tab */}
      {tab === 'history' && (
        payments.length === 0 ? (
          <div style={{ opacity: 0.5, textAlign: 'center', marginTop: 20 }}>Платежей пока нет</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {payments.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(128,128,128,0.2)', borderRadius: 8, padding: 10 }}>
                <span style={{ fontSize: 13, opacity: 0.7 }}>
                  {new Date(p.paid_at).toLocaleDateString('ru-RU')}
                </span>
                <span style={{ fontWeight: 'bold' }}>₽{fmt(p.amount)}</span>
              </div>
            ))}
          </div>
        )
      )}

      {/* Schedule Tab */}
      {tab === 'schedule' && schedule && (
        <>
          <div style={{ background: 'rgba(128,128,128,0.1)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <div>Осталось: <b>{schedule.total_months} мес.</b></div>
            <div>Переплата: <b style={{ color: '#F44336' }}>₽{fmt(schedule.total_interest)}</b></div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>Всего заплатите: ₽{fmt(schedule.total_paid)}</div>
          </div>

          <div style={{ fontSize: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ opacity: 0.6 }}>
                  <th style={{ textAlign: 'left', padding: 4 }}>Дата</th>
                  <th style={{ textAlign: 'right', padding: 4 }}>Платёж</th>
                  <th style={{ textAlign: 'right', padding: 4 }}>Долг</th>
                  <th style={{ textAlign: 'right', padding: 4 }}>%</th>
                  <th style={{ textAlign: 'right', padding: 4 }}>Остаток</th>
                </tr>
              </thead>
              <tbody>
                {schedule.schedule.map(s => (
                  <tr key={s.month}>
                    <td style={{ padding: 4, fontSize: 11 }}>{s.date}</td>
                    <td style={{ textAlign: 'right', padding: 4 }}>₽{fmt(s.payment)}</td>
                    <td style={{ textAlign: 'right', padding: 4 }}>₽{fmt(s.principal)}</td>
                    <td style={{ textAlign: 'right', padding: 4, color: '#F44336' }}>₽{fmt(s.interest)}</td>
                    <td style={{ textAlign: 'right', padding: 4 }}>₽{fmt(s.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Early Payoff Tab */}
      {tab === 'early' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Доплачивать сверх платежа:</div>
            <input
              type="range"
              min={0} max={Math.max(50000, loan.monthly_payment * 2)} step={1000}
              value={extra}
              onChange={e => setExtra(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>+₽{fmt(extra)}/мес</div>
            <div style={{ textAlign: 'center', fontSize: 12, opacity: 0.6 }}>
              Итого: ₽{fmt(loan.monthly_payment + extra)}/мес
            </div>
          </div>

          {earlyData && (
            <>
              {/* Comparison cards */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <div style={{ flex: 1, background: 'rgba(128,128,128,0.1)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>БЕЗ ДОПЛАТЫ</div>
                  <div style={{ fontWeight: 'bold' }}>{earlyData.normal.months} мес.</div>
                  <div style={{ fontSize: 12, color: '#F44336' }}>%: ₽{fmt(earlyData.normal.total_interest)}</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(76,175,80,0.1)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>С ДОПЛАТОЙ</div>
                  <div style={{ fontWeight: 'bold' }}>{earlyData.with_extra.months} мес.</div>
                  <div style={{ fontSize: 12, color: '#4CAF50' }}>%: ₽{fmt(earlyData.with_extra.total_interest)}</div>
                </div>
              </div>

              {/* Savings */}
              {earlyData.savings.months_saved > 0 && (
                <div style={{ background: 'rgba(76,175,80,0.1)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 14 }}>Экономия</div>
                  <div style={{ fontWeight: 'bold', fontSize: 18, color: '#4CAF50' }}>
                    ₽{fmt(earlyData.savings.interest_saved)}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Закроете на {earlyData.savings.months_saved} мес. раньше
                  </div>
                </div>
              )}

              {extra === 0 && (
                <div style={{ opacity: 0.5, textAlign: 'center', marginTop: 12, fontSize: 13 }}>
                  Двигайте слайдер, чтобы увидеть экономию
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
