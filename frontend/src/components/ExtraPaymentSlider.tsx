import { useState, useEffect } from 'react'
import { fetchPayoff, PayoffResponse } from '../api/loans'

const fmt = (n: number) => Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

export default function ExtraPaymentSlider() {
  const [extra, setExtra] = useState(0)
  const [data, setData] = useState<PayoffResponse | null>(null)

  useEffect(() => {
    fetchPayoff(extra).then(setData).catch(() => setData(null))
  }, [extra])

  if (!data) return null

  return (
    <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}>💡 Калькулятор доплаты</div>
      <div style={{ fontSize: 13, marginBottom: 10 }}>
        Если доплачивать <b>₽{fmt(extra)}/мес</b>:
      </div>
      <input
        type="range" min={0} max={50000} step={500}
        value={extra} onChange={e => setExtra(Number(e.target.value))}
        style={{ width: '100%', marginBottom: 12 }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, background: 'var(--tg-theme-secondary-bg-color, #2c2c2e)', borderRadius: 10, padding: 10, fontSize: 13 }}>
          <div style={{ color: 'var(--tg-theme-hint-color, #8e8e93)', fontSize: 12 }}>Snowball</div>
          <div style={{ fontWeight: 600 }}>{data.snowball.months_to_payoff} мес</div>
          <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #8e8e93)' }}>₽{fmt(Number(data.snowball.total_interest))} переплата</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(76,175,80,0.1)', borderRadius: 10, padding: 10, fontSize: 13 }}>
          <div style={{ color: 'var(--tg-theme-hint-color, #8e8e93)', fontSize: 12 }}>Avalanche</div>
          <div style={{ fontWeight: 600 }}>{data.avalanche.months_to_payoff} мес</div>
          <div style={{ fontSize: 12, color: '#4CAF50' }}>экономия ₽{fmt(Number(data.savings_with_avalanche))}</div>
        </div>
      </div>
    </div>
  )
}
