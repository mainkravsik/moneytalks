interface Props { amount: number; total: number }

const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

export default function SafeToSpendBadge({ amount, total }: Props) {
  const pct = total > 0 ? amount / total : 0
  const color = pct > 0.3 ? '#4CAF50' : pct > 0.1 ? '#FF9800' : '#F44336'
  return (
    <div style={{ textAlign: 'center', padding: '20px 0 12px' }}>
      <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #8e8e93)', marginBottom: 4 }}>
        Можно потратить
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, color, letterSpacing: -1 }}>
        ₽ {fmt(Math.abs(amount))}
      </div>
      <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #8e8e93)' }}>
        из ₽ {fmt(total)} бюджета
      </div>
    </div>
  )
}
