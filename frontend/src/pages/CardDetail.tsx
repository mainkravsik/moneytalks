import { useEffect, useState, useCallback } from 'react'
import { Loan } from '../api/loans'
import {
  CardCharge, CardSummary, CardPayoffResponse,
  fetchCharges, deleteCharge, fetchCardSummary, fetchCardPayoff,
} from '../api/card'

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

const statusColors: Record<string, string> = {
  in_grace: '#4CAF50',
  overdue: '#F44336',
  paid: '#9E9E9E',
  no_grace: '#FF9800',
}

const statusLabels: Record<string, string> = {
  in_grace: 'Льготный',
  overdue: 'Просрочено',
  paid: 'Погашено',
  no_grace: 'Без льготы',
}

const chargeTypeIcons: Record<string, string> = {
  purchase: '🛒',
  transfer: '🔄',
  cash: '💵',
}

const fmt = (n: number) => Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

function formatMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

interface Props {
  loan: Loan
  onBack: () => void
}

export default function CardDetail({ loan, onBack }: Props) {
  const [tab, setTab] = useState<'charges' | 'calc'>('charges')

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
        <div style={{ fontWeight: 700, fontSize: 17 }}>🃏 {loan.name}</div>
      </div>

      {/* Tab switcher */}
      <div style={{ padding: '0 16px', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['charges', 'calc'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 600,
              background: tab === t ? 'var(--tg-theme-button-color, #60a8eb)' : 'var(--tg-theme-secondary-bg-color, #2c2c2e)',
              color: tab === t ? 'var(--tg-theme-button-text-color, #fff)' : 'var(--tg-theme-text-color, #fff)',
            }}>
              {t === 'charges' ? 'Траты' : 'Калькулятор'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'charges' ? <ChargesTab loan={loan} /> : <CalcTab loan={loan} />}
    </div>
  )
}

/* ── Charges Tab ── */

function ChargesTab({ loan }: { loan: Loan }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [charges, setCharges] = useState<CardCharge[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetchCharges(loan.id, formatMonth(year, month))
      .then(setCharges)
      .finally(() => setLoading(false))
  }, [loan.id, year, month])

  useEffect(() => { load() }, [load])

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const next = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const handleDelete = async (chargeId: number) => {
    await deleteCharge(loan.id, chargeId)
    load()
  }

  return (
    <div>
      {/* Month nav */}
      <div style={{
        background: 'var(--tg-theme-bg-color, #1c1c1e)',
        padding: '12px 16px', marginBottom: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <button onClick={prev} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--tg-theme-button-color, #60a8eb)', cursor: 'pointer' }}>←</button>
        <span style={{ fontWeight: 600, fontSize: 15, minWidth: 140, textAlign: 'center' }}>
          {MONTHS_RU[month]} {year}
        </span>
        <button onClick={next} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--tg-theme-button-color, #60a8eb)', cursor: 'pointer' }}>→</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--tg-theme-hint-color, #8e8e93)' }}>Загрузка...</div>
      ) : charges.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--tg-theme-hint-color, #8e8e93)' }}>Трат за этот месяц нет</div>
      ) : (
        <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)' }}>
          {charges.map((c, i) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px',
              borderBottom: i < charges.length - 1 ? '0.5px solid rgba(128,128,128,0.12)' : 'none',
            }}>
              <span style={{ fontSize: 20 }}>{chargeTypeIcons[c.charge_type] || '📋'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.description || 'Без описания'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #8e8e93)', marginTop: 2 }}>
                  {c.charge_date}
                  {c.grace_deadline && ` · до ${c.grace_deadline}`}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>₽{fmt(Number(c.amount))}</div>
                <span style={{
                  fontSize: 11, padding: '2px 6px', borderRadius: 6,
                  background: `${statusColors[c.status] || '#999'}22`,
                  color: statusColors[c.status] || '#999',
                  fontWeight: 600,
                }}>
                  {statusLabels[c.status] || c.status}
                </span>
              </div>
              <button onClick={() => handleDelete(c.id)} style={{
                padding: '4px 10px', borderRadius: 8, border: 'none',
                background: 'rgba(244,67,54,0.1)', color: '#F44336', fontSize: 12,
              }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Calculator Tab ── */

function CalcTab({ loan }: { loan: Loan }) {
  const [summary, setSummary] = useState<CardSummary | null>(null)
  const [payment, setPayment] = useState(10000)
  const [payoff, setPayoff] = useState<CardPayoffResponse | null>(null)
  const [loadingPayoff, setLoadingPayoff] = useState(false)

  useEffect(() => {
    fetchCardSummary(loan.id).then(s => {
      setSummary(s)
      if (s.min_payment > 0) setPayment(Math.max(Math.ceil(s.min_payment / 1000) * 1000, 1000))
    })
  }, [loan.id])

  useEffect(() => {
    if (payment < 1000) return
    setLoadingPayoff(true)
    const t = setTimeout(() => {
      fetchCardPayoff(loan.id, payment)
        .then(setPayoff)
        .finally(() => setLoadingPayoff(false))
    }, 400)
    return () => clearTimeout(t)
  }, [loan.id, payment])

  if (!summary) return <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--tg-theme-hint-color, #8e8e93)' }}>Загрузка...</div>

  const recs = payoff?.recommendations

  return (
    <div>
      {/* Slider */}
      <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', padding: '14px 16px', marginBottom: 8 }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>
          Ежемесячный платёж: <b>₽{fmt(payment)}</b>
        </div>
        <input type="range" min={1000} max={200000} step={1000} value={payment}
          onChange={e => setPayment(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {/* Recommendation cards */}
      {recs && (
        <div style={{ padding: '0 16px', marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Без %', value: recs.zero_interest },
              { label: 'За 6 мес', value: recs.close_in_6 },
              { label: 'За 12 мес', value: recs.close_in_12 },
            ].map(r => (
              <button key={r.label} onClick={() => setPayment(r.value)} style={{
                flex: 1, padding: '10px 4px', borderRadius: 10,
                border: 'none',
                background: payment === r.value ? 'var(--tg-theme-button-color, #60a8eb)' : 'var(--tg-theme-bg-color, #1c1c1e)',
                color: payment === r.value ? 'var(--tg-theme-button-text-color, #fff)' : 'var(--tg-theme-text-color, #fff)',
                cursor: 'pointer', textAlign: 'center',
              }}>
                <div style={{ fontSize: 12, opacity: payment === r.value ? 0.9 : 0.6 }}>{r.label}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>₽{fmt(r.value)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {loadingPayoff ? (
        <div style={{ textAlign: 'center', padding: '20px 16px', color: 'var(--tg-theme-hint-color, #8e8e93)' }}>Расчёт...</div>
      ) : payoff && (
        <>
          <div style={{ padding: '0 16px', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, background: 'var(--tg-theme-bg-color, #1c1c1e)', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #8e8e93)' }}>Месяцев</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{payoff.total_months}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--tg-theme-bg-color, #1c1c1e)', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #8e8e93)' }}>Переплата</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#F44336' }}>₽{fmt(Number(payoff.total_interest))}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--tg-theme-bg-color, #1c1c1e)', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #8e8e93)' }}>Всего</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>₽{fmt(Number(payoff.total_paid))}</div>
              </div>
            </div>
          </div>

          {/* Monthly table */}
          <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', padding: '14px 16px' }}>
            <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #8e8e93)', marginBottom: 10 }}>ПОМЕСЯЧНЫЙ ГРАФИК</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--tg-theme-hint-color, #8e8e93)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.12)' }}>Месяц</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.12)' }}>Долг</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.12)' }}>Платёж</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.12)' }}>%</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.12)' }}>Остаток</th>
                  </tr>
                </thead>
                <tbody>
                  {payoff.months.map((m, i) => (
                    <tr key={i}>
                      <td style={{ padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.08)' }}>{m.month}</td>
                      <td style={{ padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.08)', textAlign: 'right' }}>₽{fmt(Number(m.debt_start))}</td>
                      <td style={{ padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.08)', textAlign: 'right' }}>₽{fmt(Number(m.payment))}</td>
                      <td style={{ padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.08)', textAlign: 'right', color: m.interest > 0 ? '#F44336' : 'inherit' }}>₽{fmt(Number(m.interest))}</td>
                      <td style={{ padding: '6px 4px', borderBottom: '0.5px solid rgba(128,128,128,0.08)', textAlign: 'right' }}>₽{fmt(Number(m.debt_end))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
