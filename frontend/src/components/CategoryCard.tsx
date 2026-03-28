import { useRef } from 'react'
import { CategoryBudget } from '../api/budget'

interface Props {
  data: CategoryBudget
  onClick?: () => void
  onLongPress?: () => void
}

const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

export default function CategoryCard({ data, onClick, onLongPress }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTouchStart = () => {
    timer.current = setTimeout(() => { onLongPress?.() }, 500)
  }
  const handleTouchEnd = () => {
    if (timer.current) clearTimeout(timer.current)
  }
  const pct = Math.min(data.percent_used, 1)
  const barColor = data.percent_used < 0.7 ? '#4CAF50'
    : data.percent_used < 1 ? '#FF9800'
    : '#F44336'
  const isOver = data.remaining < 0

  return (
    <div
      onClick={onClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      style={{
        background: isOver ? 'rgba(244,67,54,0.06)' : 'var(--tg-theme-secondary-bg-color, #2c2c2e)',
        borderRadius: 12,
        padding: '12px 14px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 500 }}>{data.category.emoji} {data.category.name}</span>
        <span style={{ fontSize: 13, color: barColor, fontWeight: 600 }}>
          ₽{fmt(data.spent)} / ₽{fmt(data.limit)}
        </span>
      </div>
      <div style={{ background: 'rgba(128,128,128,0.15)', borderRadius: 4, height: 6 }}>
        <div style={{
          background: barColor,
          width: `${Math.min(pct * 100, 100)}%`,
          height: 6,
          borderRadius: 4,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #8e8e93)', marginTop: 6 }}>
        {isOver
          ? `⚠ Превышено на ₽${fmt(Math.abs(data.spent - data.limit))}`
          : `Осталось ₽${fmt(Math.max(data.remaining, 0))}`}
      </div>
    </div>
  )
}
