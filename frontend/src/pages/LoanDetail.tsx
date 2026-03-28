import { useEffect, useState } from 'react'
import { Loan, fetchPayments, fetchSchedule, fetchEarlyPayoff } from '../api/loans'

const fmt = (n: number) => Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

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

  return (
    <div style={{ paddingBottom: 8 }}>
      {/* Header */}
      <div style={{
        background: 'var(--tg-theme-bg-color, #1c1c1e)',
        padding: '14px 16px', marginBottom: 8,
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none',
          color: 'var(--tg-theme-button-color, #60a8eb)',
          fontSize: 15, padding: 0, marginBottom: 10, cursor: 'pointer',
        }}>
          ← Назад
        </button>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>💳 {loan.name}</div>

        {/* Summary */}
        <div style={{ background: 'var(--tg-theme-secondary-bg-color, #2c2c2e)', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 15 }}>Остаток: <b>₽{fmt(Number(loan.remaining_amount))}</b></div>
          <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #8e8e93)', marginTop: 2 }}>
            {loan.bank} · {loan.rate_periods?.length > 0 ? 'перем. ставка' : `${loan.interest_rate}%`} · ₽{fmt(Number(loan.monthly_payment))}/мес
          </div>
          {loan.rate_periods?.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #8e8e93)', marginTop: 4 }}>
              {loan.rate_periods.map((rp, i) => (
                <span key={i}>{i > 0 ? ' → ' : ''}{rp.rate}%{rp.end_date ? ` (до ${rp.end_date})` : ''}</span>
              ))}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #8e8e93)', marginTop: 2 }}>
            Следующий платёж: {loan.next_payment_date}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 16px', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {([
            { key: 'history' as const, label: 'История' },
            { key: 'schedule' as const, label: 'График' },
            { key: 'early' as const, label: 'Досрочное' },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 600,
              background: tab === t.key ? 'var(--tg-theme-button-color, #60a8eb)' : 'var(--tg-theme-secondary-bg-color, #2c2c2e)',
              color: tab === t.key ? 'var(--tg-theme-button-text-color, #fff)' : 'var(--tg-theme-text-color, #fff)',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* History Tab */}
      {tab === 'history' && (
        payments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--tg-theme-hint-color, #8e8e93)' }}>Платежей пока нет</div>
        ) : (
          <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)' }}>
            {payments.map((p, i) => (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px',
                borderBottom: i < payments.length - 1 ? '0.5px solid rgba(128,128,128,0.12)' : 'none',
              }}>
                <span style={{ fontSize: 14, color: 'var(--tg-theme-hint-color, #8e8e93)' }}>
                  {new Date(p.paid_at).toLocaleDateString('ru-RU')}
                </span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>₽{fmt(Number(p.amount))}</span>
              </div>
            ))}
          </div>
        )
      )}

      {/* Schedule Tab */}
      {tab === 'schedule' && schedule && (
        <>
          <div style={{ padding: '0 16px', marginBottom: 8 }}>
            <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 15 }}>Осталось: <b>{schedule.total_months} мес.</b></div>
              <div style={{ fontSize: 14 }}>Переплата: <b style={{ color: '#F44336' }}>₽{fmt(Number(schedule.total_interest))}</b></div>
              <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #8e8e93)', marginTop: 2 }}>Всего заплатите: ₽{fmt(Number(schedule.total_paid))}</div>
            </div>
          </div>

          <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', padding: '14px 16px' }}>
            <div style={{ fontSize: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--tg-theme-hint-color, #8e8e93)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.12)' }}>Дата</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.12)' }}>Платёж</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.12)' }}>Долг</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.12)' }}>%</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.12)' }}>Остаток</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.schedule.map(s => (
                    <tr key={s.month}>
                      <td style={{ padding: '6px 4px', fontSize: 11, borderBottom: '0.5px solid rgba(128,128,128,0.08)' }}>{s.date}</td>
                      <td style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.08)' }}>₽{fmt(Number(s.payment))}</td>
                      <td style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.08)' }}>₽{fmt(Number(s.principal))}</td>
                      <td style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.08)', color: '#F44336' }}>₽{fmt(Number(s.interest))}</td>
                      <td style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.08)' }}>₽{fmt(Number(s.balance))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Early Payoff Tab */}
      {tab === 'early' && (
        <>
          <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', padding: '14px 16px', marginBottom: 8 }}>
            <div style={{ fontSize: 14, marginBottom: 10 }}>Доплачивать сверх платежа:</div>
            <input
              type="range"
              min={0} max={Math.max(50000, Number(loan.monthly_payment) * 2)} step={1000}
              value={extra}
              onChange={e => setExtra(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 17, marginTop: 4 }}>+₽{fmt(extra)}/мес</div>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--tg-theme-hint-color, #8e8e93)' }}>
              Итого: ₽{fmt(Number(loan.monthly_payment) + extra)}/мес
            </div>
          </div>

          {earlyData && (
            <>
              {/* Comparison cards */}
              <div style={{ padding: '0 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, background: 'var(--tg-theme-bg-color, #1c1c1e)', borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #8e8e93)', marginBottom: 4 }}>БЕЗ ДОПЛАТЫ</div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{earlyData.normal.months} мес.</div>
                    <div style={{ fontSize: 13, color: '#F44336' }}>%: ₽{fmt(Number(earlyData.normal.total_interest))}</div>
                  </div>
                  <div style={{ flex: 1, background: 'var(--tg-theme-bg-color, #1c1c1e)', borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #8e8e93)', marginBottom: 4 }}>С ДОПЛАТОЙ</div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{earlyData.with_extra.months} мес.</div>
                    <div style={{ fontSize: 13, color: '#4CAF50' }}>%: ₽{fmt(Number(earlyData.with_extra.total_interest))}</div>
                  </div>
                </div>
              </div>

              {/* Savings */}
              {earlyData.savings.months_saved > 0 && (
                <div style={{ padding: '0 16px' }}>
                  <div style={{ background: 'rgba(76,175,80,0.1)', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 14 }}>Экономия</div>
                    <div style={{ fontWeight: 700, fontSize: 20, color: '#4CAF50' }}>
                      ₽{fmt(Number(earlyData.savings.interest_saved))}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #8e8e93)' }}>
                      Закроете на {earlyData.savings.months_saved} мес. раньше
                    </div>
                  </div>
                </div>
              )}

              {extra === 0 && (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--tg-theme-hint-color, #8e8e93)', fontSize: 13 }}>
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
