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
    <div style={{ padding: 16 }}>
      <button onClick={onBack} style={{
        background: 'none', border: 'none', color: '#2196F3',
        fontSize: 14, padding: 0, marginBottom: 12, cursor: 'pointer',
      }}>
        ← Назад
      </button>
      <h3 style={{ margin: '0 0 12px' }}>🃏 {loan.name}</h3>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(128,128,128,0.3)' }}>
        {(['charges', 'calc'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 0', border: 'none', fontSize: 13, fontWeight: 'bold',
            background: tab === t ? '#2196F3' : 'transparent',
            color: tab === t ? '#fff' : 'inherit',
            cursor: 'pointer',
          }}>
            {t === 'charges' ? 'Траты' : 'Калькулятор'}
          </button>
        ))}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
        <button onClick={prev} style={{ background: 'none', border: 'none', fontSize: 18, color: '#2196F3', cursor: 'pointer' }}>←</button>
        <span style={{ fontWeight: 'bold', fontSize: 15, minWidth: 140, textAlign: 'center' }}>
          {MONTHS_RU[month]} {year}
        </span>
        <button onClick={next} style={{ background: 'none', border: 'none', fontSize: 18, color: '#2196F3', cursor: 'pointer' }}>→</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', opacity: 0.5, marginTop: 20 }}>Загрузка...</div>
      ) : charges.length === 0 ? (
        <div style={{ textAlign: 'center', opacity: 0.5, marginTop: 20 }}>Трат за этот месяц нет</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {charges.map(c => (
            <div key={c.id} style={{
              border: '1px solid rgba(128,128,128,0.2)', borderRadius: 10, padding: 12,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 20 }}>{chargeTypeIcons[c.charge_type] || '📋'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 'bold', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.description || 'Без описания'}
                </div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>
                  {c.charge_date}
                  {c.grace_deadline && ` · до ${c.grace_deadline}`}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 'bold', fontSize: 14 }}>₽{c.amount.toLocaleString('ru')}</div>
                <span style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 4,
                  background: `${statusColors[c.status] || '#999'}22`,
                  color: statusColors[c.status] || '#999',
                  fontWeight: 'bold',
                }}>
                  {statusLabels[c.status] || c.status}
                </span>
              </div>
              <button onClick={() => handleDelete(c.id)} style={{
                background: 'none', border: 'none', color: '#F44336',
                fontSize: 16, cursor: 'pointer', padding: '0 4px', opacity: 0.6,
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

  if (!summary) return <div style={{ textAlign: 'center', opacity: 0.5 }}>Загрузка...</div>

  const recs = payoff?.recommendations

  return (
    <div>
      {/* Slider */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, marginBottom: 6 }}>
          Ежемесячный платёж: <b>₽{payment.toLocaleString('ru')}</b>
        </div>
        <input type="range" min={1000} max={200000} step={1000} value={payment}
          onChange={e => setPayment(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {/* Recommendation cards */}
      {recs && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Без %', value: recs.zero_interest },
            { label: 'За 6 мес', value: recs.close_in_6 },
            { label: 'За 12 мес', value: recs.close_in_12 },
          ].map(r => (
            <button key={r.label} onClick={() => setPayment(r.value)} style={{
              flex: 1, padding: '10px 4px', borderRadius: 8,
              border: payment === r.value ? '2px solid #2196F3' : '1px solid rgba(128,128,128,0.3)',
              background: payment === r.value ? 'rgba(33,150,243,0.1)' : 'transparent',
              color: 'inherit', cursor: 'pointer', textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, opacity: 0.6 }}>{r.label}</div>
              <div style={{ fontWeight: 'bold', fontSize: 13 }}>₽{r.value.toLocaleString('ru')}</div>
            </button>
          ))}
        </div>
      )}

      {/* Summary */}
      {loadingPayoff ? (
        <div style={{ textAlign: 'center', opacity: 0.5 }}>Расчёт...</div>
      ) : payoff && (
        <>
          <div style={{
            display: 'flex', gap: 8, marginBottom: 16,
          }}>
            <div style={{ flex: 1, background: 'rgba(128,128,128,0.08)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Месяцев</div>
              <div style={{ fontWeight: 'bold', fontSize: 18 }}>{payoff.total_months}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(244,67,54,0.08)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Переплата</div>
              <div style={{ fontWeight: 'bold', fontSize: 18, color: '#F44336' }}>₽{payoff.total_interest.toLocaleString('ru')}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(128,128,128,0.08)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Всего</div>
              <div style={{ fontWeight: 'bold', fontSize: 14 }}>₽{payoff.total_paid.toLocaleString('ru')}</div>
            </div>
          </div>

          {/* Monthly table */}
          <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 8 }}>ПОМЕСЯЧНЫЙ ГРАФИК</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ opacity: 0.6 }}>
                  <th style={{ textAlign: 'left', padding: '6px 4px', borderBottom: '1px solid rgba(128,128,128,0.2)' }}>Месяц</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '1px solid rgba(128,128,128,0.2)' }}>Долг</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '1px solid rgba(128,128,128,0.2)' }}>Платёж</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '1px solid rgba(128,128,128,0.2)' }}>%</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '1px solid rgba(128,128,128,0.2)' }}>Остаток</th>
                </tr>
              </thead>
              <tbody>
                {payoff.months.map((m, i) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 4px', borderBottom: '1px solid rgba(128,128,128,0.1)' }}>{m.month}</td>
                    <td style={{ padding: '6px 4px', borderBottom: '1px solid rgba(128,128,128,0.1)', textAlign: 'right' }}>₽{m.debt_start.toLocaleString('ru')}</td>
                    <td style={{ padding: '6px 4px', borderBottom: '1px solid rgba(128,128,128,0.1)', textAlign: 'right' }}>₽{m.payment.toLocaleString('ru')}</td>
                    <td style={{ padding: '6px 4px', borderBottom: '1px solid rgba(128,128,128,0.1)', textAlign: 'right', color: m.interest > 0 ? '#F44336' : 'inherit' }}>₽{m.interest.toLocaleString('ru')}</td>
                    <td style={{ padding: '6px 4px', borderBottom: '1px solid rgba(128,128,128,0.1)', textAlign: 'right' }}>₽{m.debt_end.toLocaleString('ru')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
