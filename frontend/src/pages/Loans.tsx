import { useEffect, useState, useRef } from 'react'
import { fetchLoans, Loan, RatePeriod, recordPayment, createLoan, updateLoan, deleteLoan } from '../api/loans'
import { CardSummary, fetchCardSummary, addCharge } from '../api/card'
import ExtraPaymentSlider from '../components/ExtraPaymentSlider'
import CardDetail from './CardDetail'
import LoanDetail from './LoanDetail'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid rgba(128,128,128,0.3)', fontSize: 15,
  background: 'transparent', color: 'inherit', boxSizing: 'border-box',
  marginBottom: 10,
}
const labelStyle: React.CSSProperties = { fontSize: 12, opacity: 0.5, marginBottom: 4 }

function ConfirmDeleteModal({ loan, onClose, onConfirm }: { loan: Loan; onClose: () => void; onConfirm: () => void }) {
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = async () => {
    setDeleting(true)
    await onConfirm()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
      <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', borderRadius: 16, padding: 24, width: '85%', maxWidth: 320, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
        <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>Удалить {loan.loan_type === 'card' ? 'карту' : 'кредит'}?</div>
        <div style={{ fontSize: 14, opacity: 0.6, marginBottom: 20 }}>
          «{loan.name}» будет удалён. Это действие нельзя отменить.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent', color: 'inherit', fontSize: 14 }}>
            Отмена
          </button>
          <button onClick={handleConfirm} disabled={deleting} style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', background: '#F44336', color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
            {deleting ? '...' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LoanModal({ onClose, onSave, editLoan }: { onClose: () => void; onSave: () => void; editLoan?: Loan }) {
  const isEdit = !!editLoan
  const [type, setType] = useState<'loan' | 'card'>(editLoan?.loan_type ?? 'loan')
  const [name, setName] = useState(editLoan?.name ?? '')
  const [bank, setBank] = useState(editLoan?.bank ?? '')
  // loan fields
  const [original, setOriginal] = useState(editLoan?.original_amount?.toString() ?? '')
  const [remaining, setRemaining] = useState(editLoan?.remaining_amount?.toString() ?? '')
  const [rate, setRate] = useState(editLoan?.interest_rate?.toString() ?? '')
  const [payment, setPayment] = useState(editLoan?.monthly_payment?.toString() ?? '')
  const [nextDate, setNextDate] = useState(editLoan?.next_payment_date ?? '')
  // card fields
  const [limit, setLimit] = useState(editLoan?.credit_limit?.toString() ?? '')
  const [debt, setDebt] = useState(editLoan?.remaining_amount?.toString() ?? '')
  const [cardRate, setCardRate] = useState(editLoan?.interest_rate?.toString() ?? '')
  const [gracePeriodMonths, setGracePeriodMonths] = useState(editLoan?.grace_period_months?.toString() ?? '')
  const [minPaymentPct, setMinPaymentPct] = useState(editLoan?.min_payment_pct?.toString() ?? '')
  const [minPaymentFloor, setMinPaymentFloor] = useState(editLoan?.min_payment_floor?.toString() ?? '')
  const [cardNextDate, setCardNextDate] = useState(editLoan?.next_payment_date ?? '')
  const [saving, setSaving] = useState(false)
  // Variable rate periods
  const [hasVariableRate, setHasVariableRate] = useState((editLoan?.rate_periods?.length ?? 0) > 0)
  const [ratePeriods, setRatePeriods] = useState<{ rate: string; start_date: string; end_date: string }[]>(
    editLoan?.rate_periods?.map(rp => ({
      rate: rp.rate.toString(),
      start_date: rp.start_date,
      end_date: rp.end_date ?? '',
    })) ?? [{ rate: '', start_date: '', end_date: '' }, { rate: '', start_date: '', end_date: '' }]
  )

  const addRatePeriod = () => setRatePeriods([...ratePeriods, { rate: '', start_date: '', end_date: '' }])
  const removeRatePeriod = (i: number) => setRatePeriods(ratePeriods.filter((_, idx) => idx !== i))
  const updateRatePeriod = (i: number, field: string, val: string) => {
    const updated = [...ratePeriods]
    updated[i] = { ...updated[i], [field]: val }
    setRatePeriods(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    const rp = hasVariableRate
      ? ratePeriods
          .filter(p => p.rate && p.start_date)
          .map(p => ({ rate: parseFloat(p.rate), start_date: p.start_date, end_date: p.end_date || null }))
      : undefined
    if (type === 'loan') {
      const data: any = {
        name: name.trim(),
        bank: bank.trim() || null,
        remaining_amount: parseFloat(remaining),
        interest_rate: parseFloat(rate),
        monthly_payment: parseFloat(payment),
        next_payment_date: nextDate,
        rate_periods: rp ?? (isEdit ? [] : undefined),
      }
      if (isEdit) {
        await updateLoan(editLoan!.id, data)
      } else {
        await createLoan({
          ...data,
          loan_type: 'loan',
          original_amount: parseFloat(original),
          start_date: nextDate,
        })
      }
    } else {
      const debtVal = parseFloat(debt) || 0
      const data: any = {
        name: name.trim(),
        bank: bank.trim() || null,
        remaining_amount: debtVal,
        interest_rate: parseFloat(cardRate) || 0,
        monthly_payment: 0,
        next_payment_date: cardNextDate,
        credit_limit: parseFloat(limit),
        grace_period_months: parseInt(gracePeriodMonths) || null,
        min_payment_pct: parseFloat(minPaymentPct) || null,
        min_payment_floor: parseFloat(minPaymentFloor) || null,
      }
      if (isEdit) {
        await updateLoan(editLoan!.id, data)
      } else {
        await createLoan({
          ...data,
          loan_type: 'card',
          original_amount: null,
          start_date: null,
        })
      }
    }
    onSave()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
      <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', width: '100%', borderRadius: '16px 16px 0 0', padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontWeight: 'bold', marginBottom: 14, fontSize: 16 }}>
          {isEdit ? 'Редактировать' : 'Новый долг'}
        </div>

        {/* Type switcher — only for new */}
        {!isEdit && (
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
        )}

        <input style={inputStyle} placeholder="Название *" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <input style={inputStyle} placeholder="Банк" value={bank} onChange={e => setBank(e.target.value)} />

        {type === 'loan' ? (
          <>
            {!isEdit && (
              <input style={inputStyle} type="number" placeholder="Исходная сумма *" value={original} onChange={e => setOriginal(e.target.value)} />
            )}
            <input style={inputStyle} type="number" placeholder="Остаток долга *" value={remaining} onChange={e => setRemaining(e.target.value)} />
            <input style={inputStyle} type="number" placeholder="Ставка % годовых *" value={rate} onChange={e => setRate(e.target.value)} />

            {/* Variable rate toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13 }}>
              <input type="checkbox" checked={hasVariableRate} onChange={e => setHasVariableRate(e.target.checked)} />
              Переменная ставка
            </label>

            {hasVariableRate && (
              <div style={{ background: 'rgba(128,128,128,0.08)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Периоды ставок:</div>
                {ratePeriods.map((rp, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
                    <input style={{ ...inputStyle, flex: 1, marginBottom: 0 }} type="number" placeholder="Ставка %" value={rp.rate} onChange={e => updateRatePeriod(i, 'rate', e.target.value)} />
                    <input style={{ ...inputStyle, flex: 1, marginBottom: 0 }} type="date" value={rp.start_date} onChange={e => updateRatePeriod(i, 'start_date', e.target.value)} />
                    <input style={{ ...inputStyle, flex: 1, marginBottom: 0 }} type="date" placeholder="до" value={rp.end_date} onChange={e => updateRatePeriod(i, 'end_date', e.target.value)} />
                    {ratePeriods.length > 1 && (
                      <button onClick={() => removeRatePeriod(i)} style={{ background: 'none', border: 'none', color: '#F44336', fontSize: 16, cursor: 'pointer', padding: '0 4px' }}>×</button>
                    )}
                  </div>
                ))}
                <button onClick={addRatePeriod} style={{ background: 'none', border: 'none', color: '#2196F3', fontSize: 12, cursor: 'pointer', padding: 0 }}>+ Добавить период</button>
              </div>
            )}

            <input style={inputStyle} type="number" placeholder="Ежемесячный платёж *" value={payment} onChange={e => setPayment(e.target.value)} />
            <div style={labelStyle}>Дата следующего платежа *</div>
            <input style={inputStyle} type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} />
          </>
        ) : (
          <>
            <input style={inputStyle} type="number" placeholder="Кредитный лимит *" value={limit} onChange={e => setLimit(e.target.value)} />
            <input style={inputStyle} type="number" placeholder="Текущий долг" value={debt} onChange={e => setDebt(e.target.value)} />
            <input style={inputStyle} type="number" placeholder="Ставка % годовых" value={cardRate} onChange={e => setCardRate(e.target.value)} />
            <input style={inputStyle} type="number" placeholder="Льготный период (месяцев)" value={gracePeriodMonths} onChange={e => setGracePeriodMonths(e.target.value)} />
            <input style={inputStyle} type="number" placeholder="Мин. платёж (% от долга)" value={minPaymentPct} onChange={e => setMinPaymentPct(e.target.value)} />
            <input style={inputStyle} type="number" placeholder="Мин. платёж (минимум ₽)" value={minPaymentFloor} onChange={e => setMinPaymentFloor(e.target.value)} />
            <div style={labelStyle}>Дата следующего платежа *</div>
            <input style={inputStyle} type="date" value={cardNextDate} onChange={e => setCardNextDate(e.target.value)} />
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent', color: 'inherit', fontSize: 14 }}>
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 12, borderRadius: 8, border: 'none', background: '#2196F3', color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
            {saving ? '...' : isEdit ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddChargeModal({ loanId, onClose, onSave }: { loanId: number; onClose: () => void; onSave: () => void }) {
  const [chargeType, setChargeType] = useState<'purchase' | 'transfer' | 'cash'>('purchase')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [chargeDate, setChargeDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!amount) return
    setSaving(true)
    await addCharge(loanId, {
      amount: parseFloat(amount),
      description: description.trim(),
      charge_type: chargeType,
      charge_date: chargeDate,
    })
    onSave()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
      <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', width: '100%', borderRadius: '16px 16px 0 0', padding: 20 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 14, fontSize: 16 }}>Новая трата</div>

        {/* Type selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {([
            { key: 'purchase' as const, label: '🛒 Покупка' },
            { key: 'transfer' as const, label: '🔄 Перевод' },
            { key: 'cash' as const, label: '💵 Наличные' },
          ]).map(t => (
            <button key={t.key} onClick={() => setChargeType(t.key)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 'bold',
              background: chargeType === t.key ? '#2196F3' : 'rgba(128,128,128,0.15)',
              color: chargeType === t.key ? '#fff' : 'inherit',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        <input style={inputStyle} type="number" placeholder="Сумма *" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
        <input style={inputStyle} placeholder="Описание" value={description} onChange={e => setDescription(e.target.value)} />
        <div style={labelStyle}>Дата</div>
        <input style={inputStyle} type="date" value={chargeDate} onChange={e => setChargeDate(e.target.value)} />

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent', color: 'inherit', fontSize: 14 }}>
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving || !amount} style={{ flex: 2, padding: 12, borderRadius: 8, border: 'none', background: '#2196F3', color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
            {saving ? '...' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CardMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
        color: 'inherit', opacity: 0.5, padding: '0 4px', lineHeight: 1,
      }}>
        ⋮
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', zIndex: 50,
          background: 'var(--tg-theme-secondary-bg-color, #2c2c2e)', borderRadius: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)', overflow: 'hidden', minWidth: 160,
        }}>
          <button onClick={() => { setOpen(false); onEdit() }} style={{
            display: 'block', width: '100%', padding: '12px 16px', border: 'none',
            background: 'transparent', color: 'inherit', fontSize: 14, textAlign: 'left',
            cursor: 'pointer',
          }}>
            ✏️ Редактировать
          </button>
          <div style={{ height: 1, background: 'rgba(128,128,128,0.2)' }} />
          <button onClick={() => { setOpen(false); onDelete() }} style={{
            display: 'block', width: '100%', padding: '12px 16px', border: 'none',
            background: 'transparent', color: '#F44336', fontSize: 14, textAlign: 'left',
            cursor: 'pointer',
          }}>
            🗑️ Удалить
          </button>
        </div>
      )}
    </div>
  )
}

function CardLoanCard({ loan, onPayment, onEdit, onDelete, onAddCharge, onDetail }: {
  loan: Loan; onPayment: () => void; onEdit: () => void; onDelete: () => void;
  onAddCharge: () => void; onDetail: () => void;
}) {
  const [summary, setSummary] = useState<CardSummary | null>(null)

  useEffect(() => {
    fetchCardSummary(loan.id).then(setSummary).catch(() => {})
  }, [loan.id])

  const limit = loan.credit_limit ?? 0
  const debt = summary?.total_debt ?? loan.remaining_amount ?? 0
  const available = summary?.available ?? (limit - debt)
  const usedPct = limit > 0 ? debt / limit : 0
  const hasOverdue = summary?.grace_buckets.some(b => b.is_overdue) ?? false

  return (
    <div style={{ border: `1px solid ${hasOverdue ? 'rgba(244,67,54,0.4)' : 'rgba(128,128,128,0.2)'}`, borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontWeight: 'bold' }}>🃏 {loan.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, opacity: 0.6 }}>{loan.bank || ''}</span>
          <CardMenu onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>

      {hasOverdue && (
        <div style={{ fontSize: 12, color: '#F44336', marginBottom: 6 }}>⚠️ Есть просроченные траты · {loan.interest_rate}% годовых</div>
      )}

      <div style={{ fontSize: 13, marginBottom: 6 }}>
        Долг: <b>₽{debt.toLocaleString('ru')}</b> · Доступно: ₽{available.toLocaleString('ru')} / ₽{limit.toLocaleString('ru')}
      </div>

      <div style={{ background: 'rgba(128,128,128,0.2)', borderRadius: 4, height: 6, marginBottom: 6 }}>
        <div style={{ background: hasOverdue ? '#F44336' : '#FF9800', width: `${Math.min(usedPct * 100, 100)}%`, height: 6, borderRadius: 4 }} />
      </div>

      {/* Grace buckets */}
      {summary && summary.grace_buckets.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {summary.grace_buckets.map((b, i) => (
            <div key={i} style={{
              fontSize: 11, padding: '3px 0',
              color: b.is_overdue ? '#F44336' : '#4CAF50',
            }}>
              {b.is_overdue ? '⚠️' : '✓'} до {b.deadline}: ₽{b.total.toLocaleString('ru')}
            </div>
          ))}
        </div>
      )}

      {summary && summary.non_grace_debt > 0 && (
        <div style={{ fontSize: 11, color: '#FF9800', marginBottom: 6 }}>
          Без льготы: ₽{summary.non_grace_debt.toLocaleString('ru')} · %: ₽{summary.accrued_interest.toLocaleString('ru')}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.6, marginBottom: 8 }}>
        <span>Мин. платёж: ₽{(summary?.min_payment ?? loan.monthly_payment).toLocaleString('ru')}</span>
        <span>До: {loan.next_payment_date}</span>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onPayment} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#E8F5E9', color: '#388E3C', fontSize: 12 }}>
          ✓ Платёж
        </button>
        <button onClick={onAddCharge} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'rgba(33,150,243,0.12)', color: '#2196F3', fontSize: 12 }}>
          + Трата
        </button>
        <button onClick={onDetail} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'rgba(128,128,128,0.1)', color: 'inherit', fontSize: 12, marginLeft: 'auto' }}>
          Подробнее →
        </button>
      </div>
    </div>
  )
}

function RegularLoanCard({ loan, onPayment, onEdit, onDelete, onOpenDetail }: { loan: Loan; onPayment: () => void; onEdit: () => void; onDelete: () => void; onOpenDetail: () => void }) {
  const orig = loan.original_amount ?? loan.remaining_amount
  const pct = orig > 0 ? 1 - loan.remaining_amount / orig : 0
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontWeight: 'bold' }}>💳 {loan.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, opacity: 0.6 }}>{loan.bank || ''}</span>
          <CardMenu onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>
      <div style={{ fontSize: 13, marginBottom: 6 }}>
        Остаток: <b>₽{loan.remaining_amount.toLocaleString('ru')}</b> · {loan.rate_periods?.length > 0 ? (
          <span title="Переменная ставка">📊 перем.</span>
        ) : <>{loan.interest_rate}%</>} · ещё ~{monthsLeft} мес.
      </div>
      {loan.rate_periods?.length > 0 && (
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>
          {loan.rate_periods.map((rp, i) => (
            <span key={i}>{i > 0 ? ' → ' : ''}{rp.rate}%{rp.end_date ? ` до ${rp.end_date}` : ''}</span>
          ))}
        </div>
      )}
      <div style={{ background: 'rgba(128,128,128,0.2)', borderRadius: 4, height: 6, marginBottom: 6 }}>
        <div style={{ background: '#4CAF50', width: `${Math.min(pct * 100, 100)}%`, height: 6, borderRadius: 4 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.6, marginBottom: 8 }}>
        <span>Платёж: ₽{loan.monthly_payment.toLocaleString('ru')}</span>
        <span>Следующий: {loan.next_payment_date}</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onPayment} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#E8F5E9', color: '#388E3C', fontSize: 12 }}>
          ✓ Записать платёж
        </button>
        <button onClick={onOpenDetail} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'rgba(128,128,128,0.1)', color: 'inherit', fontSize: 12, marginLeft: 'auto' }}>
          Подробнее →
        </button>
      </div>
    </div>
  )
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingLoan, setEditingLoan] = useState<Loan | undefined>()
  const [deletingLoan, setDeletingLoan] = useState<Loan | undefined>()
  const [chargingLoanId, setChargingLoanId] = useState<number | null>(null)
  const [detailLoan, setDetailLoan] = useState<Loan | null>(null)
  const load = () => fetchLoans().then(setLoans)
  useEffect(() => { load() }, [])

  const handlePayment = async (loan: Loan) => {
    const defaultAmt = loan.monthly_payment
    const amount = prompt(`Платёж по "${loan.name}" (мин. ₽${defaultAmt}):`)
    if (!amount) return
    await recordPayment(loan.id, parseFloat(amount))
    load()
  }

  const handleEdit = (loan: Loan) => {
    setEditingLoan(loan)
    setShowModal(true)
  }

  const handleDelete = async () => {
    if (!deletingLoan) return
    await deleteLoan(deletingLoan.id)
    setDeletingLoan(undefined)
    load()
  }

  // Show detail page
  if (detailLoan) {
    if (detailLoan.loan_type === 'card') {
      return <CardDetail loan={detailLoan} onBack={() => { setDetailLoan(null); load() }} />
    }
    return <LoanDetail loan={detailLoan} onBack={() => { setDetailLoan(null); load() }} />
  }

  const regularLoans = loans.filter(l => l.loan_type === 'loan')
  const cards = loans.filter(l => l.loan_type === 'card')

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>💳 Кредиты и карты</h3>
        <button onClick={() => { setEditingLoan(undefined); setShowModal(true) }} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#2196F3', color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
          + Добавить
        </button>
      </div>

      {cards.length > 0 && (
        <>
          <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 8 }}>КРЕДИТНЫЕ КАРТЫ</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {cards.map(loan => (
              <CardLoanCard key={loan.id} loan={loan}
                onPayment={() => handlePayment(loan)}
                onEdit={() => handleEdit(loan)}
                onDelete={() => setDeletingLoan(loan)}
                onAddCharge={() => setChargingLoanId(loan.id)}
                onDetail={() => setDetailLoan(loan)}
              />
            ))}
          </div>
        </>
      )}

      {regularLoans.length > 0 && (
        <>
          <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 8 }}>КРЕДИТЫ</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {regularLoans.map(loan => (
              <RegularLoanCard key={loan.id} loan={loan}
                onPayment={() => handlePayment(loan)}
                onEdit={() => handleEdit(loan)}
                onDelete={() => setDeletingLoan(loan)}
                onOpenDetail={() => setDetailLoan(loan)}
              />
            ))}
          </div>
        </>
      )}

      {loans.length === 0 && (
        <div style={{ opacity: 0.5, textAlign: 'center', marginTop: 40 }}>Кредитов и карт нет</div>
      )}

      {regularLoans.length > 0 && <ExtraPaymentSlider />}

      {showModal && (
        <LoanModal
          editLoan={editingLoan}
          onClose={() => { setShowModal(false); setEditingLoan(undefined) }}
          onSave={load}
        />
      )}

      {deletingLoan && (
        <ConfirmDeleteModal
          loan={deletingLoan}
          onClose={() => setDeletingLoan(undefined)}
          onConfirm={handleDelete}
        />
      )}

      {chargingLoanId !== null && (
        <AddChargeModal
          loanId={chargingLoanId}
          onClose={() => setChargingLoanId(null)}
          onSave={load}
        />
      )}
    </div>
  )
}
