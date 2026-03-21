import { useState, useEffect } from 'react'
import { fetchPayoff, PayoffResponse } from '../api/loans'

export default function ExtraPaymentSlider() {
  const [extra, setExtra] = useState(0)
  const [data, setData] = useState<PayoffResponse | null>(null)

  useEffect(() => {
    fetchPayoff(extra).then(setData).catch(() => setData(null))
  }, [extra])

  if (!data) return null

  return (
    <div style={{ padding: 12, border: '1px solid rgba(128,128,128,0.2)', borderRadius: 10 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>💡 Калькулятор доплаты</div>
      <div style={{ fontSize: 12, marginBottom: 8 }}>
        Если доплачивать <b>₽{extra.toLocaleString('ru')}/мес</b>:
      </div>
      <input
        type="range" min={0} max={50000} step={500}
        value={extra} onChange={e => setExtra(Number(e.target.value))}
        style={{ width: '100%', marginBottom: 12 }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, background: 'rgba(128,128,128,0.08)', borderRadius: 8, padding: 8, fontSize: 12 }}>
          <div style={{ opacity: 0.6 }}>Snowball</div>
          <div><b>{data.snowball.months_to_payoff} мес</b></div>
          <div style={{ fontSize: 11, opacity: 0.5 }}>₽{data.snowball.total_interest.toLocaleString('ru')} переплата</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(76,175,80,0.1)', borderRadius: 8, padding: 8, fontSize: 12 }}>
          <div style={{ opacity: 0.6 }}>Avalanche</div>
          <div><b>{data.avalanche.months_to_payoff} мес</b></div>
          <div style={{ fontSize: 11, color: '#4CAF50' }}>экономия ₽{data.savings_with_avalanche.toLocaleString('ru')}</div>
        </div>
      </div>
    </div>
  )
}
