interface Props { amount: number; total: number }

export default function SafeToSpendBadge({ amount, total }: Props) {
  const pct = total > 0 ? amount / total : 0
  const color = pct > 0.3 ? '#4CAF50' : pct > 0.1 ? '#FF9800' : '#F44336'
  return (
    <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
      <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>
        Можно потратить
      </div>
      <div style={{ fontSize: 36, fontWeight: 'bold', color }}>
        ₽ {Math.round(amount).toLocaleString('ru')}
      </div>
      <div style={{ fontSize: 11, opacity: 0.5 }}>
        из ₽ {Math.round(total).toLocaleString('ru')} бюджета
      </div>
    </div>
  )
}
